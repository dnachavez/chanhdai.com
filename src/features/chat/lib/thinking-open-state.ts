/**
 * Whether the thought-process panel is open.
 *
 * Split out because it is the part that is easy to get subtly wrong: it depends
 * on three inputs, has to change twice within a single turn, and must stop
 * changing the moment the visitor touches it.
 *
 * The intended shape of a turn:
 *
 *   question sent      → no parts yet, the placeholder shows instead
 *   search/read run    → open, so the wait is legible
 *   first token lands  → closed, because the answer is now the thing to read
 *   turn finished      → stays closed; the trigger is there to reopen it
 *
 * A visitor's own click outranks all of that. Without `pinned`, opening the
 * panel to read along would be undone by the next token.
 */
export function isThinkingOpen({
  pinned,
  isLive,
  hasAnswer,
}: {
  /** The visitor's explicit choice, or null if they have not made one. */
  pinned: boolean | null
  /** True while this message is the one still streaming. */
  isLive: boolean
  /** True once any non-empty answer text has arrived. */
  hasAnswer: boolean
}) {
  if (pinned !== null) return pinned

  return isLive && !hasAnswer
}
