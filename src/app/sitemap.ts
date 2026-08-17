import type { MetadataRoute } from "next"

import { SITE_INFO } from "@/config/site"
import { getBlogPosts } from "@/features/doc/data/documents"

export const revalidate = false
export const dynamic = "force-static"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const blogPosts = getBlogPosts()

  const posts = blogPosts.map((post) => ({
    url: `${SITE_INFO.url}/blog/${post.slug}`,
    lastModified: new Date(post.metadata.updatedAt).toISOString(),
  }))

  /**
   * The blog index genuinely changes when its newest post does, so that date is
   * real. The other static routes have no content-derived timestamp, and a
   * build-time `new Date()` would just restamp them on every deploy — the
   * unreliable-lastmod pattern Google discounts. Omitting the field is valid
   * and more honest than inventing one.
   */
  const latestPostUpdate = blogPosts
    .map((post) => new Date(post.metadata.updatedAt).getTime())
    .reduce((latest, current) => Math.max(latest, current), 0)

  return [
    { url: SITE_INFO.url },
    {
      url: `${SITE_INFO.url}/blog`,
      ...(latestPostUpdate > 0 && {
        lastModified: new Date(latestPostUpdate).toISOString(),
      }),
    },
    { url: `${SITE_INFO.url}/chat` },
    { url: `${SITE_INFO.url}/experience` },
    { url: `${SITE_INFO.url}/projects` },
    { url: `${SITE_INFO.url}/testimonials` },
    ...posts,
  ]
}
