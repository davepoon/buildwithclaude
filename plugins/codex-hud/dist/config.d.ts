import type { PluginConfig } from "./types.js";
export declare function loadConfig(): PluginConfig;
export declare function saveConfig(config: PluginConfig): void;
export declare function resolveAdminKey(): string | null;
