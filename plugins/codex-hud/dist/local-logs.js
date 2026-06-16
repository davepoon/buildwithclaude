import { readdirSync, readFileSync, existsSync, openSync, readSync, closeSync, statSync, } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { readDbTelemetry } from "./codex-db.js";
// Files at or below this size are read whole; larger ones are tail-read.
// total_token_usage is cumulative, so only the LAST token_count per file
// matters — full-parsing a multi-MB active session on every statusline
// render (60s timer + every assistant message) is wasted work.
const FULL_READ_LIMIT = 256 * 1024;
// Tail windows widened in order until a token_count with usage is found.
const TAIL_WINDOWS = [64 * 1024, 1024 * 1024, 8 * 1024 * 1024];
function getSessionsDir() {
    return join(homedir(), ".codex", "sessions");
}
function dayDir(daysAgo) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    const yyyy = d.getFullYear().toString();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return join(getSessionsDir(), yyyy, mm, dd);
}
function listLogs(dir) {
    if (!existsSync(dir))
        return [];
    try {
        return readdirSync(dir)
            .filter((entry) => entry.endsWith(".jsonl"))
            .map((entry) => join(dir, entry));
    }
    catch {
        return []; // skip unreadable dirs
    }
}
export function findSessionLogs(range) {
    let daysBack;
    switch (range) {
        case "today":
            daysBack = 0;
            break;
        case "week":
            daysBack = 6;
            break;
        case "month":
            daysBack = 29;
            break;
    }
    const files = [];
    for (let i = 0; i <= daysBack; i++) {
        files.push(...listLogs(dayDir(i)));
    }
    return files;
}
function parseEntryTimestamp(entry) {
    const ts = typeof entry.timestamp === "string" ? Date.parse(entry.timestamp) : NaN;
    return Number.isNaN(ts) ? null : ts;
}
function scanLines(content) {
    const result = {
        lastUsage: null,
        lastRateLimits: null,
        rlTimestamp: null,
        model: null,
        effort: null,
        modelTimestamp: null,
        contextUsed: null,
        contextWindow: null,
        contextTimestamp: null,
    };
    for (const line of content.split("\n")) {
        if (!line.trim())
            continue;
        try {
            const entry = JSON.parse(line);
            if (entry.type === "turn_context" && entry.payload) {
                if (typeof entry.payload.model === "string") {
                    result.model = entry.payload.model;
                    result.effort =
                        typeof entry.payload.effort === "string"
                            ? entry.payload.effort
                            : null;
                    result.modelTimestamp = parseEntryTimestamp(entry);
                }
            }
            if (entry.type === "event_msg" && entry.payload?.type === "token_count") {
                if (entry.payload.info?.total_token_usage) {
                    result.lastUsage = entry.payload.info.total_token_usage;
                }
                // Context occupancy: what the last turn sent + received.
                const last = entry.payload.info?.last_token_usage;
                if (last && typeof last.input_tokens === "number") {
                    result.contextUsed = last.input_tokens + (last.output_tokens ?? 0);
                    result.contextWindow =
                        typeof entry.payload.info?.model_context_window === "number"
                            ? entry.payload.info.model_context_window
                            : null;
                    result.contextTimestamp = parseEntryTimestamp(entry);
                }
                if (entry.payload.rate_limits) {
                    result.lastRateLimits = entry.payload.rate_limits;
                    result.rlTimestamp = parseEntryTimestamp(entry);
                }
            }
        }
        catch {
            // skip malformed lines (including a truncated line at a tail boundary
            // or the in-progress last line of an actively written file)
        }
    }
    return result;
}
function readTailContent(filePath, size, bytes) {
    const fd = openSync(filePath, "r");
    try {
        const start = size - bytes; // caller guarantees bytes < size
        const buf = Buffer.alloc(bytes);
        const read = readSync(fd, buf, 0, bytes, start);
        const text = buf.toString("utf-8", 0, read);
        // Drop the (likely partial) first line; this also neutralizes a
        // multi-byte UTF-8 sequence split at the window boundary.
        const nl = text.indexOf("\n");
        return nl >= 0 ? text.slice(nl + 1) : "";
    }
    finally {
        closeSync(fd);
    }
}
function scanFile(filePath, size) {
    if (size <= FULL_READ_LIMIT) {
        return scanLines(readFileSync(filePath, "utf-8"));
    }
    for (const window of TAIL_WINDOWS) {
        if (window >= size)
            break; // window covers the whole file: full-read below
        const result = scanLines(readTailContent(filePath, size, window));
        if (result.lastUsage)
            return result;
    }
    // No token_count found in any tail window — degrade to the full read.
    return scanLines(readFileSync(filePath, "utf-8"));
}
export function parseSessionLog(filePath) {
    const dateMatch = filePath.match(/(\d{4})\/(\d{2})\/(\d{2})/);
    const date = dateMatch
        ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`
        : "unknown";
    const session = {
        totalUsage: null,
        rateLimits: null,
        rlTimestamp: null,
        model: null,
        effort: null,
        modelTimestamp: null,
        contextUsed: null,
        contextWindow: null,
        contextTimestamp: null,
        date,
        filePath,
    };
    try {
        const { size, mtimeMs } = statSync(filePath);
        const scan = scanFile(filePath, size);
        session.totalUsage = scan.lastUsage;
        session.rateLimits = scan.lastRateLimits;
        session.rlTimestamp = scan.rlTimestamp ?? (scan.lastRateLimits ? mtimeMs : null);
        session.model = scan.model;
        session.effort = scan.effort;
        session.modelTimestamp = scan.modelTimestamp ?? (scan.model ? mtimeMs : null);
        session.contextUsed = scan.contextUsed;
        session.contextWindow = scan.contextWindow;
        session.contextTimestamp =
            scan.contextTimestamp ?? (scan.contextUsed != null ? mtimeMs : null);
    }
    catch {
        // skip unreadable files
    }
    return session;
}
function emptyUsage() {
    return {
        input_tokens: 0,
        cached_input_tokens: 0,
        output_tokens: 0,
        reasoning_output_tokens: 0,
        total_tokens: 0,
    };
}
export function aggregateLocalUsage(range) {
    const files = findSessionLogs(range).sort();
    const sessions = [];
    const totals = emptyUsage();
    let latestRateLimits = null;
    let latestRlTimestamp = -Infinity;
    let latestModel = null;
    let latestModelTimestamp = -Infinity;
    let latestContext = null;
    let latestContextTimestamp = -Infinity;
    // Rate limits, model, and context are point-in-time snapshots, so pick
    // the one whose EVENT timestamp is newest. File-path order is wrong here:
    // paths sort by session START time, so a long-running session's fresh
    // snapshot would lose to a stale one from a later-started session.
    const considerTelemetry = (session) => {
        if (session.rateLimits &&
            (session.rlTimestamp ?? 0) > latestRlTimestamp) {
            latestRateLimits = session.rateLimits;
            latestRlTimestamp = session.rlTimestamp ?? 0;
        }
        if (session.model && (session.modelTimestamp ?? 0) > latestModelTimestamp) {
            latestModel = { model: session.model, effort: session.effort };
            latestModelTimestamp = session.modelTimestamp ?? 0;
        }
        if (session.contextUsed != null &&
            session.contextWindow != null &&
            session.contextWindow > 0 &&
            (session.contextTimestamp ?? 0) > latestContextTimestamp) {
            latestContext = {
                used: session.contextUsed,
                window: session.contextWindow,
            };
            latestContextTimestamp = session.contextTimestamp ?? 0;
        }
    };
    for (const file of files) {
        const session = parseSessionLog(file);
        sessions.push(session);
        if (session.totalUsage) {
            totals.input_tokens += session.totalUsage.input_tokens;
            totals.cached_input_tokens += session.totalUsage.cached_input_tokens;
            totals.output_tokens += session.totalUsage.output_tokens;
            totals.reasoning_output_tokens +=
                session.totalUsage.reasoning_output_tokens;
            totals.total_tokens += session.totalUsage.total_tokens;
        }
        considerTelemetry(session);
    }
    // A session that spans midnight keeps writing into yesterday's file, so
    // for the "today" range also scan the previous day — telemetry only;
    // usage totals still attribute to the session's start date.
    if (range === "today") {
        for (const file of listLogs(dayDir(1))) {
            considerTelemetry(parseSessionLog(file));
        }
    }
    // Codex 0.140+ run via the app-server (the Claude Code codex plugin) doesn't
    // write rate limits to rollout files — it logs them to ~/.codex/logs_2.sqlite.
    // Merge that snapshot in if it's fresher than anything from the rollouts.
    const db = readDbTelemetry();
    if (db) {
        if (db.timestampMs > latestRlTimestamp) {
            latestRateLimits = db.rateLimits;
            latestRlTimestamp = db.timestampMs;
        }
        if (db.model && db.timestampMs > latestModelTimestamp) {
            // Model from the log; effort from the Codex config (config.toml).
            latestModel = { model: db.model, effort: db.effort };
            latestModelTimestamp = db.timestampMs;
        }
    }
    return {
        sessions,
        totals,
        latestRateLimits,
        latestModel,
        latestContext,
        sessionCount: sessions.filter((s) => s.totalUsage !== null).length,
    };
}
