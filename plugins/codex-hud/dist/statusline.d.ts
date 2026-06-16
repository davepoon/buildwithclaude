import type { DisplayConfig, DateRange } from "./types.js";
export declare function renderStatusLines(range?: DateRange): string[];
/**
 * Render the statusline for the user's stored config plus `overrides`, using
 * sample data, as plain text (no ANSI) suitable for an AskUserQuestion preview.
 */
export declare function renderPreview(overrides?: Partial<DisplayConfig>): string[];
