/**
 * Drops tool-call syntax that a model writes into its answer as plain text.
 *
 * The route removes the tool definitions for the final step, so that step cannot
 * spend itself on retrieval and leave the visitor with nothing. Nemotron's
 * response to having no tools is not always to answer: sometimes it writes the
 * call it wanted to make, as text, into the content channel —
 *
 *   <tool_call>
 *   <function=read>
 *   <parameter=ids>
 *   ["testimonial-nikka-bernal-batingana"]
 *   </parameter>
 *   </function>
 *   </tool_call>
 *
 * — which reaches the bubble verbatim. A scan of the step change found it on 8 of
 * 88 turns, against 0 on the run before it, so this is a cost of that fix rather
 * than something it uncovered. Telling the model plainly that it has no tools for
 * the final reply is the actual fix; this is the guard for when that does not
 * take, and it belongs on the server because the server is what caused it.
 *
 * Streaming makes this less trivial than a `replace` on the finished text. A
 * marker arrives split across deltas, and the decision to suppress has to be made
 * before any of it is emitted. So the head of the message is held back until it is
 * either long enough to rule an opener out or matches one — at most
 * `DECIDE_AFTER` characters, which is below the threshold of noticing. Everything
 * after that point streams straight through.
 */

/** Openers observed or plausible from a model denied its tools. */
const OPENER =
  /<\s*\|?\s*(?:tool_call|tool▁call|function(?:=|_call\b)|parameter\s*=)/i

/**
 * Longest prefix worth holding for. The longest opener above is `<|tool_call`
 * at 11 characters; 24 leaves room for whitespace variants without ever holding
 * back enough text to be seen as a stall.
 */
const DECIDE_AFTER = 24

/**
 * True when `head` is still short enough that an opener could complete in the
 * next delta. Compared case-insensitively against the literal starts, because a
 * partial marker cannot be matched by the pattern itself.
 */
const PARTIAL =
  /<\s*\|?\s*(?:t(?:o(?:o(?:l(?:_(?:c(?:a(?:l(?:l)?)?)?)?)?)?)?)?|f(?:u(?:n(?:c(?:t(?:i(?:o(?:n)?)?)?)?)?)?)?|p(?:a(?:r(?:a(?:m(?:e(?:t(?:e(?:r)?)?)?)?)?)?)?)?)?$/i

export function createCallSyntaxSuppressor() {
  let decided = false
  let suppressing = false
  let head = ""

  return {
    /** Returns the text safe to emit now, which is often "". */
    push(text: string): string {
      if (suppressing) return ""

      if (decided) return text

      head += text

      if (OPENER.test(head)) {
        suppressing = true
        head = ""
        return ""
      }

      if (head.length < DECIDE_AFTER && PARTIAL.test(head)) return ""

      decided = true
      const flushed = head
      head = ""
      return flushed
    },

    /**
     * Anything still held when the stream ended and no opener ever matched.
     *
     * A remainder that still looks like a half-written marker is dropped rather
     * than emitted: a stream cut off inside `<tool_ca` has nothing in it for the
     * visitor, and no real answer both ends there and matches an opener prefix.
     */
    flush(): string {
      if (suppressing) return ""
      const remaining = head
      head = ""
      decided = true
      return PARTIAL.test(remaining) ? "" : remaining
    },
  }
}
