import type { NextConfig } from "next"

import { getPostHogHosts } from "./src/lib/posthog"

/**
 * A nonce is the stronger policy, but it has to be minted per request and read
 * back during render, and reading request headers in the root layout opts every
 * route out of static generation -- which is what put the whole site on
 * `no-store` and a 7.7s cold-start LCP. Next.js inlines the RSC payload as
 * `self.__next_f.push(...)` script tags whose contents change per page, so they
 * can be allowed by a nonce or by `'unsafe-inline'` and by nothing else: there
 * is no hash set that covers them. Trading `script-src` strictness back for a
 * fully static, CDN-cacheable site is the deliberate call here; every other
 * directive stays as tight as it was, and the policy is now enforced rather
 * than report-only.
 */
const isDevelopment = process.env.NODE_ENV !== "production"

/**
 * Dev-only relaxations, none of which reach a deployed build. React's
 * development bundle calls `eval()` to reconstruct callstacks across
 * environments, and Fast Refresh talks to the dev server over a websocket that
 * `'self'` does not cover consistently across browsers. The policy is kept in
 * place rather than skipped in dev so violations surface here first -- shipping
 * it unenforced is how the previous one went a whole release without being
 * exercised.
 */
const developmentScriptSrc = isDevelopment ? [`'unsafe-eval'`] : []
const developmentConnectSrc = isDevelopment ? ["ws:"] : []

const contentSecurityPolicy = [
  `default-src 'self'`,
  /**
   * `data:` covers the base64 `<Script>` in the root layout, the workaround for
   * inline scripts not executing while a not-found page renders.
   */
  [
    `script-src 'self' 'unsafe-inline' data:`,
    ...developmentScriptSrc,
    ...getPostHogHosts(),
  ].join(" "),
  /**
   * Unavoidable: next/font and next/image both emit inline styles, and the
   * duck follower builds its keyframes as a computed `<style>` element.
   */
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob:`,
  `font-src 'self'`,
  [
    `connect-src 'self'`,
    ...developmentConnectSrc,
    ...getPostHogHosts(),
    `https://api.openpanel.dev`,
  ].join(" "),
  `frame-src https://www.youtube.com https://www.youtube-nocookie.com`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `frame-ancestors 'none'`,
  /**
   * Omitted in development: `allowedDevOrigins` includes a plain-http `.local`
   * host, which browsers do not exempt from the upgrade the way they do
   * `localhost`, so every dev subresource would be rewritten to https.
   */
  ...(isDevelopment ? [] : [`upgrade-insecure-requests`]),
].join("; ")

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  transpilePackages: ["next-mdx-remote"],
  allowedDevOrigins: ["dnachavez.localhost", "dnachavez.local"],
  devIndicators: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "assets.chanhdai.com",
        port: "",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        port: "",
      },
    ],
    qualities: [75, 100],
  },
  compiler:
    process.env.NODE_ENV === "production"
      ? {
          removeConsole: {
            exclude: ["error"],
          },
        }
      : undefined,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      /**
       * Files under `public/` default to `max-age=0, must-revalidate`, so every
       * image cost a revalidation round trip on repeat views. Their names carry
       * no content hash, which rules out `immutable`; a short browser lifetime
       * with a long shared one keeps the CDN serving them while a replacement
       * still reaches visitors within the hour. Vercel re-uploads these on each
       * deployment, so `s-maxage` cannot pin a stale file past a release.
       */
      ...["/images", "/fonts", "/audio", "/sounds"].map((directory) => ({
        source: `${directory}/:path*`,
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, s-maxage=31536000",
          },
        ],
      })),
    ]
  },
  async redirects() {
    return [
      {
        source: "/wall-of-love",
        destination: "/testimonials",
        permanent: true,
      },
    ]
  },
  async rewrites() {
    return [
      {
        source: "/blog/:slug.mdx",
        destination: "/doc.mdx/:slug",
      },
      {
        source: "/blog/:slug",
        destination: "/doc.mdx/:slug",
        has: [
          {
            type: "header",
            key: "accept",
            value: "(?<accept>.*text/markdown.*)",
          },
        ],
      },
      {
        source: "/rss",
        destination: "/blog/rss",
      },
    ]
  },
}

export default nextConfig
