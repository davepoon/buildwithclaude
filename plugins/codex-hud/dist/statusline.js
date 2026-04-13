import { aggregateLocalUsage } from "./local-logs.js";
// ANSI escape codes matching claude-hud's color scheme
const RESET = "\x1b[0m";
const DIM = "\x1b[2m";
const RED = "\x1b[31m";
const BRIGHT_BLUE = "\x1b[94m";
const BRIGHT_MAGENTA = "\x1b[95m";
// ── Color helpers (matching claude-hud) ──
function getQuotaColor(percent) {
    if (percent >= 90)
        return RED;
    if (percent >= 75)
        return BRIGHT_MAGENTA;
    return BRIGHT_BLUE;
}
function quotaBar(percent, width = 10) {
    const safePercent = Math.min(100, Math.max(0, percent));
    const filled = Math.round((safePercent / 100) * width);
    const empty = width - filled;
    const color = getQuotaColor(safePercent);
    return `${color}${"█".repeat(filled)}${DIM}${"░".repeat(empty)}${RESET}`;
}
function formatResetTime(resetsAt) {
    const now = Date.now() / 1000;
    const diffSec = resetsAt - now;
    if (diffSec <= 0)
        return "";
    const diffMins = Math.ceil(diffSec / 60);
    if (diffMins < 60)
        return `${diffMins}m`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    if (hours >= 24) {
        const days = Math.floor(hours / 24);
        const remHours = hours % 24;
        if (remHours > 0)
            return `${days}d ${remHours}h`;
        return `${days}d`;
    }
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
// ── Line renderers (claude-hud style) ──
function renderUsageLine(rl) {
    const percent = rl.primary.used_percent;
    const color = getQuotaColor(percent);
    const bar = quotaBar(percent);
    const resetStr = formatResetTime(rl.primary.resets_at);
    const resetPart = resetStr ? ` ${DIM}(resets in ${resetStr})${RESET}` : "";
    return `${DIM}Usage${RESET}   ${bar} ${color}${percent.toFixed(0)}%${RESET}${resetPart}`;
}
function renderWeeklyLine(rl) {
    const percent = rl.secondary.used_percent;
    const color = getQuotaColor(percent);
    const bar = quotaBar(percent);
    const resetStr = formatResetTime(rl.secondary.resets_at);
    const resetPart = resetStr ? ` ${DIM}(resets in ${resetStr})${RESET}` : "";
    return `${DIM}Weekly${RESET}  ${bar} ${color}${percent.toFixed(0)}%${RESET}${resetPart}`;
}
function renderSessionInfo(sessionCount, plan) {
    return `${DIM}${sessionCount} session${sessionCount !== 1 ? "s" : ""} | ${plan}${RESET}`;
}
// ── Main export ──
export function renderStatusLines(range = "today") {
    let local = aggregateLocalUsage(range);
    // If today has no data, fallback to week to get latest rate limits
    if (range === "today" && local.sessionCount === 0) {
        const fallback = aggregateLocalUsage("week");
        if (fallback.sessionCount > 0) {
            local = fallback;
        }
    }
    const lines = [];
    // Header with plan type
    const plan = local.latestRateLimits?.plan_type ?? "";
    const planLabel = plan ? ` ${plan}` : "";
    lines.push(`${DIM}── Codex${planLabel} ──${RESET}`);
    if (local.sessionCount === 0 && !local.latestRateLimits) {
        lines.push(`${DIM}No Codex sessions found${RESET}`);
        return lines;
    }
    // Usage (5h window) and Weekly (7d window)
    if (local.latestRateLimits) {
        lines.push(renderUsageLine(local.latestRateLimits));
        lines.push(renderWeeklyLine(local.latestRateLimits));
    }
    // Session count
    if (local.sessionCount > 0) {
        lines.push(renderSessionInfo(local.sessionCount, plan));
    }
    return lines;
}
