export function formatNumber(n) {
    if (n >= 1_000_000)
        return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)
        return `${(n / 1_000).toFixed(1)}k`;
    return String(n);
}
export function formatUsd(n) {
    if (n >= 1)
        return `$${n.toFixed(2)}`;
    if (n >= 0.1)
        return `$${n.toFixed(3)}`;
    if (n > 0)
        return `$${n.toFixed(4)}`;
    return "$0.00";
}
export function formatTokenUsage(usage) {
    const lines = [
        `| Metric | Tokens |`,
        `|--------|--------|`,
        `| Input | ${formatNumber(usage.input_tokens)} |`,
        `| Cached Input | ${formatNumber(usage.cached_input_tokens)} |`,
        `| Output | ${formatNumber(usage.output_tokens)} |`,
        `| Reasoning | ${formatNumber(usage.reasoning_output_tokens)} |`,
        `| **Total** | **${formatNumber(usage.total_tokens)}** |`,
    ];
    return lines.join("\n");
}
export function formatRateLimits(rl) {
    const parts = [];
    if (rl.primary) {
        const left = `${(100 - rl.primary.used_percent).toFixed(0)}% left`;
        const win = rl.primary.window_minutes != null
            ? ` (${Math.round(rl.primary.window_minutes / 60)}h)`
            : "";
        parts.push(`${left}${win}`);
    }
    if (rl.secondary) {
        const left = `${(100 - rl.secondary.used_percent).toFixed(0)}% left`;
        const win = rl.secondary.window_minutes != null
            ? ` (${Math.round(rl.secondary.window_minutes / 60 / 24)}d)`
            : "";
        parts.push(`${left}${win}`);
    }
    const planPart = rl.plan_type ? ` | Plan: ${rl.plan_type}` : "";
    if (parts.length === 0)
        return `Rate limit: n/a${planPart}`;
    return `Rate limit: ${parts.join(" / ")}${planPart}`;
}
export function formatUsageTable(data) {
    if (data.length === 0)
        return "No usage data found.";
    const lines = [
        `| Model | Input | Cached | Output | Requests |`,
        `|-------|-------|--------|--------|----------|`,
    ];
    let totalInput = 0;
    let totalCached = 0;
    let totalOutput = 0;
    let totalReqs = 0;
    for (const row of data) {
        lines.push(`| ${row.model} | ${formatNumber(row.input)} | ${formatNumber(row.cached)} | ${formatNumber(row.output)} | ${row.requests} |`);
        totalInput += row.input;
        totalCached += row.cached;
        totalOutput += row.output;
        totalReqs += row.requests;
    }
    lines.push(`| **Total** | **${formatNumber(totalInput)}** | **${formatNumber(totalCached)}** | **${formatNumber(totalOutput)}** | **${totalReqs}** |`);
    return lines.join("\n");
}
export function formatCostsTable(data) {
    if (data.length === 0)
        return "No cost data found.";
    const hasDate = data.some((d) => d.date !== undefined);
    // Bucket boundaries are UTC days (API behavior), so label them as such.
    const header = hasDate
        ? `| Date (UTC) | Line Item | Cost |`
        : `| Line Item | Cost |`;
    const separator = hasDate
        ? `|------|-----------|------|`
        : `|-----------|------|`;
    const lines = [header, separator];
    let total = 0;
    for (const row of data) {
        const cost = formatUsd(row.cost);
        if (hasDate) {
            lines.push(`| ${row.date} | ${row.lineItem} | ${cost} |`);
        }
        else {
            lines.push(`| ${row.lineItem} | ${cost} |`);
        }
        total += row.cost;
    }
    if (hasDate) {
        lines.push(`| | **Total** | **${formatUsd(total)}** |`);
    }
    else {
        lines.push(`| **Total** | **${formatUsd(total)}** |`);
    }
    return lines.join("\n");
}
export function formatSummaryLine(opts) {
    const parts = [];
    if (opts.cost !== null) {
        parts.push(`${formatUsd(opts.cost)}`);
    }
    else {
        parts.push("cost: N/A");
    }
    parts.push(`${formatNumber(opts.totalTokens)} tokens (${formatNumber(opts.cachedTokens)} cached)`);
    parts.push(`${opts.sessionCount} session${opts.sessionCount !== 1 ? "s" : ""}`);
    if (opts.rateLimits?.primary && opts.rateLimits.secondary) {
        const p = (100 - opts.rateLimits.primary.used_percent).toFixed(0);
        const s = (100 - opts.rateLimits.secondary.used_percent).toFixed(0);
        parts.push(`Rate: ${p}%/${s}% left`);
    }
    else if (opts.rateLimits?.primary) {
        parts.push(`Rate: ${(100 - opts.rateLimits.primary.used_percent).toFixed(0)}% left`);
    }
    return `Codex today: ${parts.join(" | ")}`;
}
export function formatStatusLabel(opts) {
    const parts = ["Codex"];
    if (opts.cost !== null && opts.cost > 0) {
        parts.push(formatUsd(opts.cost));
    }
    if (opts.totalTokens > 0) {
        parts.push(formatNumber(opts.totalTokens));
    }
    if (opts.sessionCount > 0) {
        parts.push(`${opts.sessionCount}s`);
    }
    if (opts.rateLimits?.primary) {
        const p = opts.rateLimits.primary.used_percent.toFixed(0);
        parts.push(`${p}%`);
    }
    return parts.join(" ");
}
