import { visit } from "unist-util-visit"

import type { UnistNode, UnistTree } from "@/types/unist"

const IMAGE_COMPONENTS = new Set(["FramedImage", "Photo"])

function stringAttribute(node: UnistNode, name: string) {
  const value = node.attributes?.find(
    (attribute) => attribute.name === name
  )?.value

  return typeof value === "string" ? value : undefined
}

function paragraph(children: UnistNode[]): UnistNode {
  return { type: "paragraph", children }
}

/**
 * Rewrites the site's custom embed components to standard Markdown.
 *
 * remark has no handler for unknown JSX, so without this every `<Photo>` and
 * `<FramedImage>` survives verbatim into `/blog/:slug.mdx` and `/llms-full.txt`
 * — the endpoints written specifically for AI crawlers — interrupting prose
 * with syntax noise mid-passage.
 *
 * `Photo` mirrors the component's own `alt ?? caption` fallback
 * (`src/components/embed.tsx`), so a caption only becomes a separate line when
 * it is not already carrying the alt text.
 */
export function remarkEmbedsToMarkdown() {
  return (tree: UnistTree) => {
    visit(tree, (node: UnistNode, index?: number, parent?: UnistNode) => {
      if (
        node.type !== "mdxJsxFlowElement" ||
        index === undefined ||
        !parent?.children
      ) {
        return
      }

      if (node.name === "Gallery") {
        parent.children.splice(index, 1, ...(node.children ?? []))
        return index
      }

      if (!node.name || !IMAGE_COMPONENTS.has(node.name)) {
        return
      }

      const src = stringAttribute(node, "src")

      if (!src) {
        return
      }

      const caption = stringAttribute(node, "caption")
      const alt = stringAttribute(node, "alt") ?? caption ?? ""

      const replacement = [paragraph([{ type: "image", url: src, alt }])]

      if (caption && caption !== alt) {
        replacement.push(
          paragraph([
            {
              type: "emphasis",
              children: [{ type: "text", value: caption }],
            },
          ])
        )
      }

      parent.children.splice(index, 1, ...replacement)

      return index + replacement.length
    })
  }
}
