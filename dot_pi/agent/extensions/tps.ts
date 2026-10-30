/**
 * TPS Extension
 *
 * Shows generation speed (tokens per second) inline on the status line: the
 * footer stats row, right after the model name.
 *
 * Why a custom footer: ctx.ui.setStatus() renders extension statuses on their
 * own footer line. To keep the readout inline we compose pi's exported
 * FooterComponent (the built-in footer) and append the TPS text to its stats
 * row (row 1; row 0 is the cwd row).
 *
 * While streaming, the readout is a live estimate (~N tok/s) derived from
 * streamed characters, because providers report exact token counts only when
 * a response finishes. The final readout uses the exact usage.output count
 * over the full response time (including time to first token). Run /tps for
 * the details of the last measurement.
 *
 * Known approximations in the composed footer: the "(auto)" compaction
 * indicator uses FooterComponent's default and the "(sub)" cost suffix is
 * derived from ExtensionContext instead of pi's internal model runtime.
 */

import {
	FooterComponent,
	type ExtensionAPI,
	type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

const WINDOW_MS = 3000; // rolling window for the live rate
const RENDER_INTERVAL_MS = 200; // throttle footer updates during streaming
const FULL_LABEL_MIN_WIDTH = 70; // below this, use the compact "N/s" label

// Rough chars-per-token heuristic: CJK text is ~1 token/char, Latin ~4 chars/token.
const CJK = /[\u3000-\u303f\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f]/g;

interface Measurement {
	tps: number;
	tokens: number;
	seconds: number;
	exact: boolean;
}

function estimateTokens(text: string): number {
	const cjk = text.match(CJK)?.length ?? 0;
	return cjk + Math.ceil((text.length - cjk) / 4);
}

function formatCount(n: number): string {
	return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n));
}

// Live state read by the footer renderer and written by event handlers.
let enabled = true;
let startedAt = 0;
let firstTokenAt = 0;
let estTokens = 0;
let samples: { t: number; tokens: number }[] = [];
let lastRenderAt = 0;
let streamingView: { tps: number | undefined } | null = null;
let lastMeasurement: Measurement | null = null;

// The footer component outlives any single event context, so it reads these.
let ctxRef: ExtensionContext | undefined;
let requestRender: (() => void) | undefined;

function resetMeasurement() {
	startedAt = 0;
	firstTokenAt = 0;
	estTokens = 0;
	lastRenderAt = 0;
	samples = [];
}

function rollingTps(now: number): number | null {
	while (samples.length > 2 && now - samples[0].t > WINDOW_MS) samples.shift();
	const first = samples[0];
	const last = samples[samples.length - 1];
	const dt = (last.t - first.t) / 1000;
	return dt > 0.2 ? (last.tokens - first.tokens) / dt : null;
}

function finish(exactTokens: number, now: number) {
	if (!startedAt) return;
	const tokens = exactTokens > 0 ? exactTokens : estTokens;
	const seconds = (now - startedAt) / 1000;
	lastMeasurement = tokens > 0 && seconds > 0
		? { tokens, seconds, tps: tokens / seconds, exact: exactTokens > 0 }
		: null;
	streamingView = null;
	resetMeasurement();
	requestRender?.();
}

/**
 * Compose the built-in footer and append the TPS readout to its stats row.
 *
 * FooterComponent's constructor takes pi's internal AgentSession, which
 * extensions don't receive. Its render only reads model/thinking state,
 * context usage, the session manager, and subscription status — all reachable
 * from ExtensionContext — so we adapt that surface.
 */
function installFooter(ctx: ExtensionContext) {
	ctx.ui.setFooter((tui, theme, footerData) => {
		requestRender = () => tui.requestRender();

		const session = {
			get state() {
				return { model: ctxRef?.model, thinkingLevel: ctxRef?.thinkingLevel };
			},
			get sessionManager() {
				return ctxRef!.sessionManager;
			},
			getContextUsage: () => ctxRef?.getContextUsage(),
			modelRuntime: {
				isUsingSubscription: (providerId: string): boolean => {
					const model = ctxRef?.model;
					if (!model || model.provider !== providerId) return false;
					return (
						ctxRef!.modelRegistry.isUsingOAuth(model) &&
						ctxRef!.modelRegistry.getProvider(providerId)?.auth.oauth?.isSubscription === true
					);
				},
			},
		} as unknown as ConstructorParameters<typeof FooterComponent>[0];
		const inner = new FooterComponent(session, footerData);

		function buildStatus(compact: boolean): string | undefined {
			if (!enabled) return undefined;
			if (streamingView) {
				const tps = streamingView.tps;
				const rate = tps === undefined
					? "…"
					: compact ? `~${Math.round(tps)}/s` : `~${Math.round(tps)} tok/s`;
				return theme.fg("accent", "⚡") + " " + theme.fg("dim", rate);
			}
			if (lastMeasurement) {
				const m = lastMeasurement;
				const est = m.exact ? "" : "~";
				const rate = compact
					? `${est}${Math.round(m.tps)}/s`
					: `${est}${Math.round(m.tps)} tok/s`;
				const mark = m.exact ? theme.fg("success", "✓") : theme.fg("accent", "✓");
				return mark + " " + theme.fg("dim", rate);
			}
			return undefined;
		}

		return {
			invalidate: () => inner.invalidate(),
			dispose: () => {
				inner.dispose();
				requestRender = undefined;
			},
			render(width: number): string[] {
				const status = buildStatus(width < FULL_LABEL_MIN_WIDTH);
				if (!status) return inner.render(width);
				const text = theme.fg("dim", " • ") + status;
				// Render the built-in footer narrower and claim the last columns
				// for the TPS readout so both stay on one line.
				const lines = inner.render(Math.max(16, width - visibleWidth(text)));
				const row = Math.min(1, lines.length - 1);
				lines[row] = truncateToWidth(lines[row] + text, width);
				return lines;
			},
		};
	});
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		ctxRef = ctx;
		if (ctx.mode === "tui") installFooter(ctx);
	});

	pi.on("message_start", async (event, ctx) => {
		ctxRef = ctx;
		resetMeasurement();
		streamingView = null;
		if (event.message.role !== "assistant") return;
		startedAt = Date.now();
		streamingView = { tps: undefined };
		requestRender?.();
	});

	pi.on("message_update", async (event, ctx) => {
		ctxRef = ctx;
		if (!startedAt) return;
		const e = event.assistantMessageEvent;
		if (e.type !== "text_delta" && e.type !== "thinking_delta" && e.type !== "toolcall_delta") return;
		const now = Date.now();
		if (!firstTokenAt) firstTokenAt = now;
		estTokens += estimateTokens(e.delta);
		samples.push({ t: now, tokens: estTokens });
		if (now - lastRenderAt < RENDER_INTERVAL_MS) return;
		lastRenderAt = now;
		const elapsed = Math.max(0.001, (now - firstTokenAt) / 1000);
		streamingView = { tps: rollingTps(now) ?? estTokens / elapsed };
		requestRender?.();
	});

	pi.on("message_end", async (event, ctx) => {
		ctxRef = ctx;
		if (!startedAt) return;
		const exact = event.message.role === "assistant" ? event.message.usage.output : 0;
		finish(exact, Date.now());
	});

	// Covers aborts/errors that end the run without a finished assistant message.
	pi.on("agent_end", async (_event, ctx) => {
		ctxRef = ctx;
		finish(0, Date.now());
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		resetMeasurement();
		streamingView = null;
		ctx.ui.setFooter(undefined);
	});

	pi.registerCommand("tps", {
		description: "Toggle the TPS readout and show the last measurement",
		handler: async (_name, ctx) => {
			enabled = !enabled;
			requestRender?.();
			const m = lastMeasurement;
			const detail = m
				? `last: ${m.exact ? "" : "~"}${Math.round(m.tps)} tok/s (${formatCount(m.tokens)} tok in ${m.seconds.toFixed(1)}s, ${m.exact ? "exact" : "estimated"})`
				: "no measurement yet";
			ctx.ui.notify(`TPS readout ${enabled ? "on" : "off"} — ${detail}`, "info");
		},
	});
}
