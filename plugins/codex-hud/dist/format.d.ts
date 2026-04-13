import type { TokenUsage, RateLimits } from "./types.js";
export declare function formatNumber(n: number): string;
export declare function formatUsd(n: number): string;
export declare function formatTokenUsage(usage: TokenUsage): string;
export declare function formatRateLimits(rl: RateLimits): string;
export declare function formatUsageTable(data: Array<{
    model: string;
    input: number;
    cached: number;
    output: number;
    requests: number;
}>): string;
export declare function formatCostsTable(data: Array<{
    date?: string;
    lineItem: string;
    cost: number;
}>): string;
export declare function formatSummaryLine(opts: {
    cost: number | null;
    totalTokens: number;
    cachedTokens: number;
    sessionCount: number;
    rateLimits: RateLimits | null;
}): string;
export declare function formatStatusLabel(opts: {
    cost: number | null;
    totalTokens: number;
    sessionCount: number;
    rateLimits: RateLimits | null;
}): string;
