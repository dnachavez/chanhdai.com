import { afterEach, describe, expect, it } from "vitest"

import { getPostHogConfig, getPostHogHosts } from "@/lib/posthog"

/** Shaped like a real project token: `phc_` plus a long base62 string. */
const REAL_TOKEN = "phc_7Uq2mKfR9xLdN4vTwZaB6cE1sHjY3pG8QoI5rXtM0kD"

/** Assigning `undefined` to `process.env` would store the string "undefined". */
function setEnv(token?: string, host?: string) {
  if (token === undefined) {
    delete process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
  } else {
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = token
  }

  if (host === undefined) {
    delete process.env.NEXT_PUBLIC_POSTHOG_HOST
  } else {
    process.env.NEXT_PUBLIC_POSTHOG_HOST = host
  }
}

afterEach(() => {
  delete process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
  delete process.env.NEXT_PUBLIC_POSTHOG_HOST
})

describe("getPostHogConfig", () => {
  it("rejects the .env.example placeholders that shipped to production", () => {
    setEnv("phc_xxx", "https://p.acme.com")
    expect(getPostHogConfig()).toBeUndefined()
  })

  it("rejects a placeholder token even against a real host", () => {
    setEnv("phc_xxx", "https://ph.dnachavez.dev")
    expect(getPostHogConfig()).toBeUndefined()
  })

  it("rejects the placeholder host rather than falling back to the cloud", () => {
    setEnv(REAL_TOKEN, "https://p.acme.com")
    expect(getPostHogConfig()).toBeUndefined()
  })

  it("rejects a missing token", () => {
    setEnv(undefined, undefined)
    expect(getPostHogConfig()).toBeUndefined()
  })

  it("rejects a host that is not an absolute http(s) url", () => {
    setEnv(REAL_TOKEN, "ph.dnachavez.dev")
    expect(getPostHogConfig()).toBeUndefined()
  })

  it("accepts a real token, leaving the host unset for PostHog Cloud", () => {
    setEnv(REAL_TOKEN, undefined)
    expect(getPostHogConfig()).toEqual({
      token: REAL_TOKEN,
      apiHost: undefined,
    })
  })

  it("accepts a real token with a self-hosted host", () => {
    setEnv(REAL_TOKEN, "https://ph.dnachavez.dev")
    expect(getPostHogConfig()).toEqual({
      token: REAL_TOKEN,
      apiHost: "https://ph.dnachavez.dev",
    })
  })
})

describe("getPostHogHosts", () => {
  it("names no origins while the credentials are placeholders", () => {
    setEnv("phc_xxx", "https://p.acme.com")
    expect(getPostHogHosts()).toEqual([])
  })

  it("names both cloud origins when no host is configured", () => {
    setEnv(REAL_TOKEN, undefined)
    expect(getPostHogHosts()).toEqual([
      "https://us.i.posthog.com",
      "https://us-assets.i.posthog.com",
    ])
  })

  it("names only the configured host when one is set", () => {
    setEnv(REAL_TOKEN, "https://ph.dnachavez.dev")
    expect(getPostHogHosts()).toEqual(["https://ph.dnachavez.dev"])
  })
})
