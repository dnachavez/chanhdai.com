import { describe, expect, it } from "vitest"

import { CORPUS_ENTRIES } from "@/generated/chat-corpus"

import type { CorpusEntry } from "../types/corpus"
import { deriveHighlights } from "./derive-highlights"

const entry = (overrides: Partial<CorpusEntry>): CorpusEntry => ({
  id: "test",
  kind: "experience",
  title: "Test",
  url: "/experience#position-test-1",
  keywords: [],
  text: "",
  question: "?",
  followUps: [],
  ...overrides,
})

describe("deriveHighlights", () => {
  it("finds the passage an answer reused verbatim", () => {
    const entries = [
      entry({
        text: "- Led migration of backend services from Make.com to code, reducing incident resolution time by 60%.",
      }),
    ]

    const answer =
      "I led migration of backend services from Make.com to code, which cut things down."

    expect(deriveHighlights(entries, answer)).toEqual({
      "/experience#position-test-1":
        "Led migration of backend services from Make.com to code",
    })
  })

  it("preserves the source's casing and punctuation, not the answer's", () => {
    const entries = [
      entry({ text: "- Shipped Real-Time Transcription for calls." }),
    ]
    const answer = "i shipped real-time transcription for calls"

    expect(
      deriveHighlights(entries, answer)["/experience#position-test-1"]
    ).toBe("Shipped Real-Time Transcription for calls")
  })

  it("keeps a percentage attached to its figure", () => {
    const entries = [
      entry({ text: "- Reduced operational load by 70% for client teams." }),
    ]
    const answer = "I reduced operational load by 70% for client teams there."

    expect(
      deriveHighlights(entries, answer)["/experience#position-test-1"]
    ).toBe("Reduced operational load by 70% for client teams")
  })

  it("strips markdown emphasis from the phrase so it can match rendered text", () => {
    const entries = [
      entry({ text: "- Cut latency by **half** across the fleet." }),
    ]
    const answer = "I cut latency by half across the fleet."

    expect(
      deriveHighlights(entries, answer)["/experience#position-test-1"]
    ).toBe("Cut latency by half across the fleet")
  })

  it("ignores metadata lines the page never renders", () => {
    const entries = [
      entry({
        text: "Company: Aeva AI Receptionist\nSkills: React, Node.js\n\n- Built the booking flow.",
      }),
    ]

    // Names the employer and the stack, but reuses none of the prose.
    const answer = "I worked at Aeva AI Receptionist with React and Node.js."

    expect(deriveHighlights(entries, answer)).toEqual({})
  })

  it("returns nothing when the answer only shares a short common phrase", () => {
    const entries = [entry({ text: "- Built the thing for the team." })]
    expect(deriveHighlights(entries, "I built the thing elsewhere.")).toEqual(
      {}
    )
  })

  it("returns nothing for an empty answer", () => {
    expect(deriveHighlights([entry({ text: "- Something." })], "")).toEqual({})
  })

  it("caps a long verbatim quote rather than marking the whole bullet", () => {
    const long = Array.from({ length: 60 }, (_, i) => `word${i}`).join(" ")
    const entries = [entry({ text: long })]

    const phrase = deriveHighlights(entries, long)[
      "/experience#position-test-1"
    ]
    expect(phrase!.split(" ").length).toBeLessThanOrEqual(24)
  })

  it("keeps the longest match when two sections of one post both hit", () => {
    const entries = [
      entry({ url: "/blog/post", text: "alpha beta gamma delta" }),
      entry({
        url: "/blog/post",
        text: "alpha beta gamma delta epsilon zeta eta",
      }),
    ]

    const answer = "alpha beta gamma delta epsilon zeta eta"
    expect(deriveHighlights(entries, answer)["/blog/post"]).toBe(
      "alpha beta gamma delta epsilon zeta eta"
    )
  })

  it("does not let a restyled apostrophe cut the run short", () => {
    const entries = [
      entry({ text: "- We've been really happy with your performance here." }),
    ]
    // The model writes the curly form when it quotes.
    const answer = "He said “We’ve been really happy with your performance”."

    expect(
      deriveHighlights(entries, answer)["/experience#position-test-1"]
    ).toBe("We've been really happy with your performance")
  })

  it("derives a phrase that exists verbatim in the real corpus", () => {
    const aeva = CORPUS_ENTRIES.find((e) => e.id === "experience-aeva-1")!
    const answer =
      "I architected the voice AI integration layer connecting Vapi with custom voice models."

    const phrase = deriveHighlights([aeva], answer)[aeva.url]

    expect(phrase).toBeTruthy()
    expect(aeva.text.replace(/\s+/g, " ")).toContain(phrase)
  })

  it("renders a link down to the words the page shows", () => {
    const entries = [
      entry({
        text: "- Led rollout of a platform for [Fox Three Partners](https://fox3partners.com) across research and analysis.",
      }),
    ]
    const answer =
      "I led rollout of a platform for Fox Three Partners across research and analysis."

    expect(
      deriveHighlights(entries, answer)["/experience#position-test-1"]
    ).toBe(
      "Led rollout of a platform for Fox Three Partners across research and analysis"
    )
  })

  it("drops an image, whose alt text is not on the page either", () => {
    const entries = [
      entry({
        text: "![Graduating class at the commencement](/images/grad.webp)\n\nThe ceremony ran long into the afternoon heat.",
      }),
    ]
    const answer = "The ceremony ran long into the afternoon heat."

    expect(
      deriveHighlights(entries, answer)["/experience#position-test-1"]
    ).toBe("The ceremony ran long into the afternoon heat")
  })

  it("derives a phrase spanning a real corpus entry's inline link", () => {
    const goteam = CORPUS_ENTRIES.find((e) => e.id === "experience-goteam-1")!
    const answer =
      "I built the platform for Fox Three Partners across research, analysis, and project management workflows."

    const phrase = deriveHighlights([goteam], answer)[goteam.url]

    expect(phrase).toContain("Fox Three Partners")
    // The page has no brackets in it, so neither can the phrase.
    expect(phrase).not.toMatch(/[[\]()]/)
  })
})
