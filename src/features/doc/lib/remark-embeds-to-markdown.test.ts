import { remark } from "remark"
import remarkMdx from "remark-mdx"
import { describe, expect, it } from "vitest"

import { remarkEmbedsToMarkdown } from "@/features/doc/lib/remark-embeds-to-markdown"

const processor = remark().use(remarkMdx).use(remarkEmbedsToMarkdown)

async function render(mdx: string) {
  const file = await processor.process({ value: mdx })
  return String(file).trim()
}

describe("remarkEmbedsToMarkdown", () => {
  it("converts FramedImage to a Markdown image", async () => {
    const result = await render(
      `<FramedImage src="/images/a.webp" alt="A graduating class" width="1400" height="1055" />`
    )
    expect(result).toBe("![A graduating class](/images/a.webp)")
  })

  it("uses the caption as alt text when Photo has no alt", async () => {
    const result = await render(
      `<Photo src="/images/b.webp" caption="Scouting days" />`
    )
    expect(result).toBe("![Scouting days](/images/b.webp)")
  })

  it("keeps a distinct caption as its own line", async () => {
    const result = await render(
      `<Photo src="/images/c.webp" alt="Two scouts in uniform" caption="Scouting days" />`
    )
    expect(result).toBe(
      "![Two scouts in uniform](/images/c.webp)\n\n*Scouting days*"
    )
  })

  it("unwraps Gallery and converts the photos inside it", async () => {
    const result = await render(
      `<Gallery>
  <Photo src="/images/d.webp" caption="One" />
  <Photo src="/images/e.webp" caption="Two" />
</Gallery>`
    )
    expect(result).toBe("![One](/images/d.webp)\n\n![Two](/images/e.webp)")
  })

  it("leaves surrounding prose untouched", async () => {
    const result = await render(
      `Before the photo.\n\n<Photo src="/images/f.webp" caption="Middle" />\n\nAfter the photo.`
    )
    expect(result).toBe(
      "Before the photo.\n\n![Middle](/images/f.webp)\n\nAfter the photo."
    )
  })

  it("drops an embed with no src rather than emitting a broken image", async () => {
    const result = await render(`<Photo caption="No source" />`)
    expect(result).not.toContain("![")
  })
})
