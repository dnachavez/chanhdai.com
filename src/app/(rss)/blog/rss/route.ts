import { BLOG_INFO, SITE_INFO } from "@/config/site"
import { getBlogPosts } from "@/features/doc/data/documents"

export const revalidate = false
export const dynamic = "force-static"

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

export function GET() {
  const itemsXml = getBlogPosts()
    .map((doc) => {
      const url = `${SITE_INFO.url}/blog/${doc.slug}`

      return `<item>
          <title>${escapeXml(doc.metadata.title)}</title>
          <link>${escapeXml(url)}</link>
          <guid isPermaLink="true">${escapeXml(url)}</guid>
          <description>${escapeXml(doc.metadata.description || "")}</description>
          <pubDate>${new Date(doc.metadata.createdAt).toUTCString()}</pubDate>
        </item>`
    })
    .join("\n")

  const rssFeed = `<?xml version="1.0" encoding="UTF-8" ?>
  <rss version="2.0">
    <channel>
      <title>${escapeXml(`Blog | ${SITE_INFO.name}`)}</title>
      <link>${escapeXml(`${SITE_INFO.url}/blog`)}</link>
      <description>${escapeXml(BLOG_INFO.description)}</description>
      ${itemsXml}
    </channel>
  </rss>`

  return new Response(rssFeed, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
    },
  })
}
