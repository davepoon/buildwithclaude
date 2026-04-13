import { readFileSync, writeFileSync, existsSync, symlinkSync, unlinkSync, lstatSync, mkdirSync, } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
function getClaudeDir() {
    return process.env["CLAUDE_CONFIG_DIR"] || join(homedir(), ".claude");
}
function getSymlinkPath() {
    return join(getClaudeDir(), "codex-hud-statusline.sh");
}
function getSettingsPath() {
    return join(getClaudeDir(), "settings.json");
}
function getWrapperPath() {
    // CLAUDE_PLUGIN_ROOT is set by Claude Code when running plugin commands
    const pluginRoot = process.env["CLAUDE_PLUGIN_ROOT"];
    if (pluginRoot) {
        return join(pluginRoot, "scripts", "statusline-wrapper.sh");
    }
    // Fallback: derive from this script's location (dist/install-statusline.js -> ../scripts/...)
    try {
        const here = dirname(new URL(import.meta.url).pathname);
        return join(here, "..", "scripts", "statusline-wrapper.sh");
    }
    catch {
        return null;
    }
}
function installSymlink(wrapperPath) {
    const linkPath = getSymlinkPath();
    const dir = dirname(linkPath);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
    try {
        if (existsSync(linkPath) || lstatSync(linkPath, { throwIfNoEntry: false })) {
            unlinkSync(linkPath);
        }
    }
    catch {
        // lstatSync may throw if missing; ignore
    }
    try {
        symlinkSync(wrapperPath, linkPath);
        return { created: true, error: null };
    }
    catch (err) {
        return {
            created: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}
function updateSettings() {
    const settingsPath = getSettingsPath();
    const linkPath = getSymlinkPath();
    let settings = {};
    let previous = null;
    if (existsSync(settingsPath)) {
        try {
            const raw = readFileSync(settingsPath, "utf-8");
            settings = JSON.parse(raw);
        }
        catch (err) {
            return {
                updated: false,
                previous: null,
                error: `Could not parse ${settingsPath}: ${err instanceof Error ? err.message : String(err)}`,
            };
        }
    }
    const currentStatusLine = settings["statusLine"];
    if (currentStatusLine?.command) {
        previous = currentStatusLine.command;
        if (previous === linkPath) {
            return { updated: false, previous, error: null };
        }
    }
    settings["statusLine"] = {
        type: "command",
        command: linkPath,
    };
    try {
        writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
        return { updated: true, previous, error: null };
    }
    catch (err) {
        return {
            updated: false,
            previous,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}
export function installStatusline() {
    const wrapperPath = getWrapperPath();
    if (!wrapperPath || !existsSync(wrapperPath)) {
        return {
            ok: false,
            symlinkCreated: false,
            settingsUpdated: false,
            previousCommand: null,
            message: `Could not locate statusline wrapper script at ${wrapperPath ?? "unknown path"}. Make sure CLAUDE_PLUGIN_ROOT is set.`,
        };
    }
    const sym = installSymlink(wrapperPath);
    if (!sym.created) {
        return {
            ok: false,
            symlinkCreated: false,
            settingsUpdated: false,
            previousCommand: null,
            message: `Failed to create symlink at ${getSymlinkPath()}: ${sym.error}`,
        };
    }
    const upd = updateSettings();
    if (upd.error) {
        return {
            ok: false,
            symlinkCreated: true,
            settingsUpdated: false,
            previousCommand: upd.previous,
            message: `Symlink created but settings.json update failed: ${upd.error}`,
        };
    }
    const parts = [
        `Symlink: ${getSymlinkPath()} -> ${wrapperPath}`,
        upd.updated
            ? upd.previous
                ? `Updated ~/.claude/settings.json (previous statusLine.command was: ${upd.previous})`
                : `Set ~/.claude/settings.json statusLine.command`
            : `~/.claude/settings.json already points to the wrapper, no change`,
        "",
        "Restart Claude Code or run /reload-plugins to see the Codex statusline.",
    ];
    return {
        ok: true,
        symlinkCreated: true,
        settingsUpdated: upd.updated,
        previousCommand: upd.previous,
        message: parts.join("\n"),
    };
}
export function uninstallStatusline() {
    const linkPath = getSymlinkPath();
    const settingsPath = getSettingsPath();
    const messages = [];
    try {
        if (existsSync(linkPath) || lstatSync(linkPath, { throwIfNoEntry: false })) {
            unlinkSync(linkPath);
            messages.push(`Removed symlink: ${linkPath}`);
        }
    }
    catch {
        // ignore
    }
    if (existsSync(settingsPath)) {
        try {
            const raw = readFileSync(settingsPath, "utf-8");
            const settings = JSON.parse(raw);
            const sl = settings["statusLine"];
            if (sl?.command === linkPath) {
                delete settings["statusLine"];
                writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
                messages.push(`Cleared statusLine from ~/.claude/settings.json (you may want to restore your previous statusline manually)`);
            }
        }
        catch {
            messages.push("Could not update settings.json (skipped)");
        }
    }
    if (messages.length === 0) {
        messages.push("Nothing to uninstall.");
    }
    return { ok: true, message: messages.join("\n") };
}
