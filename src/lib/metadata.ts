import { SITE_INFO } from "@/config/site"

/**
 * Open Graph fields that should appear on every page.
 *
 * Next.js replaces the parent `openGraph` object wholesale rather than merging
 * it, so any page declaring its own `openGraph` silently drops `siteName` and
 * `locale` inherited from the root layout. Spread this first in each page's
 * `openGraph` block to put them back:
 *
 *   openGraph: { ...baseOpenGraph, url: "/blog", type: "website" }
 */
export const baseOpenGraph = {
  siteName: SITE_INFO.name,
  locale: "en_US",
} as const
