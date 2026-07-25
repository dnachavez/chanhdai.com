import type { Event } from "./events-schema"
import { getPostHogConfig } from "./posthog"

export type { Event } from "./events-schema"

/**
 * Every SDK import here is deferred. `trackEvent` is reachable from the copy
 * buttons, the command menu and the overview items, so a static import would
 * pull posthog-js, @openpanel/web and zod into the first chunk of any page
 * rendering one of them -- roughly 250 KB evaluated during hydration to
 * support something that only runs on a click.
 */
export async function trackEvent(input: Event) {
  const posthogConfig = getPostHogConfig()

  const [{ eventSchema }, { getOpenPanel }, posthog] = await Promise.all([
    import("./events-schema"),
    import("./openpanel"),
    // Capturing without a prior `init` is a no-op, so an unconfigured project
    // would download the SDK only to drop the event.
    posthogConfig
      ? import("posthog-js").then(({ default: posthog }) => posthog)
      : undefined,
  ])

  const event = eventSchema.parse(input)

  posthog?.capture(event.name, event.properties)
  getOpenPanel()?.track(event.name, event.properties)
}
