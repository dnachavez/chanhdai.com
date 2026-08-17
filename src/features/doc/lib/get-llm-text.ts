import { format } from "date-fns"
import { remarkHeading } from "fumadocs-core/mdx-plugins/remark-heading"
import { remark } from "remark"
import remarkGfm from "remark-gfm"
import remarkMdx from "remark-mdx"

import { remarkEmbedsToMarkdown } from "@/features/doc/lib/remark-embeds-to-markdown"
import type { Doc } from "@/features/doc/types/document"

const processor = remark()
  .use(remarkMdx)
  .use(remarkGfm)
  .use(remarkHeading)
  .use(remarkEmbedsToMarkdown)

/**
 * MDX body to plain Markdown: components become their text equivalents and
 * embeds become links. Shared with the chat corpus builder, which splits the
 * result by heading — the two must not drift, or the assistant would quote a
 * version of a post that no page ever rendered.
 */
export async function renderDocBody(doc: Doc) {
  return String((await processor.process({ value: doc.content })).value)
}

export async function getLLMText(doc: Doc) {
  const body = await renderDocBody(doc)

  return `# ${doc.metadata.title}

${doc.metadata.description}

${body}

Last updated on ${format(new Date(doc.metadata.updatedAt), "MMMM d, yyyy")}`
}
