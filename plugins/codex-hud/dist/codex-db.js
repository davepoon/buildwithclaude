import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
function dbPath() {
    return join(homedir(), ".codex", "logs_2.sqlite");
}
// The reasoning effort isn't in the logs alongside the model, but the Codex
// config records the configured default. Best-effort, regex (no TOML dep).
function readConfiguredEffort() {
    try {
        const p = join(homedir(), ".codex", "config.toml");
        if (!existsSync(p))
            return null;
        const m = /^\s*model_reasoning_effort\s*=\s*"?([A-Za-z]+)"?/m.exec(readFileSync(p, "utf-8"));
        return m ? m[1] : null;
    }
    catch {
        return null;
    }
}
// Bound the scan to the most recent rows so the (200k+-row) debug log can't
// stall the statusline. codex.rate_limits JSON rows are SPARSE (emitted on
// quota refresh, not every turn), so the window must be generous enough that a
// long app-server session doesn't push the newest snapshot out of it — 50k
// rows covers many hours of busy logging and still caps a full LIKE scan at
// ~30ms. The LIKE is tightened to the JSON marker so the noisier
// `event.kind=codex.rate_limits` telemetry rows don't crowd out the LIMIT.
const RL_QUERY = "SELECT ts, feedback_log_body AS body FROM logs " +
    "WHERE id > (SELECT max(id) FROM logs) - 50000 " +
    "AND feedback_log_body LIKE '%{\"type\":\"codex.rate_limits\"%' " +
    "ORDER BY id DESC LIMIT 3";
const MODEL_QUERY = "SELECT ts, feedback_log_body AS body FROM logs " +
    "WHERE id > (SELECT max(id) FROM logs) - 50000 " +
    "AND feedback_log_body LIKE '%stream_responses_websocket%model=%' " +
    "ORDER BY id DESC LIMIT 1";
// node:sqlite is built-in on Node 22.5+; require it synchronously so the
// statusline render stays sync. Returns null if unavailable (older Node).
function queryNodeSqlite(sql) {
    try {
        const require = createRequire(import.meta.url);
        const { DatabaseSync } = require("node:sqlite");
        const db = new DatabaseSync(dbPath(), { readOnly: true });
        try {
            return db.prepare(sql).all();
        }
        finally {
            db.close();
        }
    }
    catch {
        return null;
    }
}
// Fallback for Node < 22.5: shell out to the sqlite3 CLI if present.
function querySqlite3Cli(sql) {
    try {
        const out = execFileSync("sqlite3", ["-readonly", "-json", dbPath(), sql], {
            encoding: "utf-8",
            timeout: 3000,
            maxBuffer: 8 * 1024 * 1024,
        });
        if (!out.trim())
            return [];
        return JSON.parse(out);
    }
    catch {
        return null;
    }
}
function query(sql) {
    if (!existsSync(dbPath()))
        return [];
    return queryNodeSqlite(sql) ?? querySqlite3Cli(sql) ?? [];
}
// Extract a balanced JSON object starting at `marker` (handles nested braces
// and strings), since the log body is "...event: {json}" with trailing text.
function extractJson(body, marker) {
    const start = body.indexOf(marker);
    if (start < 0)
        return null;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < body.length; i++) {
        const c = body[i];
        if (esc) {
            esc = false;
            continue;
        }
        if (c === "\\") {
            esc = true;
            continue;
        }
        if (c === '"')
            inStr = !inStr;
        if (inStr)
            continue;
        if (c === "{")
            depth++;
        else if (c === "}") {
            depth--;
            if (depth === 0)
                return body.slice(start, i + 1);
        }
    }
    return null;
}
function mapWindow(w) {
    if (!w || typeof w.used_percent !== "number")
        return null;
    return {
        used_percent: w.used_percent,
        window_minutes: typeof w.window_minutes === "number" ? w.window_minutes : null,
        resets_at: typeof w.reset_at === "number"
            ? w.reset_at
            : typeof w.resets_at === "number"
                ? w.resets_at
                : null,
    };
}
function mapRateLimits(obj) {
    const rl = obj.rate_limits;
    if (!rl)
        return null;
    const primary = mapWindow(rl.primary);
    const secondary = mapWindow(rl.secondary);
    // Keep the snapshot even when both windows are null: a reached-limit event
    // ({limit_reached:true, primary:null, secondary:null}) still carries the
    // LIMIT badge + plan, and the statusline guards every window deref.
    return {
        limit_id: "codex",
        limit_name: null,
        primary,
        secondary,
        credits: obj.credits ?? null,
        plan_type: typeof obj.plan_type === "string" ? obj.plan_type : null,
        rate_limit_reached_type: rl.limit_reached ? "reached" : null,
    };
}
function toMs(ts) {
    // ts is unix seconds in logs_2.sqlite; guard in case a build uses ms.
    return ts > 1e12 ? ts : ts * 1000;
}
let memo = null;
function compute() {
    let rows;
    try {
        rows = query(RL_QUERY);
    }
    catch {
        return null;
    }
    for (const row of rows) {
        const jsonStr = extractJson(row.body, '{"type":"codex.rate_limits"');
        if (!jsonStr)
            continue;
        let obj;
        try {
            obj = JSON.parse(jsonStr);
        }
        catch {
            continue;
        }
        const rateLimits = mapRateLimits(obj);
        if (!rateLimits)
            continue;
        let model = null;
        try {
            const mrows = query(MODEL_QUERY);
            const body = mrows[0]?.body;
            if (body) {
                const m = /model=([A-Za-z0-9._-]+)/.exec(body);
                model = m ? m[1] : null;
            }
        }
        catch {
            // model is best-effort
        }
        return {
            rateLimits,
            model,
            effort: readConfiguredEffort(),
            timestampMs: typeof row.ts === "number" ? toMs(row.ts) : Date.now(),
        };
    }
    return null;
}
/**
 * Newest rate-limit snapshot Codex logged to ~/.codex/logs_2.sqlite, or null.
 * Memoized for the process lifetime (one statusline render).
 */
export function readDbTelemetry() {
    if (memo)
        return memo.value;
    let value;
    try {
        value = compute();
    }
    catch {
        value = null;
    }
    memo = { value };
    return value;
}
