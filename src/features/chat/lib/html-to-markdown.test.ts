import { describe, expect, it } from "vitest"

import { htmlToMarkdown } from "./html-to-markdown"

describe("htmlToMarkdown", () => {
  it("converts inline emphasis", () => {
    expect(
      htmlToMarkdown("<p>a <strong>bold</strong> and <em>soft</em> one</p>")
    ).toBe("a **bold** and _soft_ one")
  })

  it("converts links", () => {
    expect(
      htmlToMarkdown('<p>see <a href="https://example.com">the docs</a></p>')
    ).toBe("see [the docs](https://example.com)")
  })

  it("keeps the words but drops the brackets for an anchor with no href", () => {
    expect(htmlToMarkdown("<p>a <a>jump target</a> here</p>")).toBe(
      "a jump target here"
    )
  })

  it("converts unordered lists", () => {
    expect(htmlToMarkdown("<ul><li>first</li><li>second</li></ul>")).toBe(
      "- first\n- second"
    )
  })

  it("numbers ordered lists", () => {
    expect(htmlToMarkdown("<ol><li>one</li><li>two</li></ol>")).toBe(
      "1. one\n2. two"
    )
  })

  it("indents nested lists", () => {
    expect(
      htmlToMarkdown("<ul><li>outer<ul><li>inner</li></ul></li></ul>")
    ).toBe("- outer\n  - inner")
  })

  it("converts headings", () => {
    expect(htmlToMarkdown("<h2>Title</h2><p>body</p>")).toBe("## Title\n\nbody")
  })

  it("converts inline code", () => {
    expect(htmlToMarkdown("<p>run <code>pnpm dev</code></p>")).toBe(
      "run `pnpm dev`"
    )
  })

  it("fences preformatted blocks without doubling the code delimiter", () => {
    expect(htmlToMarkdown("<pre><code>const a = 1\n</code></pre>")).toBe(
      "```\nconst a = 1\n```"
    )
  })

  it("prefixes blockquotes per line", () => {
    expect(
      htmlToMarkdown("<blockquote><p>one</p><p>two</p></blockquote>")
    ).toBe("> one\n>\n> two")
  })

  it("separates paragraphs with a blank line", () => {
    expect(htmlToMarkdown("<p>one</p><p>two</p>")).toBe("one\n\ntwo")
  })

  it("drops script and style content", () => {
    expect(
      htmlToMarkdown(
        "<style>p{color:red}</style><p>kept</p><script>x()</script>"
      )
    ).toBe("kept")
  })

  it("ignores the decorative bold Google Docs wraps a selection in", () => {
    expect(
      htmlToMarkdown(
        '<b style="font-weight:normal"><p>plain <b>actually bold</b></p></b>'
      )
    ).toBe("plain **actually bold**")
  })

  it("decodes named and numeric entities", () => {
    expect(htmlToMarkdown("<p>a &amp; b &#8212; c &nbsp;d</p>")).toBe(
      "a & b — c d"
    )
  })

  it("collapses source indentation without touching preformatted text", () => {
    expect(htmlToMarkdown("<p>\n  wrapped\n  text\n</p>")).toBe("wrapped text")
    expect(htmlToMarkdown("<pre>  indented\n    more</pre>")).toBe(
      "```\n  indented\n    more\n```"
    )
  })

  it("survives unbalanced markup", () => {
    expect(htmlToMarkdown('<p>a <a href="https://example.com">link')).toBe(
      "a [link](https://example.com)"
    )
  })

  it("returns an empty string for markup with no text", () => {
    expect(htmlToMarkdown("<div><span></span></div>")).toBe("")
  })

  it("passes plain text through unchanged", () => {
    expect(htmlToMarkdown("just words")).toBe("just words")
  })
})
