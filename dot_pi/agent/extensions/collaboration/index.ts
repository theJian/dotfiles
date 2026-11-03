/**
 * Pi extension exposing Codex-style collaboration through six underscore-named tools.
 * Pi discovers this directory's index.ts; /reload activates it in an existing session.
 * Begin with collaboration_spawn_agent({task_name, message}); use fork_turns="none"
 * for a clean review. Observe automatic results, collaboration_list_agents, or
 * collaboration_wait_agent. Continue with collaboration_followup_task; steer without
 * starting idle work via collaboration_send_message, or stop current work with
 * collaboration_interrupt_agent.
 * Tools delegate arbitrary tasks to persistent RPC children with the parent's model,
 * thinking level, and cwd. Completion notices resume the parent through a follow-up.
 * AgentManager owns process/protocol details; this module owns schemas, parent text
 * snapshots, and session lifecycle. Children load normal Pi resources but cannot
 * register these delegation tools, limiting delegation to one level. New work is
 * admitted while fewer than three workers are tracked as active; independent child
 * extensions can start additional work beyond that admission limit.
 * All workers share files; clean-context reviews require fork_turns="none".
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { AgentManager, bounded, CHILD_ENV } from "./manager.ts";

const GUIDANCE = `Collaboration is available through native Pi tools. When a skill says collaboration.spawn_agent, call collaboration_spawn_agent; likewise map collaboration.send_message, collaboration.followup_task, collaboration.list_agents, collaboration.interrupt_agent, and collaboration.wait_agent to their underscore-named tools. Delegate arbitrary tasks without role files. Use fork_turns="none" for an independent reviewer and provide all necessary context in message. fork_turns="all" (default) includes only a bounded parent text snapshot, not a native session fork. Children share your working directory and edits. Spawning or starting idle work is rejected while three workers are tracked as active. Independent child-extension work is tracked but can exceed this admission limit. Idle children retain their context. Up to 24 named children exist per parent session. Reuse them with followup_task. Children cannot delegate further. Send messages to idle agents queue without starting a turn; followup_task starts an idle agent and steers an active agent promptly. Completion/error notices arrive automatically as follow-ups; list_agents retains the latest eight bounded results per agent. wait_agent consumes notice IDs, not results. User cancellation of a spawn/send/interrupt command stops the affected child; cancellation of wait only stops waiting. Child processes use normal Pi trust and tool settings; interactive child dialogs fail explicitly and must be handled in the parent.`;
const target = Type.String({ minLength: 1, description: "Task name or canonical /root/task_name." });
const message = Type.String({ minLength: 1, description: "Self-contained task or message for the child." });
const result = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }], details: value });

/** Register tools in the parent; child sessions deliberately expose no collaboration tools. */
export default function collaboration(pi: ExtensionAPI) {
	if (process.env[CHILD_ENV]) return;
	let parentContext = "";
	let manager = createManager();
	function createManager() {
		return new AgentManager({ onNotice: agent => {
			pi.sendMessage({ customType: "collaboration", content: `Collaboration update from ${agent.id}:\n${JSON.stringify(agent.results.at(-1))}`, display: true, details: agent },
				{ deliverAs: "followUp", triggerTurn: true });
		} });
	}
	pi.on("context", event => {
		parentContext = bounded(event.messages.map(entry => {
			const content = "content" in entry ? entry.content : "";
			const text = typeof content === "string" ? content : Array.isArray(content)
				? content.filter(part => part.type === "text").map(part => "text" in part ? part.text : "").join("\n") : "";
			return `${entry.role}: ${text}`;
		}).join("\n\n"));
	});
	pi.on("before_agent_start", event => ({ systemPrompt: `${event.systemPrompt}\n\n${GUIDANCE}` }));
	pi.on("session_shutdown", async () => { await manager.dispose(); parentContext = ""; });
	pi.on("session_start", async () => { await manager.dispose(); manager = createManager(); parentContext = ""; });
	pi.registerTool({
		name: "collaboration_spawn_agent", label: "Spawn agent", description: "Start a persistent child Pi agent on a delegated task. Returns its canonical ID immediately after prompt acceptance.",
		parameters: Type.Object({ task_name: Type.String({ pattern: "^[a-z][a-z0-9_]*$" }), message,
			fork_turns: Type.Optional(Type.Union([Type.Literal("all"), Type.Literal("none")])), model: Type.Optional(Type.String({ minLength: 1 })),
			reasoning_effort: Type.Optional(Type.String({ description: "Pi level: off, minimal, low, medium, high, xhigh, max. Defaults to parent." })) }),
		async execute(_id, params, signal, _update, ctx) {
			return result(await manager.spawn(params, { cwd: ctx.cwd, model: ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : undefined,
				thinking: ctx.thinkingLevel ?? pi.getThinkingLevel(), parentContext }, signal));
		},
	});
	pi.registerTool({ name: "collaboration_send_message", label: "Message agent", description: "Steer a running child. Queue a message without starting a turn if idle.",
		parameters: Type.Object({ target, message }), async execute(_id, params, signal) { return result(await manager.send(params.target, params.message, false, signal)); } });
	pi.registerTool({ name: "collaboration_followup_task", label: "Follow up with agent", description: "Give an existing child a new task; starts a turn if idle, steers promptly if running.",
		parameters: Type.Object({ target, message }), async execute(_id, params, signal) { return result(await manager.send(params.target, params.message, true, signal)); } });
	pi.registerTool({ name: "collaboration_list_agents", label: "List agents", description: "List child states and retained results. Optional canonical task-path prefix filters the list.",
		parameters: Type.Object({ path_prefix: Type.Optional(Type.String()) }), async execute(_id, params) { return result(manager.list(params.path_prefix)); } });
	pi.registerTool({ name: "collaboration_interrupt_agent", label: "Interrupt agent", description: "Clear pending child messages and abort its current work; preserve the child for another task.",
		parameters: Type.Object({ target }), async execute(_id, params, signal) { return result(await manager.interrupt(params.target, signal)); } });
	pi.registerTool({ name: "collaboration_wait_agent", label: "Wait for agents", description: "Wait for a completion/error mailbox update or timeout. Consumes notice IDs; full bounded results remain in list_agents.",
		parameters: Type.Object({ timeout_ms: Type.Optional(Type.Integer({ minimum: 10000, maximum: 3600000 })) }),
		async execute(_id, params, signal) { return result(await manager.wait(params.timeout_ms, signal)); } });
}
