import type { NextConfig } from "next"

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
  /**
   * Content-Security-Policy is deliberately absent. The root layout inlines two
   * IIFEs (theme colour and avatar lights) that a `script-src 'self'` policy
   * would break, so CSP needs nonces or hashes and a layout refactor first.
   * These four are safe to ship as-is.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
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
