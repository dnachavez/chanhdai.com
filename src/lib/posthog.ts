/**
 * `.env.example` ships placeholder credentials, and production had them set
 * verbatim: every visitor pulled 205 KB of posthog-js to reach a host that does
 * not resolve, so nothing was ever collected. Nothing initialises unless both
 * values survive the checks below, which keeps the SDK chunk unfetched instead
 * of merely idle.
 */

/**
 * Real project tokens are `phc_` followed by a long base62 string, so the
 * `phc_xxx` placeholder fails on shape rather than on a name we have to
 * remember to keep in sync.
 */
const PROJECT_TOKEN_PATTERN = /^phc_[A-Za-z0-9]{20,}$/

/**
 * The host placeholder is a syntactically valid URL, so only an exact match
 * distinguishes it from a real self-hosted deployment.
 */
const EXAMPLE_HOST = "https://p.acme.com"

function isAbsoluteHttpUrl(value: string) {
  try {
    const { protocol } = new URL(value)
    return protocol === "https:" || protocol === "http:"
  } catch {
    return false
  }
}

/** posthog-js falls back to PostHog Cloud US when no host is configured. */
const CLOUD_HOSTS = [
  "https://us.i.posthog.com",
  "https://us-assets.i.posthog.com",
]

export type PostHogConfig = {
  token: string
  apiHost: string | undefined
}

export function getPostHogConfig(): PostHogConfig | undefined {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
  const apiHost = process.env.NEXT_PUBLIC_POSTHOG_HOST

  if (!token || !PROJECT_TOKEN_PATTERN.test(token)) {
    return undefined
  }

  /**
   * A host that is present but unusable is treated as no configuration at all
   * rather than falling back to PostHog Cloud: it means somebody meant to point
   * at a specific deployment, and quietly retargeting their traffic elsewhere
   * is worse than collecting nothing. Both failures otherwise look identical
   * from the browser -- events leave and are never seen again.
   */
  if (apiHost && (apiHost === EXAMPLE_HOST || !isAbsoluteHttpUrl(apiHost))) {
    return undefined
  }

  return { token, apiHost: apiHost || undefined }
}

/**
 * Origins posthog-js reaches at runtime: `connect-src` for the event and
 * remote-config requests, and `script-src` because the SDK lazily fetches its
 * recorder and survey bundles from the same place. Empty while the credentials
 * are placeholders, so a dead vendor cannot widen the policy.
 */
export function getPostHogHosts(): string[] {
  const config = getPostHogConfig()

  if (!config) {
    return []
  }

  return config.apiHost ? [config.apiHost] : CLOUD_HOSTS
}
