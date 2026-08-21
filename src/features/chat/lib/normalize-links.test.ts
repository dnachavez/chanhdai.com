import { describe, expect, it } from "vitest"

import {
  applyDerivedHighlight,
  highlightFromLinkText,
  normalizeLinkBrackets,
  resolveHighlight,
} from "./normalize-links"

/**
 * Both of these exist because of behaviour observed from `gpt-oss-120b` on this
 * corpus, not because of a hypothetical. The cases below are the actual outputs.
 */

describe("normalizeLinkBrackets", () => {
  it("rewrites the full-width brackets gpt-oss emits around link text", () => {
    expect(
      normalizeLinkBrackets(
        "I led it【the GoTeam role】(/experience#position-goteam-1)."
      )
    ).toBe("I led it[the GoTeam role](/experience#position-goteam-1).")
  })

  it("leaves the characters alone in ordinary prose", () => {
    const text = "The post uses 【brackets】 as a stylistic device."
    expect(normalizeLinkBrackets(text)).toBe(text)
  })
})

describe("highlightFromLinkText", () => {
  const excerpt =
    "Led design and rollout of a multi-agent AI automation platform for Fox Three Partners"

  it("makes an excerpt link highlight itself on arrival", () => {
    expect(
      highlightFromLinkText("/experience#position-goteam-1", excerpt)
    ).toBe(`/experience#position-goteam-1?hl=${encodeURIComponent(excerpt)}`)
  })

  it("keeps the excerpt whole rather than truncating it", () => {
    const href = highlightFromLinkText("/experience#position-goteam-1", excerpt)
    expect(decodeURIComponent(href.split("hl=")[1])).toBe(excerpt)
  })

  it("leaves a short label alone, since there is nothing to find", () => {
    expect(highlightFromLinkText("/experience", "the Aeva role")).toBe(
      "/experience"
    )
  })

  it("appends with & when the url already carries a query", () => {
    expect(
      highlightFromLinkText("/experience?ref=chat#position-goteam-1", excerpt)
    ).toContain("&hl=")
  })

  it("does not overwrite an hl the model supplied itself", () => {
    const href = "/#education?hl=1.44%20GPA"
    expect(highlightFromLinkText(href, excerpt)).toBe(href)
  })
})

describe("applyDerivedHighlight", () => {
  const highlights = {
    "/experience#position-aeva-1": "reducing incident resolution time by 60%",
  }

  it("attaches the derived phrase to an unannotated link", () => {
    expect(
      applyDerivedHighlight("/experience#position-aeva-1", highlights)
    ).toBe(
      "/experience#position-aeva-1?hl=reducing%20incident%20resolution%20time%20by%2060%25"
    )
  })

  it("leaves a link the model already annotated alone", () => {
    const href = "/experience#position-aeva-1?hl=60%25"
    expect(applyDerivedHighlight(href, highlights)).toBe(href)
  })

  it("matches an entry url even when the link carries an unrelated query", () => {
    expect(
      applyDerivedHighlight("/experience?ref=chat#position-aeva-1", highlights)
    ).toContain("hl=")
  })

  it("leaves a link with no derived phrase alone", () => {
    expect(applyDerivedHighlight("/projects#project-testify", highlights)).toBe(
      "/projects#project-testify"
    )
  })

  it("is a no-op when the message carries no highlights", () => {
    expect(applyDerivedHighlight("/experience", undefined)).toBe("/experience")
  })
})

describe("resolveHighlight", () => {
  const highlights = {
    "/experience#position-aeva-1": "reducing incident resolution time by 60%",
  }

  /** The link the assistant actually wrote in the report this fixes. */
  const title = "Senior Full Stack Developer at Aeva AI Receptionist"

  it("prefers the derived phrase over link text long enough to pass for an excerpt", () => {
    expect(
      resolveHighlight("/experience#position-aeva-1", title, highlights)
    ).toBe(
      "/experience#position-aeva-1?hl=reducing%20incident%20resolution%20time%20by%2060%25"
    )
  })

  it("falls back to link text when nothing was derived for the page", () => {
    const excerpt =
      "Led design and rollout of a multi-agent AI automation platform"

    expect(
      resolveHighlight("/experience#position-goteam-1", excerpt, highlights)
    ).toBe(`/experience#position-goteam-1?hl=${encodeURIComponent(excerpt)}`)
  })

  it("leaves an hl the model supplied itself alone", () => {
    const href = "/experience#position-aeva-1?hl=60%25"
    expect(resolveHighlight(href, title, highlights)).toBe(href)
  })

  it("leaves a link alone when neither source has a phrase", () => {
    expect(resolveHighlight("/projects", "my projects", highlights)).toBe(
      "/projects"
    )
  })
})
