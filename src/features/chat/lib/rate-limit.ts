import "server-only"

import { LRUCache } from "lru-cache"

import { RATE_LIMIT } from "../config"

/**
 * Fixed-window per-IP limiter held in module memory.
 *
 * Deliberately leaky: serverless instances do not share memory and cold starts
 * reset the map, so a determined caller spread across instances gets more than
 * `RATE_LIMIT.requests`. The alternative is a KV store, which this site does
 * not have and which would be the only piece of stateful infrastructure in an
 * otherwise fully static deployment. This stops casual hammering at zero cost;
 * it is not a security boundary.
 *
 * `max` bounds memory rather than behaviour — 10k distinct addresses per
 * instance is far beyond this site's traffic, and evicting the least recently
 * seen entry only ever forgives a caller.
 */
const buckets = new LRUCache<string, { count: number; windowStart: number }>({
  max: 10_000,
  ttl: RATE_LIMIT.windowMs,
})

export type RateLimitResult = {
  allowed: boolean
  /** Seconds until the window rolls over, for the Retry-After header. */
  retryAfter: number
}

/**
 * Vercel sets `x-forwarded-for` as a comma-separated chain with the client
 * first. Everything downstream is a proxy hop and must not be trusted as the
 * identity. Falls back to a shared bucket rather than to "unlimited" when no
 * address is present, so a stripped header cannot be used to bypass the limit.
 */
export function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    const [client] = forwarded.split(",")
    if (client?.trim()) return client.trim()
  }

  return request.headers.get("x-real-ip")?.trim() || "unknown"
}

export function checkRateLimit(ip: string): RateLimitResult {
  const now = Date.now()
  const existing = buckets.get(ip)

  /**
   * A fixed window, not a sliding one: writing back on every request would
   * refresh the entry's TTL and the window would never close for anyone who
   * kept calling. `windowStart` is therefore carried forward untouched while
   * the window is open.
   */
  if (!existing || now - existing.windowStart >= RATE_LIMIT.windowMs) {
    buckets.set(ip, { count: 1, windowStart: now })
    return { allowed: true, retryAfter: 0 }
  }

  const elapsed = now - existing.windowStart
  const retryAfter = Math.ceil((RATE_LIMIT.windowMs - elapsed) / 1000)

  if (existing.count >= RATE_LIMIT.requests) {
    return { allowed: false, retryAfter }
  }

  existing.count += 1
  return { allowed: true, retryAfter }
}
