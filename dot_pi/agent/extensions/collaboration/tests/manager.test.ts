/**
 * Contract tests for persistent collaboration workers using Node's built-in runner.
 * Run `node --test collaboration/tests/manager.test.ts` on Node 26. The fake child
 * exchanges actual newline-delimited RPC records through streams, so tests exercise
 * framing, command sequencing, cancellation, and session cleanup without model calls.
 */
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { test } from "node:test";
import { AgentManager, CHILD_ENV, type Invocation } from "../manager.ts";

class FakeChild extends EventEmitter {
	stdin = new PassThrough();
	stdout = new PassThrough();
	stderr = new PassThrough();
	exitCode: number | null = null;
	signalCode: string | null = null;
	commands: any[] = [];
	kills: string[] = [];
	handle?: (command: any) => boolean;
	constructor() {
		super();
		let buffer = "";
		this.stdin.setEncoding("utf8");
		this.stdin.on("data", chunk => {
			buffer += chunk;
			let end: number;
			while ((end = buffer.indexOf("\n")) >= 0) {
				const command = JSON.parse(buffer.slice(0, end));
				buffer = buffer.slice(end + 1);
				this.commands.push(command);
				if (!this.handle?.(command)) this.reply(command);
			}
		});
	}
	reply(command: any, data: unknown = {}, error?: string) {
		this.record({ type: "response", id: command.id, command: command.type, success: !error, data, error });
	}
	record(value: unknown) { this.stdout.write(`${JSON.stringify(value)}\n`); }
	finish(text = "finished", aborted = false) {
		this.record({ type: "message_end", message: { role: "assistant", content: [{ type: "text", text }] } });
		this.record({ type: "agent_settled", aborted });
	}
	kill(signal = "SIGTERM") {
		this.kills.push(signal);
		this.signalCode = signal;
		queueMicrotask(() => this.emit("exit", null, signal));
		return true;
	}
}

function fixture(t: any, prepare?: (child: FakeChild) => void) {
	const children: FakeChild[] = [];
	const launches: { invocation: Invocation; cwd: string; env: NodeJS.ProcessEnv }[] = [];
	const notices: any[] = [];
	const manager = new AgentManager({
		launch(invocation, cwd, env) {
			const child = new FakeChild();
			prepare?.(child);
			children.push(child);
			launches.push({ invocation, cwd, env });
			return child as any;
		},
		onNotice: notice => notices.push(notice),
	});
	t.after(() => manager.dispose());
	return { manager, children, launches, notices };
}
const defaults = { cwd: "/tmp", model: "provider/model", thinking: "high", parentContext: "private parent context" };

test("clean workers inherit runtime settings but exclude parent context", async t => {
	const { manager, children, launches } = fixture(t);
	const worker = await manager.spawn({ task_name: "reviewer", message: "Review carefully", fork_turns: "none" }, defaults);
	assert.equal(worker.id, "/root/reviewer");
	assert.equal(worker.status, "running");
	assert.deepEqual(children[0].commands.map(command => command.type), ["get_state", "prompt"]);
	assert.match(children[0].commands[1].message, /Review carefully/);
	assert.doesNotMatch(children[0].commands[1].message, /private parent context/);
	assert.deepEqual(launches[0].invocation.args.slice(-4), ["--model", "provider/model", "--thinking", "high"]);
	assert.equal(launches[0].cwd, defaults.cwd);
	assert.equal(launches[0].env[CHILD_ENV], "1");
});

test("all-context workers forward a bounded snapshot and accept explicit runtime overrides", async t => {
	const { manager, children, launches } = fixture(t);
	await manager.spawn({ task_name: "writer", message: "Write", fork_turns: "all", model: "other/model", reasoning_effort: "low" }, defaults);
	assert.match(children[0].commands[1].message, /private parent context/);
	assert.deepEqual(launches[0].invocation.args.slice(-4), ["--model", "other/model", "--thinking", "low"]);
});

test("only settled events finish runs; idle messages wait for an explicit follow-up", async t => {
	const { manager, children, notices } = fixture(t);
	await manager.spawn({ task_name: "worker", message: "Start" }, defaults);
	const child = children[0];
	await manager.send("worker", "Steer");
	await manager.send("worker", "Queued next turn", true);
	assert.deepEqual(child.commands.slice(-2).map(command => command.type), ["steer", "prompt"]);
	assert.equal(child.commands.at(-1).streamingBehavior, "steer");
	child.record({ type: "agent_end", messages: [] });
	assert.equal(manager.list()[0].status, "running");
	assert.equal(notices.length, 0);
	child.finish("done");
	assert.equal(manager.list()[0].status, "idle");
	assert.deepEqual(await manager.wait(), { updated: ["/root/worker"], timed_out: false });
	const before = child.commands.length;
	await manager.send("worker", "Do not start");
	assert.equal(manager.list()[0].status, "idle");
	assert.ok(child.commands.slice(before).every(command => command.type !== "prompt"));
	await manager.send("worker", "Continue", true);
	assert.equal(child.commands.at(-1).type, "prompt");
	assert.equal(manager.list()[0].status, "running");
	assert.deepEqual(manager.list()[0].results, [{ status: "idle", text: "done" }]);
});

test("interruption clears the queue and preserves the worker for reuse", async t => {
	const { manager, children } = fixture(t);
	await manager.spawn({ task_name: "worker", message: "Start" }, defaults);
	children[0].handle = command => {
		if (command.type !== "abort") return false;
		children[0].finish("partial result", true);
		children[0].reply(command);
		return true;
	};
	assert.equal((await manager.interrupt("worker")).status, "interrupted");
	assert.deepEqual(children[0].commands.slice(-2).map(command => command.type), ["clear_queue", "abort"]);
	await manager.send("worker", "Resume", true);
	assert.equal(manager.list()[0].status, "running");
	assert.deepEqual(children[0].kills, []);
});

test("RPC failures reject without poisoning the next serialized command", async t => {
	const { manager, children } = fixture(t);
	await manager.spawn({ task_name: "worker", message: "Start" }, defaults);
	children[0].handle = command => {
		if (command.message !== "Reject me") return false;
		children[0].reply(command, {}, "steering rejected");
		return true;
	};
	await assert.rejects(manager.send("worker", "Reject me"), /steering rejected/);
	await manager.send("worker", "Accepted");
	assert.equal(children[0].commands.at(-1).message, "Accepted");
});

test("handled prompts without model work retain their handled result", async t => {
	const { manager } = fixture(t, child => {
		child.handle = command => {
			if (command.type !== "prompt") return false;
			child.reply(command, { disposition: "handled" });
			return true;
		};
	});
	const worker = await manager.spawn({ task_name: "worker", message: "/local-command" }, defaults);
	assert.equal(worker.status, "idle");
	assert.match(worker.results[0].text, /handled/);
});

test("handled prompts retain independent model work that starts before the response", async t => {
	const { manager, children, notices } = fixture(t, child => {
		child.handle = command => {
			if (command.type !== "prompt") return false;
			child.record({ type: "agent_start" });
			child.reply(command, { disposition: "handled" });
			return true;
		};
	});
	const worker = await manager.spawn({ task_name: "worker", message: "/independent-work" }, defaults);
	assert.equal(worker.status, "running");
	assert.equal(notices.length, 0);
	children[0].finish("Independent model result");
	assert.equal(manager.list()[0].status, "idle");
	assert.deepEqual(manager.list()[0].results.at(-1), { status: "idle", text: "Independent model result" });
	assert.equal(notices.length, 1);
});

test("model work started after a handled response becomes active and retains its result", async t => {
	const { manager, children } = fixture(t, child => {
		child.handle = command => {
			if (command.type !== "prompt") return false;
			child.reply(command, { disposition: "handled" });
			return true;
		};
	});
	await manager.spawn({ task_name: "worker", message: "/later-work" }, defaults);
	children[0].record({ type: "agent_start" });
	assert.equal(manager.list()[0].status, "running");
	children[0].finish("Later model result");
	assert.deepEqual(manager.list()[0].results.at(-1), { status: "idle", text: "Later model result" });
});

test("a queued idle message does not make a handled follow-up appear running", async t => {
	const { manager, children } = fixture(t);
	await manager.spawn({ task_name: "worker", message: "Start" }, defaults);
	children[0].finish("Initial result");
	await manager.send("worker", "Queued steering message");
	assert.equal(manager.list()[0].status, "idle");
	children[0].handle = command => {
		if (command.type === "prompt") {
			children[0].reply(command, { disposition: "handled" });
			return true;
		}
		if (command.type === "get_state") {
			children[0].reply(command, { isStreaming: false, isCompacting: false, pendingMessageCount: 1 });
			return true;
		}
		return false;
	};
	const worker = await manager.send("worker", "/handled-followup", true);
	assert.equal(worker.status, "idle");
	assert.equal(worker.results.at(-1)!.status, "idle");
	assert.match(worker.results.at(-1)!.text, /handled/);
});

test("split UTF-8, Unicode separators, and LF records preserve assistant output", async t => {
	const { manager, children } = fixture(t);
	await manager.spawn({ task_name: "worker", message: "Start" }, defaults);
	const text = "你好 🌍\nsecond line\u2028separator\u2029paragraph";
	const bytes = Buffer.from(JSON.stringify({ type: "message_end", message: { role: "assistant", content: [{ type: "text", text }] } }) + "\n");
	for (const byte of bytes) children[0].stdout.write(Buffer.from([byte]));
	children[0].record({ type: "agent_settled" });
	assert.equal(manager.list()[0].results[0].text, text);
});

for (const failure of ["invalid-json", "process-error", "unexpected-exit", "interactive-input"] as const) {
	test(`${failure} becomes a terminal error and stops the child`, async t => {
		const { manager, children, notices } = fixture(t);
		await manager.spawn({ task_name: "worker", message: "Start" }, defaults);
		const child = children[0];
		if (failure === "invalid-json") child.stdout.write("not JSON\n");
		if (failure === "process-error") child.emit("error", new Error("spawn failed"));
		if (failure === "unexpected-exit") { child.stderr.write("provider crashed"); child.emit("exit", 9, null); }
		if (failure === "interactive-input") child.record({ type: "extension_ui_request", method: "input", title: "Secret" });
		assert.equal(manager.list()[0].status, "error");
		assert.equal(notices.length, 1);
		assert.deepEqual(child.kills, ["SIGTERM"]);
		await assert.rejects(manager.send("worker", "Retry", true), /unavailable/);
	});
}

test("startup failures reject spawn and retain their diagnostic result", async t => {
	const { manager } = fixture(t, child => {
		child.handle = command => { child.reply(command, {}, "RPC unavailable"); return true; };
	});
	await assert.rejects(manager.spawn({ task_name: "worker", message: "Start" }, defaults), /RPC unavailable/);
	assert.equal(manager.list()[0].status, "error");
});

test("cancelling a pending command rejects it and stops that worker", async t => {
	const { manager, children } = fixture(t);
	await manager.spawn({ task_name: "worker", message: "Start" }, defaults);
	const controller = new AbortController();
	let commandReceived!: () => void;
	const received = new Promise<void>(resolve => { commandReceived = resolve; });
	children[0].handle = command => {
		if (command.type !== "steer") return false;
		commandReceived();
		return true;
	};
	const pending = manager.send("worker", "Pending", false, controller.signal);
	await received;
	controller.abort();
	await assert.rejects(pending, /cancelled/);
	assert.equal(manager.list()[0].status, "error");
	assert.deepEqual(children[0].kills, ["SIGTERM"]);
});

for (const queuedOperation of ["send", "interrupt"] as const) {
	test(`cancelling a queued ${queuedOperation} promptly stops an unresponsive worker`, { timeout: 1_000 }, async t => {
		const { manager, children } = fixture(t);
		await manager.spawn({ task_name: "worker", message: "Start" }, defaults);
		let commandReceived!: () => void;
		const received = new Promise<void>(resolve => { commandReceived = resolve; });
		children[0].handle = command => {
			if (command.type !== "steer") return false;
			commandReceived();
			return true;
		};
		// Attach rejection handlers before cancellation can reject either operation.
		const first = manager.send("worker", "Unresponsive").then(
			() => ({ rejected: false, error: undefined }),
			error => ({ rejected: true, error }),
		);
		await received;
		const controller = new AbortController();
		const queued = (queuedOperation === "send"
			? manager.send("worker", "Queued", false, controller.signal)
			: manager.interrupt("worker", controller.signal)).then(
			() => ({ rejected: false, error: undefined }),
			error => ({ rejected: true, error }),
		);
		controller.abort();
		await new Promise<void>(resolve => setImmediate(resolve));
		assert.deepEqual([...children[0].kills], ["SIGTERM"]);
		const outcomes = await Promise.all([first, queued]);
		assert.ok(outcomes.every(outcome => outcome.rejected));
		assert.ok(outcomes.every(outcome => /cancelled|stopped|unavailable/i.test(String(outcome.error))));
		assert.equal(manager.list()[0].status, "error");
		assert.deepEqual(children[0].commands.slice(2).map(command => command.type), ["steer"]);
	});
}

test("provider errors remain visible and result history stays bounded", async t => {
	const { manager, children } = fixture(t);
	await manager.spawn({ task_name: "worker", message: "Start" }, defaults);
	children[0].record({ type: "message_end", message: { role: "assistant", content: [], stopReason: "error", errorMessage: "quota exhausted" } });
	children[0].record({ type: "agent_settled" });
	assert.deepEqual(manager.list()[0].results[0], { status: "error", text: "quota exhausted" });
	for (let run = 0; run < 9; run++) {
		await manager.send("worker", `Next ${run}`, true);
		children[0].finish(`Result ${run}`);
	}
	assert.equal(manager.list()[0].results.length, 8);
	assert.equal(manager.list()[0].results[0].text, "Result 1");
});

test("wait can time out or be cancelled without stopping workers", async t => {
	const { manager, children } = fixture(t);
	await manager.spawn({ task_name: "worker", message: "Start" }, defaults);
	const controller = new AbortController();
	const waiting = manager.wait(10_000, controller.signal);
	controller.abort();
	await assert.rejects(waiting, /cancelled/);
	assert.equal(manager.list()[0].status, "running");
	assert.deepEqual(children[0].kills, []);
	t.mock.timers.enable({ apis: ["setTimeout"] });
	const timeout = manager.wait(10_000);
	t.mock.timers.tick(10_000);
	assert.deepEqual(await timeout, { updated: [], timed_out: true });
});

test("disposal wakes waiters, kills children, and suppresses late notices", async t => {
	const { manager, children, notices } = fixture(t);
	await manager.spawn({ task_name: "worker", message: "Start" }, defaults);
	const waiting = manager.wait();
	await manager.dispose();
	assert.deepEqual(await waiting, { updated: [], timed_out: true });
	children[0].finish("late");
	children[0].emit("error", new Error("late error"));
	assert.equal(notices.length, 0);
	assert.deepEqual(children[0].kills, ["SIGTERM"]);
	await assert.rejects(manager.spawn({ task_name: "late", message: "Start" }, defaults), /closed/);
});

test("capacity counts active workers; views and prefix filtering are isolated", async t => {
	const { manager, children } = fixture(t);
	for (const task_name of ["one", "two", "three"]) await manager.spawn({ task_name, message: "Start" }, defaults);
	await assert.rejects(manager.spawn({ task_name: "four", message: "Start" }, defaults), /At most 3/);
	children[0].finish("done");
	await manager.spawn({ task_name: "four", message: "Start" }, defaults);
	assert.equal(manager.list("/root/one").length, 1);
	assert.equal(manager.list("/root/o").length, 0);
	const view = manager.list("/root/one")[0];
	view.results[0].text = "mutated";
	assert.equal(manager.list("/root/one")[0].results[0].text, "done");
});

test("reviewer and implementer cycles can retain more than three settled agents", async t => {
	const { manager, children } = fixture(t);
	for (const task_name of ["reviewer", "implementer", "reviewer_two", "reviewer_three"]) {
		await manager.spawn({ task_name, message: "Work", fork_turns: "none" }, defaults);
		children.at(-1)!.finish(`${task_name} done`);
	}
	assert.equal(manager.list().length, 4);
	assert.ok(manager.list().every(worker => worker.status === "idle"));
});

test("a rejected follow-up records its failure instead of leaving a phantom running turn", async t => {
	const { manager, children } = fixture(t);
	await manager.spawn({ task_name: "worker", message: "Start" }, defaults);
	children[0].finish();
	children[0].handle = command => {
		if (command.type !== "prompt" || command.message !== "Rejected") return false;
		children[0].reply(command, {}, "prompt rejected");
		return true;
	};
	await assert.rejects(manager.send("worker", "Rejected", true), /prompt rejected/);
	assert.equal(manager.list()[0].status, "error");
	assert.equal(manager.list()[0].results.at(-1)!.text, "prompt rejected");
	assert.deepEqual(children[0].kills, ["SIGTERM"]);
});
