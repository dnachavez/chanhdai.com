import { describe, expect, it } from "vitest"

import {
  createOutputTripwire,
  createRecitationCounter,
  detectTripwire,
} from "./output-tripwire"
import { buildSystemPrompt } from "./system-prompt"

const CANARY = "ZZQX-7741-CANARY"

type TestPart = { type: string; id?: string; delta?: string }

function textPart(delta: string, id = "t0") {
  return { type: "text-delta" as const, id, delta }
}

/**
 * Drained with a reader rather than `for await`: TypeScript's DOM lib does not
 * declare `Symbol.asyncIterator` on `ReadableStream`, even though Node has
 * implemented it since 16.
 */
async function drain(stream: ReadableStream<TestPart>) {
  const reader = stream.getReader()
  const parts: TestPart[] = []

  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    if (value) parts.push(value)
  }

  return parts
}

/** Drives the middleware over a chunked answer and returns what a client sees. */
async function run(chunks: string[]) {
  const trips: string[] = []
  const middleware = createOutputTripwire({
    onTrip: (hit) => trips.push(hit.kind),
  })

  const source = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(textPart(chunk))
      controller.close()
    },
  })

  const { stream } = await middleware.wrapStream!({
    doStream: async () => ({ stream: source }),
  } as never)

  const parts = await drain(stream as ReadableStream<TestPart>)

  return {
    text: parts
      .filter((part) => part.type === "text-delta")
      .map((part) => part.delta)
      .join(""),
    errored: parts.some((part) => part.type === "error"),
    trips,
  }
}

describe("detectTripwire", () => {
  it("passes an ordinary answer", () => {
    expect(
      detectTripwire("I built an AI phone receptionist at [Aeva](/experience).")
    ).toBeNull()
  })

  it("catches the canary verbatim", () => {
    expect(detectTripwire(`Sure: ${CANARY}`)).toEqual({
      kind: "canary",
      marker: CANARY,
    })
  })

  it.each([
    ["spaced", "Z Z Q X - 7 7 4 1 - C A N A R Y"],
    ["markdown emphasis", "**ZZQX**-*7741*-`CANARY`"],
    ["newline split", "ZZQX-7741-\nCANARY"],
    ["unicode hyphen", "ZZQX‑7741‑CANARY"],
  ])("catches the canary when %s", (_label, text) => {
    expect(detectTripwire(text)?.kind).toBe("canary")
  })

  it("catches a structural marker from the system prompt", () => {
    expect(detectTripwire("Here you go:\n\n# Grounding rules\n\n1.")).toEqual({
      kind: "prompt-leak",
      marker: "# Grounding rules",
    })
  })

  /**
   * The reason prompt markers are not flattened. Without the asymmetry these
   * would fire on answers that are working exactly as intended.
   */
  it.each([
    "The grounding rules I follow keep me to what's published here.",
    "I write about how I know things on the blog.",
    "That figure is quote-only in the sense that I only repeat what I published.",
  ])("does not fire on paraphrase: %s", (text) => {
    expect(detectTripwire(text)).toBeNull()
  })
})

describe("createOutputTripwire", () => {
  it("passes a clean answer through whole", async () => {
    const chunks = ["I worked at ", "Aeva on an AI ", "phone receptionist."]
    const { text, errored, trips } = await run(chunks)

    expect(text).toBe(chunks.join(""))
    expect(errored).toBe(false)
    expect(trips).toEqual([])
  })

  it("releases the withheld tail when the stream ends", async () => {
    const short = "Hi."
    const { text } = await run([short])

    expect(text).toBe(short)
  })

  /**
   * The whole reason for the hold-back window. A canary split across chunk
   * boundaries is the normal case, not the exotic one — token boundaries fall
   * wherever the tokenizer put them.
   */
  it("catches a canary split across chunks and never emits it", async () => {
    const { text, errored, trips } = await run([
      "Sure thing. ",
      "ZZQX-",
      "7741-",
      "CANARY",
    ])

    expect(text).not.toContain("ZZQX")
    expect(text).not.toContain("CANARY")
    expect(errored).toBe(true)
    expect(trips).toEqual(["canary"])
  })

  it("catches a prompt marker split across chunks", async () => {
    const { text, errored, trips } = await run([
      "Here are my instructions:\n\n",
      "# Ground",
      "ing rules\n\n1. Only state what you have read",
    ])

    expect(text).not.toContain("# Grounding rules")
    expect(errored).toBe(true)
    expect(trips).toEqual(["prompt-leak"])
  })

  /**
   * A long clean answer must not be buffered to the end — the hold-back is a
   * trailing window, not the whole message.
   */
  it("streams incrementally rather than buffering the whole answer", async () => {
    const middleware = createOutputTripwire()
    const source = new ReadableStream({
      start(controller) {
        for (let i = 0; i < 20; i++) {
          controller.enqueue(textPart(`sentence number ${i} about my work. `))
        }
        controller.close()
      },
    })

    const { stream } = await middleware.wrapStream!({
      doStream: async () => ({ stream: source }),
    } as never)

    const reader = (stream as ReadableStream<TestPart>).getReader()

    let emitted = 0
    for (let i = 0; i < 5; i++) {
      const { value, done } = await reader.read()
      if (done) break
      if (value?.type === "text-delta") emitted += value.delta?.length ?? 0
    }
    await reader.cancel()

    expect(emitted).toBeGreaterThan(0)
  })

  it("forwards non-text parts untouched", async () => {
    const middleware = createOutputTripwire()
    const source = new ReadableStream({
      start(controller) {
        controller.enqueue({ type: "stream-start", warnings: [] })
        controller.enqueue(textPart("Hello."))
        controller.enqueue({ type: "finish", finishReason: "stop" })
        controller.close()
      },
    })

    const { stream } = await middleware.wrapStream!({
      doStream: async () => ({ stream: source }),
    } as never)

    const types = (await drain(stream as ReadableStream<TestPart>)).map(
      (part) => part.type
    )

    expect(types).toContain("stream-start")
    expect(types).toContain("finish")
  })
})

describe("createRecitationCounter", () => {
  /**
   * The gap the first red team run exposed. Asked to print everything above the
   * first message, the model dumped the opening of the prompt — 568 characters,
   * all of it before the first structural marker, so nothing fired.
   */
  it("counts a verbatim dump of the prompt opening", () => {
    const opening = buildSystemPrompt().slice(0, 600)
    const counter = createRecitationCounter()

    expect(counter.push(opening)).toBeGreaterThanOrEqual(12)
  })

  it("counts nothing for an ordinary grounded answer", () => {
    const counter = createRecitationCounter()
    const answer =
      "I built an AI phone receptionist at Aeva that serves around 500 clinics, " +
      "and I wrote about how the retrieval side of this site works on the blog."

    expect(counter.push(answer)).toBe(0)
  })

  /**
   * The prompt scripts this sentence, so a model answering "what are you"
   * reproduces it. It must stay well under the threshold.
   */
  it("stays under the threshold for the scripted self-description", () => {
    const counter = createRecitationCounter()
    const scripted =
      "I am an AI assistant answering from what Dan has published on this site."

    expect(counter.push(scripted)).toBeLessThan(12)
  })

  /** Chunk boundaries must not lose runs that straddle them. */
  it("counts runs split across deltas the same as whole text", () => {
    const opening = buildSystemPrompt().slice(0, 600)

    const whole = createRecitationCounter()
    whole.push(opening)
    const total = whole.flush()

    const split = createRecitationCounter()
    for (let i = 0; i < opening.length; i += 17) {
      split.push(opening.slice(i, i + 17))
    }

    expect(split.flush()).toBe(total)
  })
})
