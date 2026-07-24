import { TECH_STACK } from "@/features/portfolio/data/tech-stack"
import {
  extractSvgSymbol,
  techStackSymbolId,
} from "@/features/portfolio/lib/tech-stack-sprite"

/**
 * Serves every tech-stack icon as a single SVG sprite of `<symbol>`s, so the
 * homepage can reference each with a short `<use href="...#tech-KEY">` instead
 * of inlining ~65 KB of `<path>` data. That data was otherwise duplicated: once
 * in the page HTML and again in the RSC flight stream. The sprite is a static,
 * immutable, one-time cached request.
 *
 * Built from the same TECH_STACK data the badges render, so the two never drift
 * out of sync -- an icon added to the data is automatically in the sprite.
 */
export const revalidate = false
export const dynamic = "force-static"

export async function GET() {
  const symbols = TECH_STACK.map((item) => {
    const { viewBox, attrs, inner } = extractSvgSymbol(item.icon)
    const open = [
      `<symbol id="${techStackSymbolId(item.key)}"`,
      `viewBox="${viewBox}"`,
      attrs,
    ]
      .filter(Boolean)
      .join(" ")

    return `${open}>${inner}</symbol>`
  }).join("")

  const sprite = `<svg xmlns="http://www.w3.org/2000/svg">${symbols}</svg>`

  return new Response(sprite, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  })
}
