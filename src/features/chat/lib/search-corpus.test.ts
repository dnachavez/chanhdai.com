import { describe, expect, it } from "vitest"

import { CORPUS_ENTRIES } from "@/generated/chat-corpus"

import { MAX_LOOKUP_RESULTS, MAX_TOOL_RESULT_TOKENS } from "../config"
import { searchCorpus, tokenize } from "./search-corpus"

/**
 * Run against the real generated corpus rather than fixtures. The scoring is
 * only worth anything if it works on this content, and a fixture that drifts
 * from the site would pass while the assistant retrieved the wrong entry.
 */

const ids = (query: string, limit = MAX_LOOKUP_RESULTS) =>
  searchCorpus(query, CORPUS_ENTRIES, limit).map((hit) => hit.entry.id)

describe("tokenize", () => {
  it("drops stopwords and single characters", () => {
    expect(tokenize("What did you do at Aeva?")).toEqual(["aeva"])
  })

  it("keeps technology names that contain punctuation", () => {
    expect(tokenize("Do you write C++ or C#?")).toEqual(["write", "c++", "c#"])
  })

  it("returns nothing for a query made entirely of stopwords", () => {
    expect(tokenize("what do you do")).toEqual([])
  })
})

describe("searchCorpus", () => {
  it("finds the GPA in the education entry", () => {
    expect(ids("What is your GPA?")).toContain("education-uspf")
  })

  it("reaches blog post sections by topic, not just the post title", () => {
    const hits = ids("magna cum laude", 6)
    expect(
      hits.some((id) =>
        id.startsWith("writing-the-long-way-to-magna-cum-laude")
      )
    ).toBe(true)
  })

  it("routes a company question to that company's position", () => {
    expect(ids("What did you build at GoTeam?")[0]).toBe("experience-goteam-1")
  })

  it("does not return another company's position for a company query", () => {
    const hits = ids("Tolstoy")
    const otherCompanies = hits.filter(
      (id) => id.startsWith("experience-") && id !== "experience-tolstoy-1"
    )
    expect(otherCompanies).toEqual([])
  })

  it("prefers the entry matching every term over one matching a single term", () => {
    // Nearly every entry on this site mentions AI, so coverage has to win.
    expect(ids("GoTeam AI Specialist")[0]).toBe("experience-goteam-1")
  })

  it("finds testimonials by author name", () => {
    expect(ids("What did Louis Evans say?")).toContain(
      "testimonial-louis-evans"
    )
  })

  it("finds gear by product rather than category", () => {
    expect(ids("MacBook Pro")).toContain("gear-computers")
  })

  it("returns nothing rather than guessing when no term matches", () => {
    expect(ids("kubernetes helm istio")).toEqual([])
  })

  it("returns nothing for a stopword-only query", () => {
    expect(ids("what do you do")).toEqual([])
  })

  it("is deterministic across calls", () => {
    expect(ids("hackathon")).toEqual(ids("hackathon"))
  })

  it("respects the limit", () => {
    expect(ids("AI", 2).length).toBeLessThanOrEqual(2)
  })
})

describe("corpus invariants", () => {
  it("has no entry too large to be served in a single tool result", () => {
    const oversized = CORPUS_ENTRIES.filter(
      (entry) => Math.ceil(entry.text.length / 4) > MAX_TOOL_RESULT_TOKENS
    ).map((entry) => entry.id)

    expect(oversized).toEqual([])
  })

  it("gives every entry a site-relative url and at least one follow-up", () => {
    for (const entry of CORPUS_ENTRIES) {
      expect(entry.url.startsWith("/")).toBe(true)
      expect(entry.followUps.length).toBeGreaterThan(0)
    }
  })
})
