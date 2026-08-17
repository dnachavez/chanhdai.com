import { describe, expect, it } from "vitest"

import { stripReasoningArtifacts } from "./strip-reasoning"

describe("stripReasoningArtifacts", () => {
  it("passes clean answers through untouched", () => {
    const answer = "I led the multi-agent AI system at Tolstoy."
    expect(stripReasoningArtifacts(answer)).toBe(answer)
  })

  it("keeps only the final Harmony channel", () => {
    const leaked =
      "<|channel|>analysis<|message|>The user wants my role. Check the bundle." +
      "<|end|><|start|>assistant<|channel|>final<|message|>I'm a senior full stack developer."

    expect(stripReasoningArtifacts(leaked)).toBe(
      "I'm a senior full stack developer."
    )
  })

  it("splits on the assistantfinal sentinel when no channel header is present", () => {
    const leaked =
      "analysisWe should answer briefly and cite the page.assistantfinalI work at Aeva."

    expect(stripReasoningArtifacts(leaked)).toBe("I work at Aeva.")
  })

  it("uses the last sentinel so a mention of it does not truncate early", () => {
    const leaked =
      "analysisThe format uses assistantfinal as a marker.assistantfinalHere's the answer."

    expect(stripReasoningArtifacts(leaked)).toBe("Here's the answer.")
  })

  it("removes complete think blocks including multiline bodies", () => {
    const leaked =
      "<think>\nThey asked about GPA.\nIt is 1.44.\n</think>I graduated magna cum laude."

    expect(stripReasoningArtifacts(leaked)).toBe("I graduated magna cum laude.")
  })

  it("hides an unterminated think block while it is still streaming", () => {
    const midStream = "Sure — <think>they want the Tolstoy metrics, which are"

    expect(stripReasoningArtifacts(midStream)).toBe("Sure —")
  })

  it("strips stray control tokens that survive channel handling", () => {
    expect(stripReasoningArtifacts("<|start|>Hello there.<|end|>")).toBe(
      "Hello there."
    )
  })

  it("returns an empty string for empty input", () => {
    expect(stripReasoningArtifacts("")).toBe("")
  })
})
