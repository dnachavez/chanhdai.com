import { OpenPanel } from "@openpanel/web"

const clientId = process.env.NEXT_PUBLIC_OPENPANEL_CLIENT_ID

let client: OpenPanel | undefined

/**
 * Constructing the client is what starts screen-view tracking, so the first
 * call has to come from `instrumentation-client` rather than from whichever
 * component happens to fire an event first.
 */
export function getOpenPanel() {
  if (!clientId) return undefined
  client ??= new OpenPanel({ clientId, trackScreenViews: true })
  return client
}
