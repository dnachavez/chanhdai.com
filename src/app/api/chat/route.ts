import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  wrapLanguageModel,
  type UIMessage,
} from "ai"
import { z } from "zod"

import {
  CHAT_COPY,
  CHAT_MODEL,
  FALLBACK_MODEL,
  MAX_HISTORY_MESSAGES,
  MAX_MESSAGE_LENGTH,
  MAX_OUTPUT_TOKENS,
  MAX_STEPS,
  MAX_TURNS_PER_SESSION,
} from "@/features/chat/config"
import { deriveHighlights } from "@/features/chat/lib/derive-highlights"
import {
  createOutputTripwire,
  type TripwireHit,
} from "@/features/chat/lib/output-tripwire"
import { checkRateLimit, getClientIp } from "@/features/chat/lib/rate-limit"
import { suggestionsFrom } from "@/features/chat/lib/suggest-follow-ups"
import { buildSystemPrompt } from "@/features/chat/lib/system-prompt"
import { createChatTools } from "@/features/chat/lib/tools"
import {
  isUpstreamQuotaExhausted,
  isUpstreamRateLimit,
  isUpstreamUnavailable,
} from "@/features/chat/lib/upstream-errors"
import type { CorpusEntry } from "@/features/chat/types/corpus"

/**
 * The only dynamic route on an otherwise entirely static site. Declared
 * explicitly so a future `output: "export"` or an over-eager prerender pass
 * fails loudly here rather than silently serving a cached answer.
 */
export const dynamic = "force-dynamic"

/**
 * Three model calls plus two synchronous in-process searches. Raised from 30
 * with the move to OpenRouter, which routes to a provider rather than serving
 * the model itself and is correspondingly slower per call.
 */
export const maxDuration = 60

/**
 * Instantiated per request rather than at module scope so the key is read when
 * it is used, matching the guard below — a module-level client would capture an
 * undefined key at import time and fail later with something less legible.
 */
function model(onTrip: (hit: TripwireHit) => void) {
  return wrapLanguageModel({
    model: createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })(
      CHAT_MODEL
    ),
    /**
     * Wraps the model rather than post-processing the stream in this file, so it
     * also covers the fallback model — `providerOptions.openrouter.models` routes
     * onward inside the same request, and a check written against the response
     * here would never know which of the two answered.
     */
    middleware: createOutputTripwire({ onTrip }),
  })
}

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
  if (!process.env.OPENROUTER_API_KEY) {
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

  /**
   * A trip is a successful injection reaching production, which is the one event
   * here worth waking up for — it means both the system prompt and whatever the
   * regression suite last asserted were insufficient against a live payload. The
   * question that caused it is logged with it, because the payload is the finding;
   * it goes straight into `redteam/promptfooconfig.yaml` as a new case.
   */
  const onTrip = (hit: TripwireHit) => {
    console.error("[chat] output tripwire", {
      kind: hit.kind,
      marker: hit.marker,
      question: asked.at(-1)?.slice(0, MAX_MESSAGE_LENGTH),
    })
  }

  const result = streamText({
    model: model(onTrip),
    system: buildSystemPrompt(),
    messages: await convertToModelMessages(recent),
    tools: createChatTools({
      onEntries: (entries) => retrieved.push(...entries),
    }),
    /**
     * Search, read, answer. A fourth step would let the model search again
     * when the first attempt missed, which is the one that does not fit under
     * the per-minute ceiling on the free tier.
     */
    stopWhen: stepCountIs(MAX_STEPS),
    /** Low but not zero: grounded answers, without reading as canned. */
    temperature: 0.3,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    /**
     * Fallback for the case retrying cannot fix: the single host behind the
     * primary is down. OpenRouter tries these in order within the one request,
     * so a healthy turn still costs three and never reaches the paid model.
     *
     * `models` sits directly on the provider options, not under an `extraBody`
     * wrapper: `@openrouter/ai-sdk-provider` spreads this object straight into
     * the request body, so a wrapper key is sent verbatim as an unrecognised
     * `extraBody` field while `models` itself stays undefined. That is what this
     * route did for its first release, silently — the AI SDK types
     * `providerOptions` as a loose record, so nothing rejected the wrapper, and
     * the fallback was dead the whole time. Found in a 429 log that printed the
     * request body it had actually sent.
     */
    providerOptions: {
      openrouter: { models: [CHAT_MODEL, FALLBACK_MODEL] },
    },
    onChunk: ({ chunk }) => {
      if (chunk.type === "text-delta") answer += chunk.text
    },
    /** Stop billing for a stream the visitor already navigated away from. */
    abortSignal: request.signal,
  })

  return result.toUIMessageStreamResponse({
    /**
     * The thought process shown to the visitor is the search and read activity,
     * not the model's reasoning channel — which is terse machine notes that read
     * as debug output. Not forwarding it also removes it from the critical path,
     * so the panel is not waiting on it.
     *
     * First of two defences against reasoning reaching the bubble regardless —
     * `stripReasoningArtifacts` on the client is the second, because this flag
     * trusts the provider to have labelled the channel correctly, and that has
     * been reported failing.
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
    /**
     * Never surface provider internals; the visitor gets our copy instead. Four
     * outcomes, because they call for four different things from the reader:
     * come back tomorrow, wait a minute, try again later, or give up and email.
     *
     * Order is load-bearing. An exhausted daily allowance is also a 429, so
     * `isUpstreamRateLimit` matches it too; asking it second is what keeps the
     * broader predicate from claiming the narrower case.
     *
     * `upstream` now means both hosts failed, not one. `FALLBACK_MODEL` covers
     * the single-provider outage, so reaching this branch says the paid model
     * did not answer either — an OpenRouter-wide problem rather than Nvidia
     * having a bad afternoon.
     */
    onError: (error) => {
      if (isUpstreamQuotaExhausted(error)) return CHAT_COPY.exhausted
      if (isUpstreamRateLimit(error)) return CHAT_COPY.busy
      if (isUpstreamUnavailable(error)) return CHAT_COPY.upstream

      /**
       * Only the unclassified case is logged, and only server-side. The three
       * above are known weather — a daily allowance, a per-minute throttle, a
       * provider outage — and logging them would bury this one.
       *
       * This branch previously discarded the error entirely, which is correct
       * for the visitor and useless for anyone debugging. The red team suite
       * found two payloads that reliably land here, and there was nothing in any
       * log to say why.
       */
      console.error("[chat] unclassified upstream error", {
        error: error instanceof Error ? error.stack : error,
        question: asked.at(-1)?.slice(0, MAX_MESSAGE_LENGTH),
      })

      return CHAT_COPY.error
    },
  })
}
