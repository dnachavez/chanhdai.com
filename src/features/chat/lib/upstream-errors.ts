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

function hasStatus(error: unknown, matches: (status: number) => boolean) {
  return check(error, matches, new Set())
}

function check(
  error: unknown,
  matches: (status: number) => boolean,
  seen: Set<object>
): boolean {
  if (typeof error !== "object" || error === null) return false

  // Error chains are usually shallow, but they are graphs rather than trees and
  // nothing guarantees a provider will not hand back a self-reference.
  if (seen.has(error)) return false
  seen.add(error)

  const { statusCode, lastError, errors, cause } = error as {
    statusCode?: unknown
    lastError?: unknown
    errors?: unknown
    cause?: unknown
  }

  if (typeof statusCode === "number" && matches(statusCode)) return true
  if (check(lastError, matches, seen)) return true
  if (check(cause, matches, seen)) return true

  return (
    Array.isArray(errors) &&
    errors.some((nested) => check(nested, matches, seen))
  )
}
