/**
 * Tells an upstream "wait" apart from an upstream "broken".
 *
 * A provider answers a throttled request with 429, and one over a hard
 * per-request ceiling with 413. Both mean wait, and telling someone to email
 * instead of retrying loses a visitor who would have had an answer shortly.
 *
 * The nesting is the point. The AI SDK retries a 429 and, once it gives up,
 * throws its own `RetryError` with the provider's status buried in `lastError`
 * and `errors`. Checking `statusCode` on the thrown error alone therefore
 * matched only the un-retried case, and every throttle that actually exhausted
 * its retries reached the visitor as "something broke" — exactly backwards,
 * since the longer the wait the more it looked like a fault. Found when Groq's
 * daily token cap was hit during testing, before the move to OpenRouter; the
 * wrapping is the SDK's, not the provider's, so it outlived the switch.
 */
export function isUpstreamRateLimit(error: unknown): boolean {
  return hasStatus(error, (status) => status === 429 || status === 413)
}

/**
 * The provider itself failed, rather than refusing us.
 *
 * Worth telling apart from a genuine fault because the visitor can do something
 * about it — wait and retry — and because "something broke" on someone else's
 * outage invites a bug report about this site. Observed as OpenRouter 502
 * `provider_unavailable` when the single host behind a `:free` model fell over.
 */
export function isUpstreamUnavailable(error: unknown): boolean {
  return hasStatus(error, (status) => status >= 500 && status < 600)
}

/**
 * The day's allowance is gone, rather than the current minute's.
 *
 * A strict subset of `isUpstreamRateLimit` — both are 429s — so this has to be
 * asked first. The distinction is the length of the wait, and it is the whole
 * reason this exists: the per-minute throttle clears in a minute, while the
 * free-model daily cap resets at midnight UTC. Telling someone at 03:00 UTC to
 * "give it a minute" sends them back nine hours early, and then again, and the
 * copy reads as a fault rather than as a limit.
 *
 * Matched on OpenRouter's own labelling rather than on `x-ratelimit-reset`,
 * which would mean reading a clock and would make the result depend on when the
 * function was called. If OpenRouter renames these values the match fails
 * closed, back to the per-minute copy — wrong, but no worse than before.
 */
export function isUpstreamQuotaExhausted(error: unknown): boolean {
  return search(error, isDailyQuota, new Set())
}

/**
 * `openrouter_free_tier_daily` is the `limit_source` on the response body;
 * `free-models-per-day` is the human-readable half of the same message, kept as
 * a second signal because neither is a documented contract and they are
 * unlikely to be renamed in the same release.
 */
const DAILY_QUOTA_MARKER = /free-models-per-day|_daily\b/i

type ErrorNode = {
  statusCode?: unknown
  message?: unknown
  data?: unknown
  lastError?: unknown
  errors?: unknown
  cause?: unknown
}

function isDailyQuota(node: ErrorNode) {
  if (node.statusCode !== 429) return false

  const { error } = (node.data ?? {}) as {
    error?: { message?: unknown; metadata?: { limit_source?: unknown } }
  }

  return [error?.metadata?.limit_source, error?.message, node.message].some(
    (value) => typeof value === "string" && DAILY_QUOTA_MARKER.test(value)
  )
}

function hasStatus(error: unknown, matches: (status: number) => boolean) {
  return search(
    error,
    (node) => typeof node.statusCode === "number" && matches(node.statusCode),
    new Set()
  )
}

function search(
  error: unknown,
  matches: (node: ErrorNode) => boolean,
  seen: Set<object>
): boolean {
  if (typeof error !== "object" || error === null) return false

  // Error chains are usually shallow, but they are graphs rather than trees and
  // nothing guarantees a provider will not hand back a self-reference.
  if (seen.has(error)) return false
  seen.add(error)

  const node = error as ErrorNode

  if (matches(node)) return true
  if (search(node.lastError, matches, seen)) return true
  if (search(node.cause, matches, seen)) return true

  return (
    Array.isArray(node.errors) &&
    node.errors.some((nested) => search(nested, matches, seen))
  )
}
