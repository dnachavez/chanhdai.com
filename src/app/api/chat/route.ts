import { groq } from "@ai-sdk/groq"
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai"
import { z } from "zod"

import {
  CHAT_COPY,
  CHAT_MODEL,
  MAX_HISTORY_MESSAGES,
  MAX_MESSAGE_LENGTH,
  MAX_OUTPUT_TOKENS,
  MAX_STEPS,
  MAX_TURNS_PER_SESSION,
  REASONING_EFFORT,
} from "@/features/chat/config"
import { deriveHighlights } from "@/features/chat/lib/derive-highlights"
import { checkRateLimit, getClientIp } from "@/features/chat/lib/rate-limit"
import { suggestionsFrom } from "@/features/chat/lib/suggest-follow-ups"
import { buildSystemPrompt } from "@/features/chat/lib/system-prompt"
import { createChatTools } from "@/features/chat/lib/tools"
import type { CorpusEntry } from "@/features/chat/types/corpus"

/**
 * The only dynamic route on an otherwise entirely static site. Declared
 * explicitly so a future `output: "export"` or an over-eager prerender pass
 * fails loudly here rather than silently serving a cached answer.
 */
export const dynamic = "force-dynamic"

/** Two model calls plus a synchronous in-process lookup land well inside this. */
export const maxDuration = 30

/**
 * Shape check only. The AI SDK owns the real `UIMessage` contract; this exists
 * so a malformed body returns 400 instead of throwing inside the provider call,
 * and so message length is bounded before anything reaches the model.
 *
 * Unknown keys on a part are stripped, which is safe precisely because history
 * is reduced to text parts below — a tool part surviving this schema would reach
 * the provider as a tool call with no input and throw.
 */
const requestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant"]),
        parts: z.array(
          z.object({ type: z.string(), text: z.string().optional() })
        ),
      })
    )
    .min(1)
    .max(100),
})

type IncomingMessage = z.infer<typeof requestSchema>["messages"][number]

function textOf(message: IncomingMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("")
}

function problem(message: string, status: number, headers?: HeadersInit) {
  return Response.json({ error: message }, { status, headers })
}

/**
 * Groq answers a request that exceeds the account's per-minute token ceiling
 * with 413 (`rate_limit_exceeded`) and a throttled one with 429. Both mean
 * "wait", not "broken", and telling someone to email instead of retrying loses
 * a visitor who would have had an answer a minute later.
 */
function isUpstreamRateLimit(error: unknown) {
  if (typeof error !== "object" || error === null) return false

  const status = (error as { statusCode?: unknown }).statusCode
  return status === 429 || status === 413
}

/**
 * History reduced to what the next answer actually needs.
 *
 * Reasoning and tool parts come back from the client on every request and are
 * the least valuable tokens in the payload — a previous turn's retrieved entries
 * describe a question already answered, and the model can always look them up
 * again. Dropping them is also what keeps the request schema able to stay this
 * loose. Messages left with no text are dropped entirely rather than sent as an
 * empty turn.
 */
function pruneHistory(messages: IncomingMessage[]) {
  return messages
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message) => ({ role: message.role, text: textOf(message).trim() }))
    .filter((message) => message.text.length > 0)
    .map((message) => ({
      role: message.role,
      parts: [{ type: "text" as const, text: message.text }],
    }))
}

export async function POST(request: Request) {
  /**
   * Absent in local development unless `.env.local` sets it. Treated as "the
   * feature is off" rather than as an error, matching how the analytics clients
   * degrade when their credentials are missing.
   */
  if (!process.env.GROQ_API_KEY) {
    return problem(CHAT_COPY.unavailable, 503)
  }

  const { allowed, retryAfter } = checkRateLimit(getClientIp(request))
  if (!allowed) {
    return problem(CHAT_COPY.rateLimited, 429, {
      "Retry-After": String(retryAfter),
    })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return problem(CHAT_COPY.error, 400)
  }

  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return problem(CHAT_COPY.error, 400)
  }

  const { messages } = parsed.data

  /**
   * Derived from the submitted history rather than tracked server-side, since
   * there is nowhere to keep per-session state. This bounds one honest
   * conversation; the per-IP window is what bounds the rest.
   */
  const assistantTurns = messages.filter(
    (message) => message.role === "assistant"
  ).length

  if (assistantTurns >= MAX_TURNS_PER_SESSION) {
    return problem(CHAT_COPY.sessionEnded, 429)
  }

  const latest = messages[messages.length - 1]
  if (latest.role === "user" && textOf(latest).length > MAX_MESSAGE_LENGTH) {
    return problem(CHAT_COPY.error, 413)
  }

  const asked = messages
    .filter((message) => message.role === "user")
    .map(textOf)

  /** Collected by the tool as it runs, read once the turn finishes. */
  const retrieved: CorpusEntry[] = []

  /**
   * Accumulated so the finished answer can be compared against what was
   * retrieved. `messageMetadata` is handed one stream part at a time and never
   * the whole text, so the only way to have it at `finish` is to keep it.
   */
  let answer = ""

  const recent = pruneHistory(messages) as unknown as UIMessage[]

  const result = streamText({
    model: groq(CHAT_MODEL),
    system: buildSystemPrompt(),
    messages: await convertToModelMessages(recent),
    tools: createChatTools({
      onEntries: (entries) => retrieved.push(...entries),
    }),
    /**
     * One round of retrieval, then the answer. A third step would re-bill the
     * site index against the per-minute ceiling for a question the first lookup
     * has almost always already covered.
     */
    stopWhen: stepCountIs(MAX_STEPS),
    providerOptions: {
      groq: {
        reasoningEffort: REASONING_EFFORT,
        /**
         * Reasoning arrives as its own labelled channel rather than inline in
         * the content, which is what makes it renderable as a "thinking" panel
         * instead of leaking into the answer.
         */
        reasoningFormat: "parsed",
      },
    },
    /** Low but not zero: grounded answers, without reading as canned. */
    temperature: 0.3,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    onChunk: ({ chunk }) => {
      if (chunk.type === "text-delta") answer += chunk.text
    },
    /** Stop billing for a stream the visitor already navigated away from. */
    abortSignal: request.signal,
  })

  return result.toUIMessageStreamResponse({
    /**
     * The thought process shown to the visitor is the lookup activity, not this
     * channel: at low effort it is terse machine notes ("Need lookup
     * experience-aeva-1.") that read as debug output. Not forwarding it also
     * removes it from the critical path, so the panel is not waiting on it.
     *
     * First of two defences against reasoning reaching the bubble regardless —
     * `stripReasoningArtifacts` on the client is the second, because this flag
     * trusts the provider to have labelled the channel correctly, and that is
     * exactly what has been reported failing.
     */
    sendReasoning: false,
    /**
     * Follow-up chips and link highlights ride along on the finished message
     * rather than as separate stream parts, so they arrive bound to the answer
     * that produced them and cannot outlive it. Both are computed after the text
     * is complete, which is why neither delays a single token of it.
     */
    messageMetadata: ({ part }) =>
      part.type === "finish"
        ? {
            suggestions: suggestionsFrom(retrieved, asked),
            highlights: deriveHighlights(retrieved, answer),
          }
        : undefined,
    /** Never surface provider internals; the visitor gets our copy instead. */
    onError: (error) =>
      isUpstreamRateLimit(error) ? CHAT_COPY.busy : CHAT_COPY.error,
  })
}
