/**
 * TPS Extension
 *
 * Shows generation speed (tokens per second) in pi's working row — the line
 * pi displays while the assistant works ("⠋ Working"). While tokens stream
 * in, the working message becomes "Working ⚡ ~N tok/s"; when the assistant
 * message ends, the working row shows its rate, exact when usage is available.
 * The finished run reports the rate of its most recent measurable message
 * once as a chat notification.
 *
 * While streaming, the readout is a live estimate (~N tok/s) derived from
 * streamed characters, because providers report exact token counts only when
 * a response finishes. The exact rate uses usage.output over the full
 * response time (including time to first token). Run /tps to toggle the
 * readout and to see the details of the last measurement.
 * Pi loads the default export to register measurement listeners and /tps;
 * the working-row readout requires its interactive terminal UI.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const WINDOW_MS = 3000; // rolling window for the live rate
const MIN_SAMPLE_MS = 200; // minimum span of streamed text before a rate is meaningful
const UPDATE_INTERVAL_MS = 200; // throttle working-message updates during streaming

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
	return cjk + (text.length - cjk) / 4;
}

function formatCount(n: number): string {
	return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n));
}

/** Rate label; the "~" marks an estimate derived from streamed characters. */
function formatRate(tps: number, exact: boolean): string {
	return `${exact ? "" : "~"}${Math.round(tps)} tok/s`;
}

// Live state, written by the event handlers and read by the /tps command.
let enabled = true;
let startedAt = 0;
let firstTokenAt = 0;
let estTokens = 0;
let samples: { t: number; tokens: number }[] = [];
let lastUpdateAt = 0;
let lastMeasurement: Measurement | null = null; // most recent one, for /tps
let pendingReport: Measurement | null = null; // finished during the current run
let ownsWorkingMessage = false; // true while the working row shows our readout

function resetMeasurement() {
	startedAt = 0;
	firstTokenAt = 0;
	estTokens = 0;
	lastUpdateAt = 0;
	samples = [];
}

/**
 * Live rate in tokens per second, or null while there is too little streamed
 * text to say anything meaningful. Uses the rolling window when it spans
 * enough time, and the average since the first token otherwise.
 */
function liveTps(now: number): number | null {
	if (!firstTokenAt) return null;
	const elapsed = now - firstTokenAt;
	if (elapsed < MIN_SAMPLE_MS) return null;
	while (samples.length > 2 && now - samples[0].t > WINDOW_MS) samples.shift();
	const first = samples[0];
	const last = samples[samples.length - 1];
	const window = last.t - first.t;
	return window >= MIN_SAMPLE_MS
		? (last.tokens - first.tokens) / (window / 1000)
		: estTokens / (elapsed / 1000);
}

/**
 * Write the readout into pi's working row. The row is on screen only while
 * the assistant works, so the message doubles as the live readout during
 * streaming and as the last known rate in between messages.
 */
function showRate(ctx: ExtensionContext, rate: string) {
	if (!enabled) return;
	const theme = ctx.ui.theme;
	const bolt = theme.fg("accent", "⚡");
	ctx.ui.setWorkingMessage(`Working ${bolt} ${theme.fg("dim", rate)}`);
	ownsWorkingMessage = true;
}

/** Restore pi's default working message, but only if the readout owns it. */
function restoreWorkingMessage(ctx: ExtensionContext) {
	if (!ownsWorkingMessage) return;
	ctx.ui.setWorkingMessage();
	ownsWorkingMessage = false;
}

/**
 * Record the rate of a finished assistant message and show it in the working
 * row. The provider's exact output token count is used when available;
 * otherwise the streamed estimate stands in.
 */
function completeMessage(ctx: ExtensionContext, exactTokens: number, now: number) {
	if (!startedAt) return;
	const tokens = exactTokens > 0 ? exactTokens : estTokens;
	const seconds = (now - startedAt) / 1000;
	const measurement = tokens > 0 && seconds > 0
		? { tokens, seconds, tps: tokens / seconds, exact: exactTokens > 0 }
		: null;
	resetMeasurement();
	if (!measurement) return;
	lastMeasurement = measurement;
	pendingReport = measurement;
	showRate(ctx, formatRate(measurement.tps, measurement.exact));
}

/** Report the run's most recent measurable message once as a chat notification. */
function reportRun(ctx: ExtensionContext) {
	const measurement = pendingReport;
	pendingReport = null;
	if (!measurement || !enabled) return;
	const bolt = ctx.ui.theme.fg("accent", "⚡");
	ctx.ui.notify(
		`${bolt} ${formatRate(measurement.tps, measurement.exact)} — ${formatCount(measurement.tokens)} tok in ${measurement.seconds.toFixed(1)}s`,
		"info",
	);
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, _ctx) => {
		resetMeasurement();
		lastMeasurement = null;
		pendingReport = null;
	});

	pi.on("message_start", async (event, ctx) => {
		resetMeasurement();
		if (event.message.role !== "assistant") return;
		// message_start can arrive after HTTP headers; the timestamp includes that wait.
		startedAt = event.message.timestamp;
	});

	pi.on("message_update", async (event, ctx) => {
		if (!startedAt) return;
		const e = event.assistantMessageEvent;
		if (e.type !== "text_delta" && e.type !== "thinking_delta" && e.type !== "toolcall_delta") return;
		const now = Date.now();
		if (!firstTokenAt) firstTokenAt = now;
		estTokens += estimateTokens(e.delta);
		samples.push({ t: now, tokens: estTokens });
		if (now - lastUpdateAt < UPDATE_INTERVAL_MS) return;
		lastUpdateAt = now;
		const rate = liveTps(now);
		if (rate === null) return;
		showRate(ctx, formatRate(rate, false));
	});

	pi.on("message_end", async (event, ctx) => {
		if (event.message.role !== "assistant") return;
		completeMessage(ctx, event.message.usage.output, Date.now());
	});

	pi.on("agent_end", async (_event, ctx) => {
		reportRun(ctx);
		restoreWorkingMessage(ctx);
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		resetMeasurement();
		lastMeasurement = null;
		pendingReport = null;
		restoreWorkingMessage(ctx);
	});

	pi.registerCommand("tps", {
		description: "Toggle the TPS readout and show the last measurement",
		handler: async (_name, ctx) => {
			enabled = !enabled;
			if (!enabled) restoreWorkingMessage(ctx);
			const m = lastMeasurement;
			const detail = m
				? `last: ${formatRate(m.tps, m.exact)} (${formatCount(m.tokens)} tok in ${m.seconds.toFixed(1)}s, ${m.exact ? "exact" : "estimated"})`
				: "no measurement yet";
			ctx.ui.notify(`TPS readout ${enabled ? "on" : "off"} — ${detail}`, "info");
		},
	});
}
