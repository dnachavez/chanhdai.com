import { describe, expect, it } from "vitest"

import { createCallSyntaxSuppressor } from "./suppress-call-syntax"

/** Feeds text through in the given pieces and returns what would be emitted. */
function stream(...deltas: string[]) {
  const suppressor = createCallSyntaxSuppressor()
  const out = deltas.map((delta) => suppressor.push(delta)).join("")
  return out + suppressor.flush()
}

describe("createCallSyntaxSuppressor", () => {
  it("drops a tool call the model wrote as text", () => {
    expect(
      stream(
        "<tool_call>\n<function=read>\n<parameter=ids>\n",
        '["testimonial-nikka-bernal-batingana"]\n',
        "</parameter>\n</function>\n</tool_call>"
      )
    ).toBe("")
  })

  it("drops it when the opening marker is split across deltas", () => {
    expect(stream("<tool", "_call>", "\n<function=read>")).toBe("")
  })

  it("passes an ordinary answer through unchanged", () => {
    const answer = "I built an AI phone receptionist at Aeva."
    expect(stream(answer)).toBe(answer)
    expect(stream("I built ", "an AI phone ", "receptionist.")).toBe(
      "I built an AI phone receptionist."
    )
  })

  it("does not eat an answer that merely opens with a bracket", () => {
    expect(stream("<3 that question — I built Aeva.")).toBe(
      "<3 that question — I built Aeva."
    )
  })

  it("keeps a markdown link intact", () => {
    const answer = "See [my work](/experience#position-aeva-1)."
    expect(stream(answer)).toBe(answer)
  })

  it("suppresses only from the marker, never a later mention in prose", () => {
    // The opener is only looked for in the head of the message, so an answer
    // that gets going normally is never truncated by something further in.
    const answer =
      "I have written about how the widget calls its tools, at length, in a post."
    expect(stream(answer)).toBe(answer)
  })

  it("returns nothing when the stream ends mid-marker", () => {
    expect(stream("<tool_ca")).toBe("")
  })
})
