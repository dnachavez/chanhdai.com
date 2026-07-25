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
      // Browsers blank the `nonce` attribute after load, which React's
      // hydration check reads as a mismatch. See the note in `app/layout.tsx`.
      // Safe on the payload too: this is a server component, so the markup and
      // the flight payload React compares it against come from the same render.
      suppressHydrationWarning
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  )
}
