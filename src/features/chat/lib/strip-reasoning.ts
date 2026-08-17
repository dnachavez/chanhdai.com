/**
 * Removes chain-of-thought that leaked into the visible answer.
 *
 * gpt-oss models emit Harmony-format channels, and Groq is supposed to keep the
 * `analysis` channel out of `content` and expose it separately. In practice
 * there are standing reports of reasoning surfacing in the content stream
 * anyway. `sendReasoning: false` on the server and part-type filtering on the
 * client both assume the provider labelled things correctly; this function is
 * what catches the case where it did not.
 *
 * Runs against the full accumulated text on each render rather than per chunk,
 * so a marker split across two chunks is still matched once both have arrived.
 * That also means a partial opening marker hides the tail of the message for a
 * frame or two, which is the right trade: briefly showing nothing beats
 * briefly showing the model's private reasoning.
 */

/** Harmony role/channel control tokens, e.g. `<|channel|>analysis<|message|>`. */
const HARMONY_TOKEN = /<\|[a-z_]+\|>/gi

/**
 * The sentinel gpt-oss emits between its analysis and its answer. When it
 * appears in plain text, everything before it is reasoning.
 */
const FINAL_SENTINEL = /assistantfinal/i

/** A complete `<think>…</think>` block, including the multiline body. */
const THINK_BLOCK = /<think>[\s\S]*?<\/think>/gi

/** An opening `<think>` whose closing tag has not streamed in yet. */
const UNTERMINATED_THINK = /<think>[\s\S]*$/i

/**
 * A Harmony `final` channel header. Anything preceding the last one is a
 * previous channel — analysis or commentary — and is not for the reader.
 */
const FINAL_CHANNEL = /<\|channel\|>final<\|message\|>/gi

export function stripReasoningArtifacts(text: string) {
  if (!text) return ""

  let output = text

  // Prefer an explicit final-channel header when one is present: everything
  // before the last is a prior channel, whatever it claimed to be.
  const finalChannelMatches = [...output.matchAll(FINAL_CHANNEL)]
  const lastFinalChannel = finalChannelMatches.at(-1)
  if (lastFinalChannel?.index !== undefined) {
    output = output.slice(lastFinalChannel.index + lastFinalChannel[0].length)
  } else if (FINAL_SENTINEL.test(output)) {
    // Split on the last occurrence — a model that narrates its own format can
    // mention the sentinel before actually emitting it.
    const parts = output.split(FINAL_SENTINEL)
    output = parts[parts.length - 1]
  }

  output = output.replace(THINK_BLOCK, "")
  output = output.replace(UNTERMINATED_THINK, "")
  output = output.replace(HARMONY_TOKEN, "")

  output = output.trimStart()

  /**
   * Only tidy the tail when something was actually removed. Excising a block
   * can strand whitespace at the seam, and two trailing spaces are a hard line
   * break in Markdown — a stray `<br>` mid-answer. Untouched text is returned
   * byte-for-byte instead, because trimming every render would swallow the
   * space between words as each chunk arrives and make the text visibly jump.
   */
  return output === text ? output : output.trimEnd()
}
