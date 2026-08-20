import { stepCountIs, streamText, tool } from "ai"
import { MockLanguageModelV3, simulateReadableStream } from "ai/test"
import { describe, expect, it } from "vitest"
import { z } from "zod"

import { CHAT_COPY, MAX_STEPS } from "@/features/chat/config"
import { createAnswerTransform } from "@/features/chat/lib/answer-transform"

/**
 * Two failures the generated scan found and the regression suite structurally
 * cannot: a turn that spends every step on tools and answers nothing, and a turn
 * whose final step returns neither text nor a tool call. Both reach the visitor
 * as an empty bubble, which is the one outcome worse than a wrong answer.
 *
 * Driven through a mock provider rather than the real one because the fix is
 * about what the *request* contains. `toolChoice: "none"` was the first attempt
 * and reads as correct in a log — the assertion below is on the tool definitions
 * being absent, which is the part Nemotron could not ignore.
 */

const searchTool = {
  search: tool({
    description: "search",
    inputSchema: z.object({ query: z.string() }),
    execute: async () => "an entry",
  }),
}

const toolCallChunks = (id: string) =>
  [
    { type: "stream-start", warnings: [] },
    { type: "response-metadata", id, modelId: "m", timestamp: new Date(0) },
    { type: "tool-input-start", id, toolName: "search" },
    { type: "tool-input-delta", id, delta: '{"query":"x"}' },
    { type: "tool-input-end", id },
    {
      type: "tool-call",
      toolCallId: id,
      toolName: "search",
      input: '{"query":"x"}',
    },
    {
      type: "finish",
      finishReason: "tool-calls",
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    },
  ] as never[]

/** A complete stream carrying no content at all — reasoning ate the budget. */
const silentChunks = () =>
  [
    { type: "stream-start", warnings: [] },
    {
      type: "response-metadata",
      id: "s",
      modelId: "m",
      timestamp: new Date(0),
    },
    {
      type: "finish",
      finishReason: "stop",
      usage: { inputTokens: 1, outputTokens: 0, totalTokens: 1 },
    },
  ] as never[]

function run(chunksFor: (step: number) => never[]) {
  const requests: Array<{ toolCount: number }> = []

  const model = new MockLanguageModelV3({
    doStream: async (options: { tools?: unknown[] }) => {
      requests.push({ toolCount: options.tools?.length ?? 0 })
      return {
        stream: simulateReadableStream({
          chunks: chunksFor(requests.length - 1),
        }),
      }
    },
  })

  const result = streamText({
    model,
    prompt: "what did you work on at Aeva?",
    tools: searchTool,
    stopWhen: stepCountIs(MAX_STEPS),
    prepareStep: ({ stepNumber }) =>
      stepNumber === MAX_STEPS - 1 ? { activeTools: [] } : {},
    experimental_transform: createAnswerTransform,
  })

  return { result, requests }
}

describe("the final step", () => {
  it("is sent no tools, so a model that ignores toolChoice cannot call one", async () => {
    const { result, requests } = run((step) => toolCallChunks(`c${step}`))
    await result.consumeStream()

    expect(requests).toHaveLength(MAX_STEPS)
    expect(requests.slice(0, -1).every((r) => r.toolCount === 1)).toBe(true)
    expect(requests.at(-1)?.toolCount).toBe(0)
  })

  it("never lets a turn finish with an empty bubble", async () => {
    const { result } = run(() => silentChunks())

    expect(await result.text).toBe(CHAT_COPY.empty)
  })

  it("never shows a tool call the model wrote as text", async () => {
    const { result } = run(
      () =>
        [
          { type: "stream-start", warnings: [] },
          {
            type: "response-metadata",
            id: "t",
            modelId: "m",
            timestamp: new Date(0),
          },
          { type: "text-start", id: "t" },
          {
            type: "text-delta",
            id: "t",
            delta: "<tool_call>\n<function=read>",
          },
          { type: "text-delta", id: "t", delta: '\n["experience-aeva-1"]' },
          { type: "text-delta", id: "t", delta: "\n</function>\n</tool_call>" },
          { type: "text-end", id: "t" },
          {
            type: "finish",
            finishReason: "stop",
            usage: { inputTokens: 1, outputTokens: 9, totalTokens: 10 },
          },
        ] as never[]
    )

    // Suppressed entirely, so the turn reads as empty and gets the fallback
    // rather than leaking call syntax into the bubble.
    expect(await result.text).toBe(CHAT_COPY.empty)
  })

  it("leaves a real answer alone", async () => {
    const { result } = run(
      () =>
        [
          { type: "stream-start", warnings: [] },
          {
            type: "response-metadata",
            id: "a",
            modelId: "m",
            timestamp: new Date(0),
          },
          { type: "text-start", id: "a" },
          { type: "text-delta", id: "a", delta: "I built Aeva." },
          { type: "text-end", id: "a" },
          {
            type: "finish",
            finishReason: "stop",
            usage: { inputTokens: 1, outputTokens: 3, totalTokens: 4 },
          },
        ] as never[]
    )

    expect(await result.text).toBe("I built Aeva.")
  })
})
