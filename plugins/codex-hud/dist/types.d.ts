export interface DisplayConfig {
    layout?: "compact" | "expanded";
    showPlan?: boolean;
    showFooter?: boolean;
    showUsage?: boolean;
    showWeekly?: boolean;
    barWidth?: number;
    fallbackToWeek?: boolean;
    language?: "en" | "ko";
}
export interface PluginConfig {
    adminKey?: string;
    display?: DisplayConfig;
}
export declare const DEFAULT_DISPLAY: Required<DisplayConfig>;
export interface CostsBucket {
    object: string;
    amount: {
        value: number;
        currency: string;
    };
    line_item: string | null;
    project_id: string | null;
}
export interface CostsResponse {
    object: string;
    data: Array<{
        results: CostsBucket[];
        start_time: number;
        end_time: number;
    }>;
    has_more: boolean;
    next_page: string | null;
}
export interface UsageBucket {
    object: string;
    input_tokens: number;
    output_tokens: number;
    input_cached_tokens: number;
    num_model_requests: number;
    project_id: string | null;
    user_id: string | null;
    api_key_id: string | null;
    model: string | null;
    batch: boolean | null;
}
export interface UsageResponse {
    object: string;
    data: Array<{
        results: UsageBucket[];
        start_time: number;
        end_time: number;
    }>;
    has_more: boolean;
    next_page: string | null;
}
export interface SessionMeta {
    id: string;
    timestamp: string;
    cwd: string;
    originator: string;
    cli_version: string;
    source: string;
    model_provider: string;
}
export interface TokenUsage {
    input_tokens: number;
    cached_input_tokens: number;
    output_tokens: number;
    reasoning_output_tokens: number;
    total_tokens: number;
}
export interface RateLimitWindow {
    used_percent: number;
    window_minutes: number;
    resets_at: number;
}
export interface RateLimits {
    limit_id: string;
    limit_name: string | null;
    primary: RateLimitWindow;
    secondary: RateLimitWindow;
    credits: unknown;
    plan_type: string;
}
export interface TokenCountEvent {
    timestamp: string;
    type: "event_msg";
    payload: {
        type: "token_count";
        info: {
            total_token_usage: TokenUsage;
            last_token_usage: TokenUsage;
            model_context_window: number;
        } | null;
        rate_limits: RateLimits;
    };
}
export interface SessionLogEntry {
    timestamp: string;
    type: string;
    payload: Record<string, unknown>;
}
export interface ParsedSession {
    meta: SessionMeta | null;
    totalUsage: TokenUsage | null;
    rateLimits: RateLimits | null;
    modelContextWindow: number | null;
    date: string;
    filePath: string;
}
export interface AggregatedUsage {
    sessions: ParsedSession[];
    totals: TokenUsage;
    latestRateLimits: RateLimits | null;
    sessionCount: number;
}
export type ApiResult<T> = {
    ok: true;
    data: T;
} | {
    ok: false;
    error: string;
};
export type DateRange = "today" | "week" | "month";
