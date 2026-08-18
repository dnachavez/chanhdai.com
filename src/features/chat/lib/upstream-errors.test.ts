import { describe, expect, it } from "vitest"

import {
  isUpstreamQuotaExhausted,
  isUpstreamRateLimit,
  isUpstreamUnavailable,
} from "./upstream-errors"

/**
 * The nested shapes here are ones the AI SDK actually threw: a `RetryError`
 * wrapping the provider's `APICallError`, with the status only on the inner one.
 * Seen first when Groq's daily token cap was hit, then again as OpenRouter 502
 * `provider_unavailable` when the single host behind a `:free` model went down.
 *
 * The two predicates have to disagree about the same error, which is why they
 * are tested against each other and not only in isolation: a throttle and an
 * outage ask the visitor to do different things.
 */

describe("isUpstreamRateLimit", () => {
  it("matches a bare throttle", () => {
    expect(isUpstreamRateLimit({ statusCode: 429 })).toBe(true)
  })

  it("matches a bare over-ceiling request", () => {
    expect(isUpstreamRateLimit({ statusCode: 413 })).toBe(true)
  })

  it("matches a throttle the SDK retried and gave up on", () => {
    expect(
      isUpstreamRateLimit({
        name: "AI_RetryError",
        reason: "maxRetriesExceeded",
        lastError: { name: "AI_APICallError", statusCode: 429 },
        errors: [
          { name: "AI_APICallError", statusCode: 429 },
          { name: "AI_APICallError", statusCode: 429 },
        ],
      })
    ).toBe(true)
  })

  it("matches when only the errors array carries the status", () => {
    expect(
      isUpstreamRateLimit({
        name: "AI_RetryError",
        errors: [{ statusCode: 429 }],
      })
    ).toBe(true)
  })

  it("does not match a genuine fault", () => {
    expect(
      isUpstreamRateLimit({
        name: "AI_RetryError",
        lastError: { name: "AI_APICallError", statusCode: 500 },
        errors: [{ statusCode: 500 }],
      })
    ).toBe(false)
  })

  it("does not match a bad request", () => {
    expect(isUpstreamRateLimit({ statusCode: 400 })).toBe(false)
  })

  it("handles non-objects without throwing", () => {
    expect(isUpstreamRateLimit(null)).toBe(false)
    expect(isUpstreamRateLimit(undefined)).toBe(false)
    expect(isUpstreamRateLimit("rate limit")).toBe(false)
  })

  it("does not recurse forever on a self-referential error", () => {
    const cyclic: Record<string, unknown> = { statusCode: 500 }
    cyclic.lastError = cyclic

    expect(() => isUpstreamRateLimit(cyclic)).not.toThrow()
  })

  it("does not mistake a provider outage for a throttle", () => {
    expect(isUpstreamRateLimit({ statusCode: 502 })).toBe(false)
  })
})

describe("isUpstreamUnavailable", () => {
  it("matches the 502 OpenRouter returns when the host is down", () => {
    // Shape observed: OpenRouter 502 provider_unavailable, upstream Nvidia.
    expect(isUpstreamUnavailable({ statusCode: 502 })).toBe(true)
  })

  it("matches other 5xx from the provider", () => {
    expect(isUpstreamUnavailable({ statusCode: 500 })).toBe(true)
    expect(isUpstreamUnavailable({ statusCode: 503 })).toBe(true)
    expect(isUpstreamUnavailable({ statusCode: 504 })).toBe(true)
  })

  it("matches an outage the SDK retried and gave up on", () => {
    expect(
      isUpstreamUnavailable({
        name: "AI_RetryError",
        reason: "maxRetriesExceeded",
        lastError: { name: "AI_APICallError", statusCode: 502 },
        errors: [{ statusCode: 502 }, { statusCode: 502 }],
      })
    ).toBe(true)
  })

  it("does not mistake a throttle for an outage", () => {
    expect(isUpstreamUnavailable({ statusCode: 429 })).toBe(false)
    expect(isUpstreamUnavailable({ statusCode: 413 })).toBe(false)
  })

  it("does not match a client error", () => {
    expect(isUpstreamUnavailable({ statusCode: 400 })).toBe(false)
    expect(isUpstreamUnavailable({ statusCode: 404 })).toBe(false)
  })

  it("handles non-objects and cycles without throwing", () => {
    expect(isUpstreamUnavailable(null)).toBe(false)
    const cyclic: Record<string, unknown> = { statusCode: 400 }
    cyclic.lastError = cyclic
    expect(() => isUpstreamUnavailable(cyclic)).not.toThrow()
  })
})

/**
 * The shape OpenRouter returned when the 50-request free-model day ran out,
 * copied from the production log rather than written from the docs: an
 * `AI_RetryError` wrapping three identical `AI_APICallError`s, each carrying the
 * parsed body on `data`. The SDK retried because a 429 is nominally retryable,
 * which is exactly why the daily case has to be told apart from the per-minute
 * one after the fact.
 */
function dailyQuotaError() {
  const message =
    "Rate limit exceeded: free-models-per-day. Add 10 credits to unlock 1000 free model requests per day"

  const call = () => ({
    name: "AI_APICallError",
    message,
    statusCode: 429,
    isRetryable: true,
    data: {
      error: {
        message,
        code: 429,
        metadata: { limit_source: "openrouter_free_tier_daily" },
      },
    },
  })

  return {
    name: "AI_RetryError",
    reason: "maxRetriesExceeded",
    lastError: call(),
    errors: [call(), call(), call()],
  }
}

describe("isUpstreamQuotaExhausted", () => {
  it("matches the daily cap as the SDK actually threw it", () => {
    expect(isUpstreamQuotaExhausted(dailyQuotaError())).toBe(true)
  })

  it("matches on limit_source alone", () => {
    expect(
      isUpstreamQuotaExhausted({
        statusCode: 429,
        data: {
          error: { metadata: { limit_source: "openrouter_free_tier_daily" } },
        },
      })
    ).toBe(true)
  })

  it("matches on the message alone, for a body it cannot parse", () => {
    expect(
      isUpstreamQuotaExhausted({
        statusCode: 429,
        message: "Rate limit exceeded: free-models-per-day.",
      })
    ).toBe(true)
  })

  /**
   * The distinction the copy rests on: one clears in a minute, the other at
   * midnight UTC. A per-minute throttle carries neither marker.
   */
  it("does not match the per-minute throttle", () => {
    expect(
      isUpstreamQuotaExhausted({
        statusCode: 429,
        message: "Rate limit exceeded: free-models-per-min",
        data: {
          error: { metadata: { limit_source: "openrouter_free_tier_minute" } },
        },
      })
    ).toBe(false)
  })

  it("does not match a daily marker on a status that is not a throttle", () => {
    expect(
      isUpstreamQuotaExhausted({
        statusCode: 500,
        data: {
          error: { metadata: { limit_source: "openrouter_free_tier_daily" } },
        },
      })
    ).toBe(false)
  })

  it("does not match a plain throttle carrying no explanation", () => {
    expect(isUpstreamQuotaExhausted({ statusCode: 429 })).toBe(false)
  })

  it("handles non-objects and cycles without throwing", () => {
    expect(isUpstreamQuotaExhausted(null)).toBe(false)
    expect(isUpstreamQuotaExhausted("free-models-per-day")).toBe(false)

    const cyclic: Record<string, unknown> = { statusCode: 429 }
    cyclic.lastError = cyclic
    expect(() => isUpstreamQuotaExhausted(cyclic)).not.toThrow()
  })

  /**
   * `onError` asks the narrow predicate first precisely because the broad one
   * also matches; this pins that overlap so a future reorder fails here rather
   * than silently telling a visitor to wait a minute for nine hours.
   */
  it("overlaps isUpstreamRateLimit, which is why order matters at the call site", () => {
    const error = dailyQuotaError()
    expect(isUpstreamRateLimit(error)).toBe(true)
    expect(isUpstreamUnavailable(error)).toBe(false)
  })
})
