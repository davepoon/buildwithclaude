import type { RateLimits } from "./types.js";
export interface DbTelemetry {
    rateLimits: RateLimits;
    model: string | null;
    /** Reasoning effort (from ~/.codex/config.toml), e.g. "xhigh". */
    effort: string | null;
    /** Epoch ms of the log row that carried the snapshot. */
    timestampMs: number;
}
/**
 * Newest rate-limit snapshot Codex logged to ~/.codex/logs_2.sqlite, or null.
 * Memoized for the process lifetime (one statusline render).
 */
export declare function readDbTelemetry(): DbTelemetry | null;
