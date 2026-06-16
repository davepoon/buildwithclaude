import { readFileSync } from "node:fs";
import { resolveAdminKey, saveConfig, loadConfig } from "./config.js";
import { testConnection, fetchCosts, fetchUsage } from "./openai-api.js";
import { aggregateLocalUsage } from "./local-logs.js";
import { renderStatusLines, renderPreview } from "./statusline.js";
import { installStatusline, uninstallStatusline } from "./install-statusline.js";
import { showConfig, setConfigOption, resetConfig } from "./configure.js";
import { formatTokenUsage, formatRateLimits, formatUsageTable, formatCostsTable, formatSummaryLine, formatStatusLabel, formatUsd, } from "./format.js";
// Parse `key=value` / `--set key=value` tokens into a display-config override.
function parseDisplayOverrides(args) {
    const out = {};
    for (let i = 0; i < args.length; i++) {
        let tok = args[i] ?? "";
        if (tok === "--set")
            tok = args[++i] ?? "";
        const eq = tok.indexOf("=");
        if (eq <= 0)
            continue;
        const key = tok.slice(0, eq);
        const raw = tok.slice(eq + 1);
        let val = raw;
        if (raw === "true")
            val = true;
        else if (raw === "false")
            val = false;
        else if (/^-?\d+$/.test(raw))
            val = Number(raw);
        out[key] = val;
    }
    return out;
}
function parseDateRange(args) {
    for (const a of args) {
        const v = a.replace(/^-+/, "");
        if (v === "week")
            return "week";
        if (v === "month")
            return "month";
        if (v === "today")
            return "today";
    }
    return "today";
}
function getStartTime(range) {
    const now = new Date();
    switch (range) {
        case "today": {
            const start = new Date(now);
            start.setHours(0, 0, 0, 0);
            return Math.floor(start.getTime() / 1000);
        }
        case "week": {
            const start = new Date(now);
            start.setDate(start.getDate() - 6);
            start.setHours(0, 0, 0, 0);
            return Math.floor(start.getTime() / 1000);
        }
        case "month": {
            const start = new Date(now);
            start.setDate(start.getDate() - 29);
            start.setHours(0, 0, 0, 0);
            return Math.floor(start.getTime() / 1000);
        }
    }
}
// ── Setup ──
async function handleSetup(args) {
    const isCheck = args.includes("--check");
    const isJson = args.includes("--json");
    // Preferred: key piped via stdin (keeps it out of argv and transcripts).
    let providedKey = null;
    if (args.includes("--key-stdin")) {
        try {
            providedKey = readFileSync(0, "utf-8").trim() || null;
        }
        catch {
            providedKey = null;
        }
        if (!providedKey) {
            const msg = "No key received on stdin.";
            console.log(isJson ? JSON.stringify({ status: "error", error: msg }) : msg);
            process.exit(1);
        }
    }
    else {
        // Legacy: --key <value> as an argument (visible in ps and transcripts).
        const keyArgIdx = args.indexOf("--key");
        providedKey =
            keyArgIdx >= 0 && keyArgIdx + 1 < args.length
                ? (args[keyArgIdx + 1] ?? null)
                : null;
        if (providedKey) {
            console.error("Warning: --key exposes the key in process arguments; prefer piping it to --key-stdin.");
        }
    }
    if (providedKey) {
        const result = await testConnection(providedKey);
        if (result.ok) {
            saveConfig({ ...loadConfig(), adminKey: providedKey });
            if (isJson) {
                console.log(JSON.stringify({ status: "saved", connected: true }));
            }
            else {
                console.log("Admin API key saved and verified successfully.");
                const totalCost = result.data.data.reduce((sum, bucket) => {
                    return (sum +
                        bucket.results.reduce((s, r) => s + (r.amount?.value ?? 0), 0));
                }, 0);
                if (totalCost > 0) {
                    console.log(`Last 24h cost: ${formatUsd(totalCost)}`);
                }
            }
        }
        else {
            if (isJson) {
                console.log(JSON.stringify({ status: "error", error: result.error }));
            }
            else {
                console.error(`Connection failed: ${result.error}`);
            }
            process.exit(1);
        }
        return;
    }
    // Check existing key
    const key = resolveAdminKey();
    if (!key) {
        if (isJson) {
            console.log(JSON.stringify({ status: "no_key" }));
        }
        else {
            console.log("No OpenAI Admin API key found.");
            console.log("");
            console.log("To set up, provide your Admin API key:");
            console.log("  - Set OPENAI_ADMIN_KEY environment variable, or");
            console.log("  - Run: /codex-hud:setup-key");
            console.log("");
            console.log("Get an Admin key at: https://platform.openai.com/settings/organization/admin-keys");
        }
        return;
    }
    // Test existing key
    const result = await testConnection(key);
    if (result.ok) {
        if (isJson) {
            console.log(JSON.stringify({ status: "connected" }));
        }
        else {
            console.log("OpenAI Admin API key is configured and working.");
            const totalCost = result.data.data.reduce((sum, bucket) => {
                return (sum +
                    bucket.results.reduce((s, r) => s + (r.amount?.value ?? 0), 0));
            }, 0);
            if (totalCost > 0) {
                console.log(`Last 24h cost: ${formatUsd(totalCost)}`);
            }
        }
    }
    else {
        if (isJson) {
            console.log(JSON.stringify({ status: "error", error: result.error }));
        }
        else {
            console.error(`Connection test failed: ${result.error}`);
            if (isCheck)
                process.exit(1);
        }
    }
}
// ── Usage ──
async function handleUsage(args) {
    const range = parseDateRange(args);
    const localOnly = args.includes("--local-only");
    const rangeLabel = range === "today" ? "Today" : range === "week" ? "Last 7 Days" : "Last 30 Days";
    console.log(`## Codex Usage - ${rangeLabel}\n`);
    // Local logs
    const local = aggregateLocalUsage(range);
    if (local.sessionCount > 0) {
        console.log(`### Local Sessions (${local.sessionCount} sessions)\n`);
        console.log(formatTokenUsage(local.totals));
        console.log("");
    }
    else {
        console.log("No local Codex sessions found for this period.\n");
    }
    // Rate limits can come from rollout logs OR ~/.codex/logs_2.sqlite (the
    // app-server path), so show them even with zero rollout sessions.
    if (local.latestRateLimits) {
        if (local.latestModel)
            console.log(`Model: **${local.latestModel.model}**\n`);
        console.log(formatRateLimits(local.latestRateLimits));
        console.log("");
    }
    // API usage
    if (!localOnly) {
        const key = resolveAdminKey();
        if (key) {
            const startTime = getStartTime(range);
            const result = await fetchUsage(key, startTime);
            if (result.ok) {
                const rows = result.data.data.flatMap((bucket) => bucket.results
                    .filter((r) => r.model)
                    .map((r) => ({
                    model: r.model,
                    input: r.input_tokens,
                    cached: r.input_cached_tokens,
                    output: r.output_tokens,
                    requests: r.num_model_requests,
                })));
                // Aggregate by model
                const byModel = new Map();
                for (const row of rows) {
                    const existing = byModel.get(row.model);
                    if (existing) {
                        existing.input += row.input;
                        existing.cached += row.cached;
                        existing.output += row.output;
                        existing.requests += row.requests;
                    }
                    else {
                        byModel.set(row.model, { ...row });
                    }
                }
                const aggregated = Array.from(byModel.entries()).map(([model, data]) => ({ model, ...data }));
                if (aggregated.length > 0) {
                    console.log("### Organization Usage (OpenAI API)\n");
                    console.log(formatUsageTable(aggregated));
                    if (result.data.has_more) {
                        console.log("\n_Warning: results truncated by the API; totals are partial._");
                    }
                    console.log("\n_Note: API data may lag 5-15 minutes behind real-time._");
                }
            }
            else {
                console.log(`\n_API error: ${result.error}_`);
            }
        }
        else if (local.sessionCount === 0) {
            console.log("No Admin API key configured. Run `/codex-hud:setup-key` to enable API-based usage tracking.");
        }
    }
}
// ── Costs ──
async function handleCosts(args) {
    const range = parseDateRange(args);
    const daily = args.includes("--daily");
    const rangeLabel = range === "today" ? "Today" : range === "week" ? "Last 7 Days" : "Last 30 Days";
    const key = resolveAdminKey();
    if (!key) {
        console.log("## Codex Costs\n");
        console.log("Admin API key required for cost data. Run `/codex-hud:setup-key` to configure.");
        return;
    }
    console.log(`## Codex Costs - ${rangeLabel}\n`);
    const startTime = getStartTime(range);
    const result = await fetchCosts(key, startTime);
    if (!result.ok) {
        console.error(`API error: ${result.error}`);
        return;
    }
    const rows = [];
    for (const bucket of result.data.data) {
        const bucketDate = daily
            ? new Date(bucket.start_time * 1000).toISOString().split("T")[0]
            : undefined;
        for (const r of bucket.results) {
            if (!r.line_item && !r.amount?.value)
                continue;
            rows.push({
                date: bucketDate,
                lineItem: r.line_item ?? "unknown",
                cost: r.amount?.value ?? 0,
            });
        }
    }
    if (!daily) {
        // Aggregate by line item
        const byItem = new Map();
        for (const row of rows) {
            byItem.set(row.lineItem, (byItem.get(row.lineItem) ?? 0) + row.cost);
        }
        const aggregated = Array.from(byItem.entries()).map(([lineItem, cost]) => ({ lineItem, cost }));
        console.log(formatCostsTable(aggregated));
    }
    else {
        console.log(formatCostsTable(rows));
    }
    if (result.data.has_more) {
        console.log("\n_Warning: results truncated by the API; totals are partial._");
    }
    console.log("\n_Note: API data may lag 5-15 minutes behind real-time._");
}
// ── Summary ──
async function handleSummary() {
    const local = aggregateLocalUsage("today");
    let cost = null;
    const key = resolveAdminKey();
    if (key) {
        const startTime = getStartTime("today");
        const result = await fetchCosts(key, startTime);
        if (result.ok) {
            cost = result.data.data.reduce((sum, bucket) => {
                return (sum +
                    bucket.results.reduce((s, r) => s + (r.amount?.value ?? 0), 0));
            }, 0);
        }
    }
    console.log(formatSummaryLine({
        cost,
        totalTokens: local.totals.total_tokens,
        cachedTokens: local.totals.cached_input_tokens,
        sessionCount: local.sessionCount,
        rateLimits: local.latestRateLimits,
    }));
}
// ── Label (for claude-hud --extra-cmd) ──
async function handleLabel() {
    const local = aggregateLocalUsage("today");
    let cost = null;
    const key = resolveAdminKey();
    if (key) {
        const startTime = getStartTime("today");
        const result = await fetchCosts(key, startTime);
        if (result.ok) {
            cost = result.data.data.reduce((sum, bucket) => {
                return (sum +
                    bucket.results.reduce((s, r) => s + (r.amount?.value ?? 0), 0));
            }, 0);
        }
    }
    const label = formatStatusLabel({
        cost,
        totalTokens: local.totals.total_tokens,
        sessionCount: local.sessionCount,
        rateLimits: local.latestRateLimits,
    });
    console.log(JSON.stringify({ label }));
}
// ── Main dispatcher ──
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    const rest = args.slice(1);
    switch (command) {
        case "setup":
            await handleSetup(rest);
            break;
        case "usage":
            await handleUsage(rest);
            break;
        case "costs":
            await handleCosts(rest);
            break;
        case "summary":
            await handleSummary();
            break;
        case "label":
            await handleLabel();
            break;
        case "statusline": {
            const slRange = parseDateRange(rest);
            const lines = renderStatusLines(slRange);
            for (const line of lines) {
                console.log(line);
            }
            break;
        }
        case "preview": {
            // Plain-text render of sample data with ad-hoc overrides, for the
            // configure flow's live previews. e.g. preview --set layout=compact
            const lines = renderPreview(parseDisplayOverrides(rest));
            for (const line of lines) {
                console.log(line);
            }
            break;
        }
        case "install-statusline": {
            const result = installStatusline();
            if (rest.includes("--json")) {
                console.log(JSON.stringify(result));
            }
            else {
                console.log(result.message);
                if (!result.ok)
                    process.exit(1);
            }
            break;
        }
        case "uninstall-statusline": {
            const result = uninstallStatusline();
            console.log(result.message);
            break;
        }
        case "configure": {
            const sub = rest[0];
            if (sub === "--get" || sub === undefined) {
                console.log(showConfig(rest.includes("--json")));
            }
            else if (sub === "--reset") {
                const result = resetConfig();
                console.log(result.message);
            }
            else if (sub === "--set" && rest[1]) {
                const [key, value] = rest[1].split("=");
                if (!key || value === undefined) {
                    console.error("Usage: configure --set key=value");
                    process.exit(1);
                }
                const result = setConfigOption(key, value);
                if (rest.includes("--json")) {
                    console.log(JSON.stringify(result));
                }
                else {
                    console.log(result.message);
                }
                if (!result.ok)
                    process.exit(1);
            }
            else {
                console.error("Usage: configure [--get] | --set key=value | --reset");
                process.exit(1);
            }
            break;
        }
        default:
            console.log("codex-hud - Codex Usage & Costs for Claude Code");
            console.log("");
            console.log("Commands:");
            console.log("  setup [--key K | --key-stdin]  Check or save Admin API key");
            console.log("  usage [--week|--month]         Show token usage");
            console.log("  costs [--week|--month]         Show cost breakdown");
            console.log("  summary                        Quick one-line summary");
            console.log("  label                          JSON label for claude-hud");
            console.log("  statusline [--week|--month]    Render statusline lines");
            console.log("  preview [--set k=v ...]        Plain preview of sample data (for configure)");
            console.log("  install-statusline             Install the statusline integration");
            console.log("  uninstall-statusline           Remove it (restores previous statusline)");
            console.log("  configure [--get|--set k=v|--reset]  Display options");
            break;
    }
}
main().catch((err) => {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
});
