const BASE_URL = "https://api.openai.com";
const TIMEOUT_MS = 10_000;
async function apiFetch(path, adminKey) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(`${BASE_URL}${path}`, {
            headers: {
                Authorization: `Bearer ${adminKey}`,
                "Content-Type": "application/json",
            },
            signal: controller.signal,
        });
        if (!res.ok) {
            const body = await res.text().catch(() => "");
            if (res.status === 401 || res.status === 403) {
                return {
                    ok: false,
                    error: `Authentication failed (${res.status}). Check your Admin API key.`,
                };
            }
            if (res.status === 429) {
                return { ok: false, error: "Rate limited by OpenAI API. Try again later." };
            }
            return {
                ok: false,
                error: `OpenAI API error ${res.status}: ${body.slice(0, 200)}`,
            };
        }
        const data = (await res.json());
        return { ok: true, data };
    }
    catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
            return { ok: false, error: "OpenAI API request timed out (10s)." };
        }
        return {
            ok: false,
            error: `Network error: ${err instanceof Error ? err.message : String(err)}`,
        };
    }
    finally {
        clearTimeout(timer);
    }
}
function buildQuery(params) {
    const parts = [];
    for (const [key, val] of Object.entries(params)) {
        if (Array.isArray(val)) {
            for (const v of val) {
                parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
            }
        }
        else {
            parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(val)}`);
        }
    }
    return parts.join("&");
}
export async function fetchCosts(adminKey, startTime, endTime, bucketWidth = "1d") {
    const params = {
        start_time: String(startTime),
        bucket_width: bucketWidth,
        "group_by[]": ["line_item"],
    };
    if (endTime) {
        params["end_time"] = String(endTime);
    }
    return apiFetch(`/v1/organization/costs?${buildQuery(params)}`, adminKey);
}
export async function fetchUsage(adminKey, startTime, endTime, bucketWidth = "1d") {
    const params = {
        start_time: String(startTime),
        bucket_width: bucketWidth,
        "group_by[]": ["model"],
    };
    if (endTime) {
        params["end_time"] = String(endTime);
    }
    return apiFetch(`/v1/organization/usage/completions?${buildQuery(params)}`, adminKey);
}
export async function testConnection(adminKey) {
    const now = Math.floor(Date.now() / 1000);
    const oneDayAgo = now - 86400;
    return fetchCosts(adminKey, oneDayAgo, now, "1d");
}
