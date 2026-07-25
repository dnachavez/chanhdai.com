import type { BreadcrumbList, WithContext } from "schema-dts"

import { getNonce } from "@/lib/nonce"
import { absoluteUrl } from "@/lib/utils"

export type BreadcrumbItem = {
  name: string
  href: string
}

export function jsonLdBreadcrumbList(
  items: BreadcrumbItem[]
): WithContext<BreadcrumbList> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.href),
    })),
  }
}

/**
 * Reads the nonce itself rather than taking it as a prop, so the ten server
 * components that render structured data do not each have to thread one.
 */
export async function JsonLdScript({ data }: { data: unknown }) {
  const nonce = await getNonce()

  return (
    <script
      nonce={nonce}
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  )
}
