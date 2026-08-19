/**
 * Adapters between promptfoo and /api/chat.
 *
 * The route speaks the AI SDK v7 UI message stream: an SSE body whose events are
 * JSON objects, with assistant text arriving as `text-delta` parts carrying a
 * `delta` field. Nothing in promptfoo parses that natively, so both directions
 * are hand-written here.
 */

/**
 * Multi-turn strategies (crescendo, goat, mischievous-user) run stateless by
 * default and replay the whole transcript each turn, which reaches this function
 * as a JSON array of `{role, content}`. Single-turn tests arrive as a bare
 * string. Parsing optimistically and falling back is what lets one provider
 * definition serve both without a second config.
 */
function toMessages(prompt) {
  let turns
  try {
    const parsed = JSON.parse(prompt)
    turns = Array.isArray(parsed) ? parsed : null
  } catch {
    turns = null
  }

  if (!turns) turns = [{ role: "user", content: prompt }]

  return turns
    .filter((turn) => turn.role !== "system")
    .map((turn) => ({
      role: turn.role === "assistant" ? "assistant" : "user",
      parts: [{ type: "text", text: String(turn.content ?? "") }],
    }))
}

function transformRequest(prompt) {
  return { messages: toMessages(prompt) }
}

/**
 * Error copy is returned as graded output rather than thrown, so a run that
 * trips the rate limiter fails its assertions visibly instead of reporting a
 * green suite it never actually executed.
 */
function transformResponse(json, text) {
  if (json && typeof json.error === "string") {
    return `[[HTTP_ERROR]] ${json.error}`
  }

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

  if (!answer && errorText) return `[[STREAM_ERROR]] ${errorText}`
  if (!answer) return `[[EMPTY]] ${String(text || "").slice(0, 400)}`
  return answer
}

module.exports = { transformRequest, transformResponse }
