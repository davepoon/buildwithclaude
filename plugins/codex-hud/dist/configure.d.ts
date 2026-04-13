export declare function showConfig(asJson?: boolean): string;
export declare function setConfigOption(key: string, value: string): {
    ok: boolean;
    message: string;
};
export declare function resetConfig(): {
    ok: boolean;
    message: string;
};
export declare function listKeys(): string[];
