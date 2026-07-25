import { NextResponse, type NextRequest } from "next/server"

/**
 * Ship the policy as report-only first so violations surface in the console and
 * in reports without breaking the page. Flip to `false` once a full pass over
 * the site is clean.
 */
const REPORT_ONLY = true

/** Kept in sync with `NONCE_HEADER` in `src/lib/nonce.ts`. */
const NONCE_HEADER = "x-nonce"

/**
 * posthog-js pulls its own bundles at runtime. `strict-dynamic` covers the
 * script fetches, but XHR/beacon targets still need naming here. The SDK falls
 * back to its US cloud when `NEXT_PUBLIC_POSTHOG_HOST` is unset.
 */
const POSTHOG_HOSTS = process.env.NEXT_PUBLIC_POSTHOG_HOST
  ? [process.env.NEXT_PUBLIC_POSTHOG_HOST]
  : ["https://us.i.posthog.com", "https://us-assets.i.posthog.com"]

function contentSecurityPolicy(nonce: string) {
  return [
    `default-src 'self'`,
    /**
     * `https:` and `'unsafe-inline'` are ignored by any browser that
     * understands `'strict-dynamic'`; they are the documented fallback for
     * those that do not, not a relaxation of the policy.
     */
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https: 'unsafe-inline'`,
    /**
     * Unavoidable: next/font and next/image both emit inline styles, and the
     * duck follower builds its keyframes as a computed `<style>` element.
     */
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self'`,
    `connect-src 'self' ${POSTHOG_HOSTS.join(" ")} https://api.openpanel.dev`,
    `frame-src https://www.youtube.com https://www.youtube-nocookie.com`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ].join("; ")
}

export function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID())

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(NONCE_HEADER, nonce)

  const response = NextResponse.next({ request: { headers: requestHeaders } })

  response.headers.set(
    REPORT_ONLY
      ? "Content-Security-Policy-Report-Only"
      : "Content-Security-Policy",
    contentSecurityPolicy(nonce)
  )

  return response
}

export const config = {
  matcher: [
    /**
     * Everything except prerendered assets and the files served straight from
     * `public/`, none of which execute scripts.
     */
    {
      source:
        "/((?!_next/static|_next/image|images/|audio/|fonts/|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
}
