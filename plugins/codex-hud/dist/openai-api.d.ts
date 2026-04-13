import type { ApiResult, CostsResponse, UsageResponse } from "./types.js";
export declare function fetchCosts(adminKey: string, startTime: number, endTime?: number, bucketWidth?: string): Promise<ApiResult<CostsResponse>>;
export declare function fetchUsage(adminKey: string, startTime: number, endTime?: number, bucketWidth?: string): Promise<ApiResult<UsageResponse>>;
export declare function testConnection(adminKey: string): Promise<ApiResult<CostsResponse>>;
