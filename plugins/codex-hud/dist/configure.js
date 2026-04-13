import { loadConfig, saveConfig } from "./config.js";
import { DEFAULT_DISPLAY } from "./types.js";
const BOOL_KEYS = [
    "showPlan",
    "showFooter",
    "showUsage",
    "showWeekly",
    "fallbackToWeek",
];
const NUMBER_KEYS = ["barWidth"];
const ENUM_KEYS = {
    layout: ["compact", "expanded", "horizontal"],
    language: ["en", "ko"],
};
function getDisplayConfig() {
    const stored = loadConfig().display ?? {};
    return { ...DEFAULT_DISPLAY, ...stored };
}
export function showConfig(asJson = false) {
    const cfg = getDisplayConfig();
    if (asJson)
        return JSON.stringify(cfg, null, 2);
    const lines = [
        "Current display configuration:",
        "",
        `  layout         = ${cfg.layout}  (expanded | horizontal | compact)`,
        `  showPlan       = ${cfg.showPlan}`,
        `  showFooter     = ${cfg.showFooter}`,
        `  showUsage      = ${cfg.showUsage}`,
        `  showWeekly     = ${cfg.showWeekly}`,
        `  barWidth       = ${cfg.barWidth}`,
        `  fallbackToWeek = ${cfg.fallbackToWeek}`,
        `  language       = ${cfg.language}  (en | ko)`,
    ];
    return lines.join("\n");
}
function parseValue(key, raw) {
    if (BOOL_KEYS.includes(key)) {
        if (raw === "true" || raw === "1")
            return true;
        if (raw === "false" || raw === "0")
            return false;
        throw new Error(`${key} must be true or false, got "${raw}"`);
    }
    if (NUMBER_KEYS.includes(key)) {
        const n = Number(raw);
        if (!Number.isFinite(n))
            throw new Error(`${key} must be a number, got "${raw}"`);
        if (key === "barWidth" && (n < 1 || n > 40)) {
            throw new Error(`barWidth must be between 1 and 40`);
        }
        return n;
    }
    if (key in ENUM_KEYS) {
        const allowed = ENUM_KEYS[key];
        if (!allowed.includes(raw)) {
            throw new Error(`${key} must be one of: ${allowed.join(", ")}`);
        }
        return raw;
    }
    throw new Error(`Unknown configuration key: ${key}`);
}
export function setConfigOption(key, value) {
    try {
        const parsed = parseValue(key, value);
        const current = loadConfig();
        const display = { ...(current.display ?? {}) };
        display[key] = parsed;
        saveConfig({ ...current, display });
        return { ok: true, message: `Set ${key} = ${String(parsed)}` };
    }
    catch (err) {
        return {
            ok: false,
            message: err instanceof Error ? err.message : String(err),
        };
    }
}
export function resetConfig() {
    const current = loadConfig();
    const { display: _drop, ...rest } = current;
    void _drop;
    saveConfig(rest);
    return { ok: true, message: "Display configuration reset to defaults." };
}
export function listKeys() {
    return [...BOOL_KEYS, ...NUMBER_KEYS, ...Object.keys(ENUM_KEYS)];
}
