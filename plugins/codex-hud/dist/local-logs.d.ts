import type { DateRange, ParsedSession, AggregatedUsage } from "./types.js";
export declare function findSessionLogs(range: DateRange): string[];
export declare function parseSessionLog(filePath: string): ParsedSession;
export declare function aggregateLocalUsage(range: DateRange): AggregatedUsage;
