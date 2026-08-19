/**
 * Custom provider for /api/chat.
 *
 * Replaces promptfoo's built-in `https` provider, which could not express this
 * target. That provider requires a `body` template and treats `transformRequest`
 * as a transform of the *prompt* that then gets interpolated into it — so the
 * request shape has to be static YAML. This route needs two different shapes
 * from the same suite: single-turn tests arrive as a bare string, while the
 * multi-turn strategies replay a whole transcript, and only code can branch on
 * which one it was handed.
 *
 * Owning the fetch also means owning the response parse, which this target needs
 * anyway: the route speaks the AI SDK v7 UI message stream, an SSE body whose
 * assistant text arrives as `text-delta` events carrying a `delta` field, and
 * nothing in promptfoo reads that natively.
 */

const DEFAULT_URL = "http://localhost:3000/api/chat"

/**
 * The route's per-IP limiter is 20/hour and reads the first entry of
 * `x-forwarded-for` — by design; it is documented there as a courtesy control
 * rather than a security boundary. A distinct address per request is what keeps a
 * 10-case suite from spending the budget and then grading 429s as passes.
 */
function syntheticClientIp() {
  const octet = () => Math.floor(Math.random() * 256)
  return `10.${octet()}.${octet()}.${1 + Math.floor(Math.random() * 254)}`
}

/**
 * Multi-turn strategies run stateless by default and replay the full transcript
 * each turn, which reaches a provider as a JSON array of `{role, content}`.
 * Single-turn tests arrive as a bare string. Parsing optimistically and falling
 * back is what lets one provider serve both suites.
 */
function toMessages(prompt) {
  let turns = null

  if (typeof prompt === "string" && prompt.trimStart().startsWith("[")) {
    try {
      const parsed = JSON.parse(prompt)
      if (Array.isArray(parsed)) turns = parsed
    } catch {
      turns = null
    }
  }

  if (!turns) turns = [{ role: "user", content: String(prompt ?? "") }]

  return turns
    .filter((turn) => turn && turn.role !== "system")
    .map((turn) => ({
      role: turn.role === "assistant" ? "assistant" : "user",
      parts: [{ type: "text", text: String(turn.content ?? "") }],
    }))
}

/**
 * Failures are returned as graded output rather than thrown, tagged so the
 * `not-contains` assertions in the config can fail on them. A run that trips the
 * rate limiter or loses the server would otherwise report a green suite it never
 * executed — every tripwire here passes trivially on an empty string.
 */
export function parseStream(text) {
  let answer = ""
  let errorText = ""

  for (const line of String(text || "").split("\n")) {
    const trimmed = line.trim()
    if (!trimmed.startsWith("data:")) continue

    const payload = trimmed.slice(5).trim()
    if (!payload || payload === "[DONE]") continue

    let event
    try {
      event = JSON.parse(payload)
    } catch {
      continue
    }

    if (event.type === "text-delta" && typeof event.delta === "string") {
      answer += event.delta
    } else if (event.type === "error" && event.errorText) {
      errorText = event.errorText
    }
  }

  if (answer) return answer
  if (errorText) return `[[STREAM_ERROR]] ${errorText}`
  return null
}

export default class ChatApiProvider {
  constructor(options = {}) {
    this.config = options.config ?? {}
    this.providerId = options.id ?? "chat-api"
    this.label = options.label ?? "chat-api"
  }

  id() {
    return this.providerId
  }

  async callApi(prompt) {
    const url =
      this.config.url ?? process.env.PROMPTFOO_TARGET_URL ?? DEFAULT_URL

    let response
    let body

    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": syntheticClientIp(),
        },
        body: JSON.stringify({ messages: toMessages(prompt) }),
      })
      body = await response.text()
    } catch (error) {
      /**
       * A genuinely unreachable target is the one case worth reporting as an
       * error rather than as output: it means the suite never ran, which is a
       * different thing from the widget answering badly.
       */
      return { error: `Request to ${url} failed: ${error.message}` }
    }

    if (!response.ok) {
      let detail = body.slice(0, 300)
      try {
        const json = JSON.parse(body)
        if (typeof json.error === "string") detail = json.error
      } catch {
        // Not JSON; the raw prefix above is the better message.
      }
      return { output: `[[HTTP_ERROR]] ${response.status} ${detail}` }
    }

    const answer = parseStream(body)
    if (answer === null) {
      return { output: `[[EMPTY]] ${body.slice(0, 300)}` }
    }

    return { output: answer }
  }
}
