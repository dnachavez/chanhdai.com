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
  isTripwireError,
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
 * Overridable so a red team run does not have to compete with the live site for
 * the same scarce resource.
 *
 * `CHAT_MODEL` is `:free`, and OpenRouter meters every free model against one
 * account-wide allowance of 1,000 requests a day. A generated scan is a few
 * hundred turns, so running one spends most of a day's visitor capacity to test
 * capacity — and the first attempt did exactly that, leaving ~200 requests for
 * everyone else. Pointing a scan at a paid model costs cents and draws on the
 * balance instead.
 *
 * Read here rather than in `config.ts` because that module is imported by client
 * components for its copy, and a server-only variable has no business in the
 * browser bundle. Unset in every normal deployment, including production.
 */
const targetModel = () => process.env.CHAT_MODEL_OVERRIDE || CHAT_MODEL

/**
 * Instantiated per request rather than at module scope so the key is read when
 * it is used, matching the guard below — a module-level client would capture an
 * undefined key at import time and fail later with something less legible.
 */
function model(onTrip: (hit: TripwireHit) => void) {
  return wrapLanguageModel({
    model: createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })(
      targetModel()
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
    /**
     * Spends the last step on the answer, by taking the tools away for it.
     *
     * `stopWhen` bounds the loop but does not require any of it to produce text,
     * and the model does not know the budget it is working against. Given three
     * steps it will sometimes use all three on `search` and `read` — the stream
     * then carries three complete tool steps and finishes with no text part at
     * all, and the visitor is shown nothing. A generated scan against the shipped
     * model hit this on 5 of 87 turns, and the regression suite could not see it
     * because its `[[EMPTY]]` assertions only cover eleven fixed payloads.
     *
     * `activeTools: []` rather than `toolChoice: "none"`, which was tried first
     * and does not work here. The SDK sends the directive correctly — a mock
     * provider confirms `tool_choice: "none"` on the third call — but it still
     * sends the tool definitions alongside it, and Nemotron calls them anyway. The
     * next scan came back with the third step making two tool calls under a
     * `none` it had been given and ignored, and empty replies up from 5 to 9.
     * Emptying `activeTools` removes the definitions from the request instead, so
     * there is nothing left to call. It is not a request the provider can decline.
     *
     * Costs nothing: the budget is unchanged at three, and this only decides how
     * the third is spent. A turn that had already answered never reaches here.
     *
     * The model answers from whatever it retrieved in the first two steps, which
     * is the same material it would have had anyway — the grounding rules already
     * cover the case where that is nothing, and "I haven't written about that" is
     * a better reply than an empty bubble.
     */
    prepareStep: ({ stepNumber }) =>
      stepNumber === MAX_STEPS - 1 ? { activeTools: [] } : {},
    /**
     * The floor under all of that: a stream that reaches `finish` having emitted
     * no text gets one sentence put into it.
     *
     * Removing the tools makes an answer overwhelmingly likely, not certain — the
     * same scan caught a final step that ran with nothing to call and still
     * returned neither text nor tool call, because the whole output budget went on
     * reasoning. There is no prompt wording that fixes that, and the visitor is
     * owed something either way.
     *
     * Injected ahead of `finish` so it is part of the same message rather than a
     * second one, and skipped when the stream already carries an error, which the
     * client renders on its own and should not have an answer stapled to.
     */
    experimental_transform: () => {
      let sawText = false
      let sawError = false

      return new TransformStream({
        transform(part, controller) {
          if (part.type === "text-delta" && part.text.trim() !== "") {
            sawText = true
          }
          if (part.type === "error") sawError = true

          if (part.type === "finish" && !sawText && !sawError) {
            const id = "empty-fallback"
            controller.enqueue({ type: "text-start", id })
            controller.enqueue({
              type: "text-delta",
              id,
              text: CHAT_COPY.empty,
            })
            controller.enqueue({ type: "text-end", id })
          }

          controller.enqueue(part)
        },
      })
    },
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
      openrouter: {
        models: [targetModel(), FALLBACK_MODEL],
        /**
         * Bounds the thinking so the answer always has room, and — on a model
         * that leaks its reasoning into the content channel — bounds the leak
         * itself. Every Nemotron here supports it.
         *
         * Not `exclude: true`, which was tried and reverted: that keeps the
         * reasoning and withholds it, so a model that does not cleanly separate
         * the two returns nothing at all. `effort` limits how much is produced
         * in the first place, which is the difference between a short answer and
         * an absent one.
         */
        reasoning: { effort: "low" },
      },
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
      /**
       * Checked first: this one is ours, and it is not a fault. The reply was
       * cut on purpose, so it gets refusal copy rather than an apology.
       */
      if (isTripwireError(error)) return CHAT_COPY.blocked

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
