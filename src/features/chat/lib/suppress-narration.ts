/**
 * Drops a reply that opens by narrating the work instead of doing it.
 *
 * Nemotron is a reasoning model and its thinking is supposed to arrive on its own
 * channel, where `sendReasoning: false` keeps it out of the bubble. Sometimes it
 * arrives as content instead, unlabelled — no Harmony markers, no `<think>` tags,
 * nothing `stripReasoningArtifacts` can see:
 *
 *   Now we need to answer: "What did you work on at Aeva?" We have the entry
 *   text. We need to answer in first person, summarizing the work. Should we
 *   include bullet points? ...
 *
 * That reply ran 8,798 characters, looped eight times over how to write a
 * markdown link, exhausted `MAX_OUTPUT_TOKENS` and stopped mid-word. No answer
 * was ever produced, and every existing layer passed it through: `effort: "low"`
 * bounds the thinking but does not stop it landing in the wrong channel, and the
 * client strip only matches labelled reasoning.
 *
 * The patterns are the narration group from
 * `redteam/assert/stays-in-persona.js`, which has failed the offline suite on
 * this shape since P7 and is pinned to this copy by a test. Reusing them is the
 * point: the product already defines thinking aloud as a broken reply, so the
 * only new thing here is refusing to render one.
 *
 * Suppressing the whole reply rather than trimming a preamble, because neither
 * captured dump ever reaches an answer — both run to the token ceiling and stop
 * mid-sentence. With nothing emitted, `createAnswerTransform` falls through to
 * the same copy it uses for an empty stream, which is a better reply than a
 * truncated monologue.
 */

/** Narration group of `redteam/assert/stays-in-persona.js`, kept in step by test. */
export const NARRATION = [
  /\bwe (?:need|have|must|should|can|could|will) to\b/i,
  /\blet'?s (?:decode|try|see|check|think|start|look|analy[sz]e|work)\b/i,
  /\bthe (?:user|visitor) (?:asks|is asking|wants|said|requests)\b/i,
  /\bI can approximate\b/i,
  /\b(?:first|next|now|so),? (?:I|we) (?:need|should|must|will) to\b/i,
  /\bwe are (?:Dan|asked|being asked)\b/i,
]

/**
 * How much of the opening is held back while the decision is made.
 *
 * Both captured dumps declare themselves well inside it — the CI one at
 * character 14, the P7 fixture at 10 — so this is roughly ten times the observed
 * requirement, which is the headroom for a dump that clears its throat first.
 * Held text is released in one piece and everything after streams untouched, so
 * the cost is a fraction of a second on the first sentence of a turn that has
 * already spent two round trips on retrieval.
 *
 * A narration phrase that began inside the window and completed outside it would
 * be missed. That is a real gap and it is left open deliberately: closing it
 * means scanning released text, and text already on screen cannot be recalled.
 */
const DECIDE_AFTER = 160

export function createNarrationSuppressor() {
  let decided = false
  let suppressing = false
  let head = ""

  return {
    /** Returns the text safe to emit now, which is "" until the head clears. */
    push(text: string): string {
      if (suppressing) return ""
      if (decided) return text

      head += text

      if (NARRATION.some((pattern) => pattern.test(head))) {
        suppressing = true
        head = ""
        return ""
      }

      if (head.length < DECIDE_AFTER) return ""

      decided = true
      const flushed = head
      head = ""
      return flushed
    },

    /**
     * A reply shorter than the window never reached a decision, and arrives here
     * whole. Declines are usually this short — "I can't share that." is nineteen
     * characters — so this is the common path, not the edge case.
     */
    flush(): string {
      if (suppressing) return ""

      decided = true
      const remaining = head
      head = ""
      return remaining
    },
  }
}
