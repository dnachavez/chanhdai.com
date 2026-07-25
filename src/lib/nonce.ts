import { headers } from "next/headers"

/**
 * Header `src/proxy.ts` forwards the per-request nonce on. The literal is
 * repeated there rather than imported from here, because the proxy must not
 * pull `next/headers` into its bundle.
 */
export const NONCE_HEADER = "x-nonce"

export async function getNonce() {
  return (await headers()).get(NONCE_HEADER) ?? undefined
}
