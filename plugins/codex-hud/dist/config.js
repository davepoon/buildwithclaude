import { readFileSync, writeFileSync, mkdirSync, chmodSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
function getConfigDir() {
    const claudeConfigDir = process.env["CLAUDE_CONFIG_DIR"] || join(homedir(), ".claude");
    return join(claudeConfigDir, "plugins", "codex-hud");
}
function getConfigPath() {
    return join(getConfigDir(), "config.json");
}
export function loadConfig() {
    const configPath = getConfigPath();
    if (!existsSync(configPath)) {
        return {};
    }
    try {
        const raw = readFileSync(configPath, "utf-8");
        return JSON.parse(raw);
    }
    catch {
        return {};
    }
}
export function saveConfig(config) {
    const dir = getConfigDir();
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
    chmodSync(dir, 0o700);
    const configPath = getConfigPath();
    writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", {
        mode: 0o600,
    });
    chmodSync(configPath, 0o600);
}
export function resolveAdminKey() {
    const envKey = process.env["OPENAI_ADMIN_KEY"];
    if (envKey)
        return envKey;
    const config = loadConfig();
    return config.adminKey ?? null;
}
