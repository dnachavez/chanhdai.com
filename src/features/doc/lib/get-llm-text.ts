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
 * Renders a doc body to plain Markdown, without the title/description/date
 * wrapper `getLLMText` puts around it.
 *
 * Split out for the chat context bundle, which nests post bodies under its own
 * headings and so has to supply its own frame. Sharing the processor keeps the
 * prose the bot reads byte-identical to the prose `/llms-full.txt` serves.
 */
export async function renderDocBody(content: string) {
  const processed = await processor.process({ value: content })
  return String(processed.value)
}

export async function getLLMText(doc: Doc) {
  const body = await renderDocBody(doc.content)

  return `# ${doc.metadata.title}

${doc.metadata.description}

${body}

Last updated on ${format(new Date(doc.metadata.updatedAt), "MMMM d, yyyy")}`
}
