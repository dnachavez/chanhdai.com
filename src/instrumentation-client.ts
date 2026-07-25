import { getPostHogConfig } from "@/lib/posthog"

/**
 * posthog-js alone was 205 KB and the largest non-React script task on first
 * load. Neither SDK is read during hydration, so both are fetched once the main
 * thread goes idle instead of blocking it. The timeout bounds how long an
 * always-busy thread can hold analytics off.
 *
 * Each import is also gated on that vendor being configured, so an unconfigured
 * one costs nothing rather than downloading a client it will never construct.
 */
function onIdle(callback: () => void) {
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(callback, { timeout: 4000 })
  } else {
    window.setTimeout(callback, 2000)
  }
}

const posthogConfig = getPostHogConfig()

onIdle(() => {
  if (posthogConfig) {
    void import("posthog-js").then(({ default: posthog }) => {
      posthog.init(posthogConfig.token, {
        api_host: posthogConfig.apiHost,
        defaults: "2026-01-30",
      })
    })
  }

  if (process.env.NEXT_PUBLIC_OPENPANEL_CLIENT_ID) {
    void import("@/lib/openpanel").then(({ getOpenPanel }) => getOpenPanel())
  }
})
