/**
 * posthog-js alone was 205 KB and the largest non-React script task on first
 * load. Neither SDK is read during hydration, so both are fetched once the main
 * thread goes idle instead of blocking it. The timeout bounds how long an
 * always-busy thread can hold analytics off.
 */
function onIdle(callback: () => void) {
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(callback, { timeout: 4000 })
  } else {
    window.setTimeout(callback, 2000)
  }
}

const posthogToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN

onIdle(() => {
  if (posthogToken) {
    void import("posthog-js").then(({ default: posthog }) => {
      posthog.init(posthogToken, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
        defaults: "2026-01-30",
      })
    })
  }

  void import("@/lib/openpanel").then(({ getOpenPanel }) => getOpenPanel())
})
