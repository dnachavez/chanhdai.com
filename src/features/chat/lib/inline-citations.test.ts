import { describe, expect, it } from "vitest"

import { inlineCitations } from "./inline-citations"

/**
 * The inputs here are shapes `gpt-oss-120b` actually produced on this corpus,
 * including the malformed ones.
 */

describe("inlineCitations", () => {
  it("turns the quoted words into the link", () => {
    const answer =
      'Louis Evans wrote, "We\'ve been really happy with your performance at the company."'
    const highlights = {
      "/testimonials": "We've been really happy with your performance",
    }

    expect(inlineCitations(answer, highlights)).toBe(
      "Louis Evans wrote, \"[We've been really happy with your performance](/testimonials?hl=We've%20been%20really%20happy%20with%20your%20performance)at the company.\"".replace(
        ")at",
        ") at"
      )
    )
  })

  it("keeps the answer's own wording and casing, not the source's", () => {
    const answer = "I reduced Operational Load By 70% for client teams."
    const highlights = { "/experience": "reducing operational load by 70%" }

    // The source phrase differs; nothing matches, so nothing is rewritten.
    expect(inlineCitations(answer, highlights)).toBe(answer)
  })

  it("removes a bracketed bare path with no target", () => {
    expect(inlineCitations("See the testimonials. [/testimonials]", {})).toBe(
      "See the testimonials."
    )
  })

  it("drops a short trailing link once the words above are linked", () => {
    const answer =
      "I led migration of backend services to code — [the Aeva role](/experience#position-aeva-1)."
    const highlights = {
      "/experience#position-aeva-1": "migration of backend services to code",
    }

    const out = inlineCitations(answer, highlights)
    expect(out).toContain("[migration of backend services to code]")
    expect(out).not.toContain("[the Aeva role]")
  })

  it("keeps a second link that is itself an excerpt", () => {
    const answer =
      "I did A. [migration of backend services to code](/experience#position-aeva-1) and also [architected the voice AI integration layer for Vapi](/experience#position-aeva-1)."
    const highlights = {
      "/experience#position-aeva-1": "migration of backend services to code",
    }

    const out = inlineCitations(answer, highlights)
    expect(out).toContain("architected the voice AI integration layer for Vapi")
  })

  it("never rewrites inside an existing link", () => {
    const answer = "[the exact phrase here](/projects#project-testify) stands."
    const highlights = { "/experience": "the exact phrase here" }

    expect(inlineCitations(answer, highlights)).toBe(answer)
  })

  it("never rewrites inside inline code", () => {
    const answer = "Run `the exact phrase here` to start."
    const highlights = { "/experience": "the exact phrase here" }

    expect(inlineCitations(answer, highlights)).toBe(answer)
  })

  it("never rewrites inside a fenced block", () => {
    const answer = "```\nthe exact phrase here\n```"
    const highlights = { "/experience": "the exact phrase here" }

    expect(inlineCitations(answer, highlights)).toBe(answer)
  })

  it("tolerates emphasis inside the phrase", () => {
    const answer = "I cut it by **70%** for client teams."
    const highlights = { "/experience": "by 70% for client teams" }

    expect(inlineCitations(answer, highlights)).toContain(
      "](/experience?hl=by%2070%25%20for%20client%20teams)"
    )
  })

  it("places the longest citation when phrases overlap", () => {
    const answer = "alpha beta gamma delta epsilon"
    const highlights = {
      "/a": "alpha beta",
      "/b": "alpha beta gamma delta epsilon",
    }

    const out = inlineCitations(answer, highlights)
    expect(out).toContain("[alpha beta gamma delta epsilon](/b?hl=")
    expect(out).not.toContain("(/a?hl=")
  })

  it("matches across a restyled apostrophe", () => {
    // The answer says We’ve; the source, and therefore the phrase, says We've.
    const answer = "Louis Evans said, “We’ve been really happy with your work.”"
    const highlights = {
      "/testimonials": "We've been really happy with your work",
    }

    expect(inlineCitations(answer, highlights)).toContain(
      "[We’ve been really happy with your work]("
    )
  })

  it("matches across a restyled dash", () => {
    const answer = "It was a real—time transcription layer."
    const highlights = { "/experience": "real-time transcription layer" }

    expect(inlineCitations(answer, highlights)).toContain("](/experience?hl=")
  })

  it("is a no-op with no highlights", () => {
    const answer = "Plain sentence with [a link](/projects)."
    expect(inlineCitations(answer, undefined)).toBe(answer)
  })

  it("leaves an answer alone when the phrase is not in it", () => {
    const answer = "I worked there for a while."
    expect(inlineCitations(answer, { "/experience": "something else" })).toBe(
      answer
    )
  })

  /**
   * The system prompt used to spend five lines forbidding these two shapes. It no
   * longer does, on the grounds that this function repairs both — so these are
   * what that cut rests on, not incidental coverage. See the Linking note in
   * `system-prompt.ts`.
   */
  describe("shapes the prompt no longer has to forbid", () => {
    const url = "/experience#position-aeva-1"
    const highlights = {
      [url]: "phone receptionist serving ~500 clinics",
    }

    it("rewrites an appended link into an inline one, and drops the label", () => {
      const appended =
        "I built an AI phone receptionist serving ~500 clinics — [the Aeva role](" +
        url +
        ")."

      const output = inlineCitations(appended, highlights)

      expect(output).toContain("[phone receptionist serving ~500 clinics](")
      expect(output).not.toContain("[the Aeva role]")
    })

    it("adds the link when the model wrote none", () => {
      const bare =
        "I built an AI phone receptionist serving ~500 clinics, on React and Node.js."

      expect(inlineCitations(bare, highlights)).toContain(
        "[phone receptionist serving ~500 clinics](" + url
      )
    })

    it("adds nothing when the answer reuses no wording, which is why the prompt still asks for a link", () => {
      const paraphrase =
        "I made a telephone answering robot for medical offices."
      expect(inlineCitations(paraphrase, {})).toBe(paraphrase)
    })
  })
})
