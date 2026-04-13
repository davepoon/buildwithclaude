import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
function getSessionsDir() {
    return join(homedir(), ".codex", "sessions");
}
function getDateDirs(range) {
    const now = new Date();
    const dirs = [];
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
    for (let i = 0; i <= daysBack; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const yyyy = d.getFullYear().toString();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        dirs.push(join(getSessionsDir(), yyyy, mm, dd));
    }
    return dirs;
}
export function findSessionLogs(range) {
    const dirs = getDateDirs(range);
    const files = [];
    for (const dir of dirs) {
        if (!existsSync(dir))
            continue;
        try {
            const entries = readdirSync(dir);
            for (const entry of entries) {
                if (entry.endsWith(".jsonl")) {
                    files.push(join(dir, entry));
                }
            }
        }
        catch {
            // skip unreadable dirs
        }
    }
    return files;
}
export function parseSessionLog(filePath) {
    const dateMatch = filePath.match(/(\d{4})\/(\d{2})\/(\d{2})/);
    const date = dateMatch
        ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`
        : "unknown";
    let meta = null;
    let lastUsage = null;
    let lastRateLimits = null;
    let modelContextWindow = null;
    try {
        const content = readFileSync(filePath, "utf-8");
        const lines = content.split("\n").filter((l) => l.trim());
        for (const line of lines) {
            try {
                const entry = JSON.parse(line);
                if (entry.type === "session_meta" && entry.payload) {
                    meta = entry.payload;
                }
                if (entry.type === "event_msg" &&
                    entry.payload?.type === "token_count") {
                    if (entry.payload.info?.total_token_usage) {
                        lastUsage = entry.payload.info.total_token_usage;
                        if (entry.payload.info.model_context_window) {
                            modelContextWindow = entry.payload.info.model_context_window;
                        }
                    }
                    if (entry.payload.rate_limits) {
                        lastRateLimits = entry.payload.rate_limits;
                    }
                }
            }
            catch {
                // skip malformed lines
            }
        }
    }
    catch {
        // skip unreadable files
    }
    return {
        meta,
        totalUsage: lastUsage,
        rateLimits: lastRateLimits,
        modelContextWindow,
        date,
        filePath,
    };
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
        // Files are sorted by path (includes timestamp), so the last
        // non-null rateLimits we see is from the most recent session.
        if (session.rateLimits) {
            latestRateLimits = session.rateLimits;
        }
    }
    return {
        sessions,
        totals,
        latestRateLimits,
        sessionCount: sessions.filter((s) => s.totalUsage !== null).length,
    };
}
