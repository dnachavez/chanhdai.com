import { MAX_SUGGESTIONS } from "../config"
import type { CorpusEntry } from "../types/corpus"

/**
 * Turns the entries a lookup actually read into "what to ask next" chips.
 *
 * Deliberately not a second model call: the follow-ups are written at build time
 * against each entry's own fields, so surfacing the ones belonging to entries the
 * assistant just read costs nothing and still tracks the conversation. Anything
 * the visitor has already asked is filtered out, so the chips move forward
 * instead of looping.
 */
export function suggestionsFrom(entries: CorpusEntry[], asked: string[]) {
  const askedTokens = asked.map(significantTokens)
  const offered: Set<string>[] = []
  const suggestions: string[] = []

  for (const entry of entries) {
    for (const question of entry.followUps) {
      const tokens = significantTokens(question)

      const redundant = [...askedTokens, ...offered].some((other) =>
        isSameQuestion(tokens, other)
      )
      if (redundant) continue

      offered.push(tokens)
      suggestions.push(question)
      if (suggestions.length >= MAX_SUGGESTIONS) return suggestions
    }
  }

  return suggestions
}

/**
 * Whether `candidate` is asking what `other` already asked.
 *
 * Overlap rather than string equality, because "What did you build at Aeva AI
 * Receptionist?" is not the same string as "What did you actually build at Aeva?"
 * yet offering it as the next question is the same mistake.
 *
 * The share alone is not enough, though. "What did you build at Tolstoy?" shares
 * exactly one word — "build" — with a question about Aeva, and on a two-word
 * candidate that is already half of it. So a proportion of the candidate must
 * match *and* at least two words must be the same, unless the candidate is
 * wholly contained in what was asked.
 */
function isSameQuestion(candidate: Set<string>, other: Set<string>) {
  let shared = 0
  for (const token of candidate) if (other.has(token)) shared += 1

  if (candidate.size === 0) return true
  if (shared === candidate.size) return true

  return shared >= 2 && shared / candidate.size >= 0.5
}

/** Words that distinguish one question from another; the scaffolding does not. */
const QUESTION_NOISE = new Set([
  "a",
  "about",
  "actually",
  "and",
  "any",
  "are",
  "at",
  "did",
  "do",
  "does",
  "for",
  "from",
  "have",
  "how",
  "in",
  "is",
  "it",
  "me",
  "much",
  "of",
  "on",
  "or",
  "tell",
  "that",
  "the",
  "there",
  "was",
  "were",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "with",
  "you",
  "your",
])

function significantTokens(question: string) {
  return new Set(
    question
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 1 && !QUESTION_NOISE.has(token))
  )
}
