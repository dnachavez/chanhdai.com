import { groq } from "@ai-sdk/groq"
import { convertToModelMessages, streamText, type UIMessage } from "ai"
import { z } from "zod"

import {
  CHAT_COPY,
  CHAT_MODEL,
  MAX_HISTORY_MESSAGES,
  MAX_MESSAGE_LENGTH,
  MAX_OUTPUT_TOKENS,
  MAX_TURNS_PER_SESSION,
} from "@/features/chat/config"
import { checkRateLimit, getClientIp } from "@/features/chat/lib/rate-limit"
import { buildSystemPrompt } from "@/features/chat/lib/system-prompt"

/**
 * The only dynamic route on an otherwise entirely static site. Declared
 * explicitly so a future `output: "export"` or an over-eager prerender pass
 * fails loudly here rather than silently serving a cached answer.
 */
export const dynamic = "force-dynamic"

/** Streaming replies at low reasoning effort land well inside this. */
export const maxDuration = 30

/**
 * Shape check only. The AI SDK owns the real `UIMessage` contract; this exists
 * so a malformed body returns 400 instead of throwing inside the provider call,
 * and so message length is bounded before anything reaches the model.
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

function textOf(message: { parts: { type: string; text?: string }[] }) {
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
   * there is nowhere to keep per-session state. Clearing it only takes a page
   * refresh — which is the intent: this bounds one honest conversation, and the
   * per-IP window is what bounds the rest.
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

  /**
   * Only the tail is sent. The system prompt carries a ~13k-token bundle on
   * every request, so history is the one part of the payload that grows without
   * bound, and the oldest turns are the least useful per token.
   */
  const recent = messages.slice(-MAX_HISTORY_MESSAGES) as unknown as UIMessage[]

  const result = streamText({
    model: groq(CHAT_MODEL),
    system: buildSystemPrompt(),
    messages: await convertToModelMessages(recent),
    /**
     * Low effort is a latency decision. The task is extraction and rephrasing
     * from material already in context, not derivation, so additional thinking
     * buys accuracy the grounding rules are better placed to deliver.
     */
    providerOptions: { groq: { reasoningEffort: "low" } },
    /** Low but not zero: grounded answers, without reading as canned. */
    temperature: 0.3,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    /** Stop billing for a stream the visitor already navigated away from. */
    abortSignal: request.signal,
  })

  return result.toUIMessageStreamResponse({
    /**
     * First of three defences against the model's private reasoning reaching
     * the bubble. The client also refuses to render non-text parts, and the
     * accumulated text passes through `stripReasoningArtifacts` before Markdown
     * rendering — because this flag trusts the provider to have labelled the
     * channel correctly, and that is exactly what has been reported failing.
     */
    sendReasoning: false,
    /** Never surface provider internals; the visitor gets our copy instead. */
    onError: (error) =>
      isUpstreamRateLimit(error) ? CHAT_COPY.busy : CHAT_COPY.error,
  })
}
