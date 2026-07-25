import type { Event } from "./events-schema"

export type { Event } from "./events-schema"

/**
 * Every import here is deferred. `trackEvent` is reachable from the copy
 * buttons, the command menu and the overview items, so a static import would
 * pull posthog-js, @openpanel/web and zod into the first chunk of any page
 * rendering one of them -- roughly 250 KB evaluated during hydration to
 * support something that only runs on a click.
 */
export async function trackEvent(input: Event) {
  const [{ eventSchema }, { getOpenPanel }, { default: posthog }] =
    await Promise.all([
      import("./events-schema"),
      import("./openpanel"),
      import("posthog-js"),
    ])

  const event = eventSchema.parse(input)

  posthog.capture(event.name, event.properties)
  getOpenPanel()?.track(event.name, event.properties)
}
