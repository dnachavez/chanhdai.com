import { describe, expect, it } from "vitest"

import { CORPUS_ENTRIES } from "@/generated/chat-corpus"

import { MAX_SUGGESTIONS } from "../config"
import type { CorpusEntry } from "../types/corpus"
import { suggestionsFrom } from "./suggest-follow-ups"

const entry = (followUps: string[]): CorpusEntry => ({
  id: "test",
  kind: "experience",
  title: "Test",
  url: "/experience",
  keywords: [],
  text: "",
  question: "?",
  followUps,
})

const aeva = CORPUS_ENTRIES.find((e) => e.id === "experience-aeva-1")!

describe("suggestionsFrom", () => {
  it("offers the retrieved entry's follow-ups", () => {
    expect(suggestionsFrom([aeva], [])).toEqual(
      aeva.followUps.slice(0, MAX_SUGGESTIONS)
    )
  })

  it("drops a follow-up that restates the question just asked", () => {
    const suggestions = suggestionsFrom(
      [aeva],
      ["What did you build at Aeva? Use bold for numbers."]
    )

    expect(suggestions).not.toContain(
      "What did you build at Aeva AI Receptionist?"
    )
  })

  it("keeps a question about a different company that shares only a verb", () => {
    // "build" alone is not enough to call these the same question.
    const suggestions = suggestionsFrom([aeva], ["What did you build at Aeva?"])
    expect(suggestions).toContain("What did you build at Tolstoy?")
  })

  it("does not offer the same question twice across entries", () => {
    const entries = [
      entry(["What stack do you use?"]),
      entry(["What stack do you use?", "Where are you based?"]),
    ]

    expect(suggestionsFrom(entries, [])).toEqual([
      "What stack do you use?",
      "Where are you based?",
    ])
  })

  it("respects the suggestion cap", () => {
    const entries = [
      entry(["Alpha thing?", "Beta thing?", "Gamma thing?", "Delta thing?"]),
    ]

    expect(suggestionsFrom(entries, []).length).toBe(MAX_SUGGESTIONS)
  })

  it("returns nothing when no entry was retrieved", () => {
    expect(suggestionsFrom([], ["Hello"])).toEqual([])
  })

  it("filters everything when every follow-up has been asked", () => {
    const entries = [entry(["What stack do you use?"])]
    expect(suggestionsFrom(entries, ["What stack do you use?"])).toEqual([])
  })
})
