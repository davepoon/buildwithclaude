interface InstallResult {
    ok: boolean;
    symlinkCreated: boolean;
    settingsUpdated: boolean;
    previousCommand: string | null;
    message: string;
}
export declare function installStatusline(): InstallResult;
export declare function uninstallStatusline(): {
    ok: boolean;
    message: string;
};
export {};
