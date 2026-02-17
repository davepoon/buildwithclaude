let circuitOpen = false
let circuitOpenedAt = 0
const CIRCUIT_TTL_MS = 30_000 // 30 seconds

/**
 * Wraps an async DB query in try/catch with a simple circuit breaker.
 * Returns typed fallback data on failure plus a `fromDb` flag.
 */
export async function safeDbQuery<T>(
  queryFn: () => Promise<T>,
  fallback: T,
  label?: string
): Promise<{ data: T; fromDb: boolean }> {
  // If circuit is open, check if TTL has expired
  if (circuitOpen) {
    if (Date.now() - circuitOpenedAt > CIRCUIT_TTL_MS) {
      circuitOpen = false
    } else {
      return { data: fallback, fromDb: false }
    }
  }

  try {
    const data = await queryFn()
    return { data, fromDb: true }
  } catch (error) {
    console.error(`[safeDbQuery] ${label || 'query'} failed:`, error)
    circuitOpen = true
    circuitOpenedAt = Date.now()
    return { data: fallback, fromDb: false }
  }
}
