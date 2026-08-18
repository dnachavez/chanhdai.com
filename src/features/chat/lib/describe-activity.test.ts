import { describe, expect, it } from "vitest"

import { describeActivity, type ActivityPart } from "./describe-activity"

/**
 * The important assertion here is `renders`, which is what the panel actually
 * shows once a turn is over.
 *
 * An earlier version of this suite checked each state in isolation and passed,
 * while the panel rendered only two lines — because a tool part mutates in place
 * and a one-line-per-part renderer keeps just its final state. Asserting the
 * resolved parts together is the only shape of test that catches that.
 */

const search = (state: string, extra: Partial<SearchLike> = {}) =>
  ({ type: "tool-search", state, ...extra }) as ActivityPart

const read = (state: string, extra: Partial<ReadLike> = {}) =>
  ({ type: "tool-read", state, ...extra }) as ActivityPart

type SearchLike = { input: { query: string }; output: { hits: unknown[] } }
type ReadLike = {
  input: { ids: string[] }
  output: { entries: unknown[]; truncated: boolean; notFound?: string[] }
}

/** What the visitor sees: every part flattened, in order. */
const renders = (parts: ActivityPart[]) => parts.flatMap(describeActivity)

const hit = (title: string) => ({
  id: "x",
  title,
  kind: "experience",
  preview: "",
})
const entry = (title: string) => ({ id: "x", title, url: "/x", text: "…" })

describe("describeActivity", () => {
  it("renders searched, found and read once the turn has finished", () => {
    expect(
      renders([
        search("output-available", {
          input: { query: "Nikka Bernal-Batingana" },
          output: { hits: [hit("Testimonial from Nikka Bernal-Batingana")] },
        }),
        read("output-available", {
          input: { ids: ["testimonial-nikka-bernal-batingana"] },
          output: {
            entries: [entry("Testimonial from Nikka Bernal-Batingana")],
            truncated: false,
          },
        }),
      ])
    ).toEqual([
      "Searched for “Nikka Bernal-Batingana”",
      "Found Testimonial from Nikka Bernal-Batingana",
      "Read Testimonial from Nikka Bernal-Batingana",
    ])
  })

  it("keeps the query visible after the search resolves", () => {
    const resolved = renders([
      search("output-available", {
        input: { query: "Aeva" },
        output: { hits: [hit("Senior Full Stack Developer at Aeva")] },
      }),
    ])

    expect(resolved[0]).toContain("Aeva")
    expect(resolved).toHaveLength(2)
  })

  it("is present tense while a step is still running", () => {
    expect(renders([search("input-streaming")])).toEqual([
      "Working out what to search for…",
    ])
    expect(
      renders([search("input-available", { input: { query: "Aeva" } })])
    ).toEqual(["Searching for “Aeva”…"])
    expect(
      renders([read("input-available", { input: { ids: ["a"] } })])
    ).toEqual(["Reading…"])
  })

  it("joins several found titles readably", () => {
    expect(
      renders([
        search("output-available", {
          input: { query: "hackathon" },
          output: { hits: [hit("Alpha"), hit("Beta"), hit("Gamma")] },
        }),
      ])
    ).toEqual(["Searched for “hackathon”", "Found Alpha, Beta and Gamma"])
  })

  it("still reports the query when the search found nothing", () => {
    expect(
      renders([
        search("output-available", {
          input: { query: "kubernetes" },
          output: { hits: [] },
        }),
      ])
    ).toEqual(["Searched for “kubernetes”", "Found nothing"])
  })

  it("counts a multi-entry read while it runs", () => {
    expect(
      renders([read("input-available", { input: { ids: ["a", "b"] } })])
    ).toEqual(["Reading 2 entries…"])
  })

  it("surfaces a guessed id rather than staying silent", () => {
    expect(
      renders([
        read("output-available", {
          input: { ids: ["made-up"] },
          output: { entries: [], truncated: false, notFound: ["made-up"] },
        }),
      ])
    ).toEqual(["That entry does not exist."])
  })

  it("reports a failed step rather than hanging on it", () => {
    expect(
      renders([search("output-error", { input: { query: "Aeva" } })])
    ).toEqual(["Searched for “Aeva”", "That search failed."])
    expect(renders([read("output-error")])).toEqual(["That read failed."])
  })

  it("never leaks a raw tool name or id into the panel", () => {
    const lines = renders([
      search("output-available", {
        input: { query: "Aeva" },
        output: { hits: [hit("The role")] },
      }),
      read("output-available", {
        input: { ids: ["experience-aeva-1"] },
        output: { entries: [entry("The role")], truncated: false },
      }),
    ])

    for (const line of lines) {
      expect(line).not.toMatch(/tool-|experience-aeva-1|\bids\b/)
    }
  })
})
