/**
 * Persistent Pi workers for the collaboration extension. AgentManager starts isolated
 * RPC sessions, serializes commands per worker, retains bounded results, and notifies
 * the parent when a run settles. Construct one manager per parent session, call spawn
 * with its cwd/model/thinking defaults, then send, interrupt, list, or wait for notices.
 * Always dispose it on session shutdown. Workers share files, not conversation state;
 * fork_turns=all supplies only the caller's bounded text snapshot. No roles are loaded.
 * New work is admitted only while fewer than three workers are tracked as active.
 * Independently started child-extension work is tracked but can exceed that limit.
 * The injectable launcher permits protocol/lifecycle tests without model requests.
 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import { basename } from "node:path";

export const CHILD_ENV = "PI_COLLABORATION_CHILD";
const MAX_WORKERS = 3;
const MAX_AGENTS = 24;
const TEXT_LIMIT = 16_000;
const FRAME_LIMIT = 8 * 1024 * 1024;
const RPC_TIMEOUT = 30_000;
const SHUTDOWN_GRACE = 1_000;
const RESULT_LIMIT = 8;
type RecordData = Record<string, any>;
export type WorkerStatus = "starting" | "running" | "idle" | "interrupted" | "error";
export interface AgentResult { status: WorkerStatus; text: string }
export interface AgentView { id: string; task_name: string; status: WorkerStatus; results: AgentResult[] }
export interface SpawnParams {
	task_name: string; message: string; fork_turns?: "all" | "none"; model?: string; reasoning_effort?: string;
}
export interface SpawnDefaults { cwd: string; model?: string; thinking?: string; parentContext?: string }
export interface Invocation { command: string; args: string[] }
export type Launcher = (invocation: Invocation, cwd: string, env: NodeJS.ProcessEnv) => ChildProcessWithoutNullStreams;
export interface ManagerOptions { launch?: Launcher; onNotice?: (agent: AgentView) => void }
interface Pending { resolve: (data: any) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }
interface Worker {
	view: AgentView; child: ChildProcessWithoutNullStreams; pending: Map<string, Pending>;
	queue: Promise<unknown>; buffer: string; stderr: string; lastText: string; runError?: string;
	stopping: boolean; nextId: number; activityVersion: number;
}

/** Bound text stored in memory and sent to the parent. Truncation is explicit. */
export function bounded(text: string, limit = TEXT_LIMIT): string {
	return text.length <= limit ? text : `${text.slice(0, limit)}\n[truncated]`;
}

/** Reuse the current Pi runtime, including compiled binaries, before falling back to PATH. */
export function getPiInvocation(args: string[]): Invocation {
	const script = process.argv[1];
	if (script && !script.startsWith("/$bunfs/root/") && existsSync(script)) {
		return { command: process.execPath, args: [script, ...args] };
	}
	if (!/^(node|bun)(\.exe)?$/.test(basename(process.execPath).toLowerCase())) {
		return { command: process.execPath, args };
	}
	return { command: "pi", args };
}

/**
 * Retain up to 24 persistent children and reject new work admission when three are
 * tracked as active. Independently started extension work can exceed this admission
 * limit. Results survive mailbox reads until dispose.
 */
export class AgentManager {
	private workers = new Map<string, Worker>();
	private mailbox = new Set<string>();
	private waiters = new Set<() => void>();
	private disposed = false;
	private launch: Launcher;
	private options: ManagerOptions;
	/** Use the normal Pi subprocess launcher unless injected; onNotice receives result snapshots. */
	constructor(options: ManagerOptions = {}) {
		this.options = options;
		this.launch = options.launch ?? ((invocation, cwd, env) => spawn(invocation.command, invocation.args, {
			cwd, env, stdio: ["pipe", "pipe", "pipe"],
		}));
	}

	/**
	 * Start a named worker and return after prompt acceptance, before task completion.
	 * Model/thinking inherit defaults unless overridden; fork_turns defaults to all,
	 * adding a bounded text snapshot, while none excludes parent conversation text.
	 * Rejects invalid names, startup failures, or admission when three workers are
	 * already tracked as active. Child extensions can independently exceed this limit.
	 * Cancellation stops the child.
	 */
	async spawn(params: SpawnParams, defaults: SpawnDefaults, signal?: AbortSignal): Promise<AgentView> {
		this.assertOpen(signal);
		if (!/^[a-z][a-z0-9_]*$/.test(params.task_name)) throw new Error("task_name must use lowercase letters, digits, and underscores, starting with a letter.");
		const id = `/root/${params.task_name}`;
		if (this.workers.has(id)) throw new Error(`Task already exists: ${id}. Use followup_task.`);
		if (this.workers.size >= MAX_AGENTS) throw new Error(`Session limit is ${MAX_AGENTS} named agents; start a new session to reset.`);
		this.checkCapacity();
		const args = ["--mode", "rpc", "--no-session"];
		const model = params.model ?? defaults.model;
		if (model) args.push("--model", model);
		const thinking = params.reasoning_effort ?? defaults.thinking;
		if (thinking) {
			if (!["off", "minimal", "low", "medium", "high", "xhigh", "max"].includes(thinking)) throw new Error(`Unsupported Pi reasoning_effort: ${thinking}`);
			args.push("--thinking", thinking);
		}
		const child = this.launch(getPiInvocation(args), defaults.cwd, { ...process.env, [CHILD_ENV]: "1" });
		const worker: Worker = { view: { id, task_name: params.task_name, status: "starting", results: [] }, child,
			pending: new Map(), queue: Promise.resolve(), buffer: "", stderr: "", lastText: "", stopping: false, nextId: 0, activityVersion: 0 };
		this.workers.set(id, worker);
		child.stdout.setEncoding("utf8");
		child.stderr.setEncoding("utf8");
		child.stdout.on("data", chunk => this.read(worker, String(chunk)));
		child.stderr.on("data", chunk => { worker.stderr = bounded(worker.stderr + String(chunk)); });
		child.on("error", error => this.fail(worker, error));
		child.stdin.on("error", error => this.fail(worker, error));
		child.on("exit", (code, exitSignal) => {
			if (!worker.stopping) this.fail(worker, new Error(`Pi exited unexpectedly (${exitSignal ?? code}). ${worker.stderr}`));
		});
		const identity = `You are collaboration worker ${id}. Work in the shared working directory. Report your result in your final response. You cannot spawn further workers.`;
		const inherited = params.fork_turns !== "none" && defaults.parentContext
			? `\n\nParent conversation text snapshot (bounded; not a native session fork):\n${bounded(defaults.parentContext)}\n\nEnd parent snapshot.` : "";
		try {
			await this.withSignal(worker, signal, async () => {
				await this.request(worker, { type: "get_state" });
				await this.prompt(worker, `${identity}${inherited}\n\nTask:\n${params.message}`);
			});
			return this.snapshot(worker);
		} catch (error) {
			this.fail(worker, error instanceof Error ? error : new Error(String(error)));
			throw error;
		}
	}

	/**
	 * Address a worker by short name or canonical /root/name. Normal messages steer
	 * active work and queue without starting idle work; followUp starts an idle worker
	 * or steers active work. Starting idle work rejects when three workers are tracked
	 * as active; independent child-extension work can exceed that admission limit.
	 * Returns after command acceptance. Cancellation stops the
	 * child immediately, including while this command waits behind an earlier command.
	 */
	async send(target: string, message: string, followUp = false, signal?: AbortSignal): Promise<AgentView> {
		const worker = this.find(target);
		return this.withSignal(worker, signal, () => this.serialize(worker, async () => {
			this.assertOpen(signal);
			if (worker.stopping) throw new Error(`Worker is unavailable: ${worker.view.id}`);
			if (followUp) {
				if (worker.view.status !== "running") this.checkCapacity();
				await this.prompt(worker, message);
			}
			else await this.request(worker, { type: "steer", message });
			return this.snapshot(worker);
		}));
	}

	/**
	 * Clear queued work and abort a short-name or canonical-ID target; return once idle.
	 * The child remains reusable unless this command fails or is cancelled. Cancellation
	 * stops the child immediately, including while waiting behind another command.
	 */
	async interrupt(target: string, signal?: AbortSignal): Promise<AgentView> {
		const worker = this.find(target);
		return this.withSignal(worker, signal, () => this.serialize(worker, async () => {
			this.assertOpen(signal);
			if (worker.stopping) throw new Error(`Worker is unavailable: ${worker.view.id}`);
			await this.request(worker, { type: "clear_queue" });
			await this.request(worker, { type: "abort" });
			return this.snapshot(worker);
		}));
	}

	/** Return snapshots and the last eight bounded results; optionally filter by canonical task-path prefix. */
	list(pathPrefix?: string): AgentView[] {
		return [...this.workers.values()].filter(w => !pathPrefix || w.view.id === pathPrefix || w.view.id.startsWith(`${pathPrefix}/`)).map(w => this.snapshot(w));
	}

	/**
	 * Wait up to timeoutMs (default 30,000; range 10,000–3,600,000) for notice IDs.
	 * Consumes those IDs; list() retains results. Cancellation rejects only this wait
	 * and leaves children running. Disposal wakes waiting callers without a notice.
	 */
	async wait(timeoutMs = 30_000, signal?: AbortSignal): Promise<{ updated: string[]; timed_out: boolean }> {
		this.assertOpen(signal);
		if (!Number.isFinite(timeoutMs) || timeoutMs < 10_000 || timeoutMs > 3_600_000) throw new Error("timeout_ms must be between 10000 and 3600000.");
		if (!this.mailbox.size) await new Promise<void>((resolve, reject) => {
			const finish = () => { cleanup(); resolve(); };
			const cancel = () => { cleanup(); reject(new Error("Wait cancelled.")); };
			const timer = setTimeout(finish, timeoutMs);
			const cleanup = () => { clearTimeout(timer); this.waiters.delete(finish); signal?.removeEventListener("abort", cancel); };
			this.waiters.add(finish);
			signal?.addEventListener("abort", cancel, { once: true });
		});
		const updated = [...this.mailbox];
		this.mailbox.clear();
		return { updated, timed_out: updated.length === 0 };
	}

	/** Stop all workers and suppress late parent notifications. Safe to call repeatedly. */
	async dispose(): Promise<void> {
		this.disposed = true;
		for (const worker of this.workers.values()) this.stop(worker, new Error("Parent session closed."));
		for (const wake of [...this.waiters]) wake();
		this.mailbox.clear();
	}

	private assertOpen(signal?: AbortSignal) {
		if (this.disposed) throw new Error("Collaboration session is closed.");
		if (signal?.aborted) throw new Error("Operation cancelled.");
	}
	private checkCapacity() {
		const active = [...this.workers.values()].filter(w => !w.stopping && ["starting", "running"].includes(w.view.status)).length;
		if (active >= MAX_WORKERS) throw new Error(`At most ${MAX_WORKERS} active workers may be admitted through collaboration commands. Wait for one to finish.`);
	}
	private find(target: string): Worker {
		this.assertOpen();
		const worker = this.workers.get(target.startsWith("/") ? target : `/root/${target}`);
		if (!worker) throw new Error(`Unknown worker: ${target}`);
		return worker;
	}
	private snapshot(worker: Worker): AgentView { return { ...worker.view, results: worker.view.results.map(result => ({ ...result })) }; }
	private serialize<T>(worker: Worker, operation: () => Promise<T>): Promise<T> {
		const result = worker.queue.then(operation);
		worker.queue = result.catch(() => undefined);
		return result;
	}
	private async withSignal<T>(worker: Worker, signal: AbortSignal | undefined, operation: () => Promise<T>): Promise<T> {
		this.assertOpen(signal);
		let rejectCancellation!: (error: Error) => void;
		const cancellation = new Promise<never>((_resolve, reject) => { rejectCancellation = reject; });
		const abort = () => {
			const error = new Error("Operation cancelled; worker stopped.");
			this.fail(worker, error);
			rejectCancellation(error);
		};
		signal?.addEventListener("abort", abort, { once: true });
		try { return await Promise.race([operation(), cancellation]); }
		finally { signal?.removeEventListener("abort", abort); }
	}
	private async prompt(worker: Worker, message: string) {
		const wasRunning = worker.view.status === "running";
		const previousActivity = worker.activityVersion;
		worker.view.status = "running";
		worker.lastText = "";
		worker.runError = undefined;
		try {
			const data = await this.request(worker, { type: "prompt", message, streamingBehavior: "steer" });
			if (data?.disposition === "handled") {
				// A command may start its own run. Events win over a potentially older state reply.
				const activityAtQuery = worker.activityVersion;
				const state = await this.request(worker, { type: "get_state" });
				if (worker.activityVersion !== activityAtQuery) return;
				if (state?.isStreaming) {
					worker.view.status = "running";
				} else if (!wasRunning && worker.activityVersion === previousActivity) {
					this.complete(worker, "idle", "Prompt handled by a child extension; session is currently idle.");
				}
			}
		} catch (error) {
			this.fail(worker, error instanceof Error ? error : new Error(String(error)));
			throw error;
		}
	}
	private request(worker: Worker, command: RecordData): Promise<any> {
		if (worker.stopping) return Promise.reject(new Error(`Worker stopped: ${worker.view.id}`));
		const id = String(++worker.nextId);
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => this.fail(worker, new Error(`RPC ${command.type} timed out. ${worker.stderr}`)), RPC_TIMEOUT);
			worker.pending.set(id, { resolve, reject, timer });
			worker.child.stdin.write(`${JSON.stringify({ ...command, id })}\n`, error => { if (error) this.fail(worker, error); });
		});
	}
	private read(worker: Worker, chunk: string) {
		if (worker.stopping || this.disposed) return;
		worker.buffer += chunk;
		let newline: number;
		while ((newline = worker.buffer.indexOf("\n")) >= 0) {
			const line = worker.buffer.slice(0, newline).replace(/\r$/, "");
			worker.buffer = worker.buffer.slice(newline + 1);
			if (!line) continue;
			if (line.length > FRAME_LIMIT) { this.fail(worker, new Error("RPC record exceeds 8 MiB.")); return; }
			try { this.record(worker, JSON.parse(line)); }
			catch (error) { this.fail(worker, new Error(`Invalid RPC record: ${String(error)}`)); return; }
		}
		if (worker.buffer.length > FRAME_LIMIT) this.fail(worker, new Error("Unterminated RPC record exceeds 8 MiB."));
	}
	private record(worker: Worker, record: RecordData) {
		if (worker.stopping || this.disposed) return;
		if (record.type === "response") {
			const pending = worker.pending.get(record.id);
			if (!pending) return;
			clearTimeout(pending.timer);
			worker.pending.delete(record.id);
			if (record.success) pending.resolve(record.data);
			else pending.reject(new Error(bounded(record.error ?? "RPC command failed.")));
		} else if (record.type === "agent_start") {
			worker.activityVersion++;
			if (worker.view.status !== "running") {
				worker.lastText = "";
				worker.runError = undefined;
			}
			worker.view.status = "running";
		} else if (record.type === "extension_ui_request" && ["select", "confirm", "input", "editor"].includes(record.method)) {
			this.fail(worker, new Error(`Worker requires interactive ${record.method}: ${bounded(String(record.title ?? ""))}. Run this action in the parent session.`));
		} else if (record.type === "message_end" && record.message?.role === "assistant") {
			const message = record.message;
			worker.lastText = bounded((message.content ?? []).filter((part: RecordData) => part.type === "text").map((part: RecordData) => part.text).join("\n"));
			worker.runError = message.stopReason === "error" ? bounded(message.errorMessage ?? "Provider error.") : undefined;
		} else if (record.type === "agent_settled" && worker.view.status === "running") {
			worker.activityVersion++;
			this.complete(worker, worker.runError ? "error" : record.aborted ? "interrupted" : "idle", worker.runError ?? (worker.lastText || "(no text output)"));
		}
	}
	private complete(worker: Worker, status: WorkerStatus, text: string) {
		worker.view.status = status;
		worker.view.results.push({ status, text: bounded(text) });
		worker.view.results = worker.view.results.slice(-RESULT_LIMIT);
		if (this.disposed) return;
		this.mailbox.add(worker.view.id);
		for (const wake of [...this.waiters]) wake();
		try { this.options.onNotice?.(this.snapshot(worker)); } catch { /* Results remain available through list(). */ }
	}
	private fail(worker: Worker, error: Error) {
		if (worker.stopping) return;
		this.stop(worker, error);
		this.complete(worker, "error", error.message);
	}
	private stop(worker: Worker, error: Error) {
		if (worker.stopping) return;
		worker.stopping = true;
		for (const pending of worker.pending.values()) { clearTimeout(pending.timer); pending.reject(error); }
		worker.pending.clear();
		worker.child.stdin.end();
		worker.child.kill("SIGTERM");
		const timer = setTimeout(() => { if (worker.child.exitCode === null && worker.child.signalCode === null) worker.child.kill("SIGKILL"); }, SHUTDOWN_GRACE);
		timer.unref();
		worker.child.once("exit", () => clearTimeout(timer));
	}
}
