import { describe, expect, it } from "vitest"

import { isUpstreamRateLimit, isUpstreamUnavailable } from "./upstream-errors"

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
