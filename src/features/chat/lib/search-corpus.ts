import type { CorpusEntry } from "../types/corpus"

/**
 * The whole retrieval layer.
 *
 * No embeddings and no vector store, because the corpus is ~13k tokens across
 * 64 entries — small enough that a lexical pass over all of it costs less than
 * a single network round trip to an index would. The scoring exists to pick
 * which handful of entries to spend the tool-result budget on, not to be a
 * search engine.
 *
 * Deliberately pure and synchronous so it can be unit tested against the real
 * generated corpus.
 */

/**
 * Terms carrying no retrieval signal on a personal site. Kept short on purpose:
 * an over-eager list drops the one word that mattered ("do you *use* Rust?").
 */
const STOPWORDS = new Set([
  "a",
  "about",
  "all",
  "an",
  "and",
  "any",
  "are",
  "as",
  "at",
  "be",
  "been",
  "but",
  "by",
  "can",
  "did",
  "do",
  "does",
  "for",
  "from",
  "had",
  "has",
  "have",
  "how",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "just",
  "me",
  "my",
  "of",
  "on",
  "or",
  "so",
  "some",
  "tell",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "they",
  "this",
  "to",
  "up",
  "was",
  "were",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "will",
  "with",
  "you",
  "your",
])

/** Weights, in the order they were tuned: a title hit beats a body mention. */
const TITLE_WEIGHT = 8
const KEYWORD_WEIGHT = 5
const TEXT_WEIGHT = 1

/**
 * A term repeated twenty times in one entry should not outrank an entry that
 * matches every term in the question once.
 */
const MAX_TEXT_HITS_PER_TERM = 4

/**
 * Short terms only count on a word boundary. Without this "ai" scores against
 * "said", "email" and "again", which is enough noise to bury the real hit.
 */
const BOUNDARY_TERM_LENGTH = 4

export function tokenize(text: string) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .map((token) => token.replace(/^[.]+|[.]+$/g, ""))
    .filter((token) => token.length > 1 && !STOPWORDS.has(token))
}

/**
 * Query terms, deduplicated, with a naive singular form added alongside any
 * plural. Full stemming would need a dependency; "projects" finding `project`
 * is most of the benefit.
 */
function queryTerms(query: string) {
  const terms = new Set<string>()

  for (const token of tokenize(query)) {
    terms.add(token)
    if (token.length > 3 && token.endsWith("s")) {
      terms.add(token.slice(0, -1))
    }
  }

  return [...terms]
}

function countOccurrences(haystack: string, term: string) {
  if (term.length >= BOUNDARY_TERM_LENGTH) {
    let count = 0
    let index = haystack.indexOf(term)

    while (index !== -1) {
      count += 1
      index = haystack.indexOf(term, index + term.length)
    }

    return count
  }

  // Escaped because skills legitimately contain regex metacharacters (C++, C#).
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return haystack.match(new RegExp(`\\b${escaped}\\b`, "g"))?.length ?? 0
}

/**
 * Inverse document frequency, the load-bearing part of the scoring.
 *
 * Without it "What did you build at GoTeam?" loses: "build" appears in half the
 * corpus and lands in several entry *titles* ("Building for my university"),
 * which outweighs the single entry whose title is "AI Specialist at GoTeam". A
 * term that narrows the corpus to two entries has to count for more than one
 * that barely narrows it at all.
 */
function inverseDocumentFrequency(
  terms: string[],
  entries: readonly CorpusEntry[]
) {
  const haystacks = entries.map((entry) =>
    `${entry.title}\n${entry.keywords.join("\n")}\n${entry.text}`.toLowerCase()
  )

  return new Map(
    terms.map((term) => {
      const frequency = haystacks.filter(
        (haystack) => countOccurrences(haystack, term) > 0
      ).length

      return [term, Math.log(1 + entries.length / (1 + frequency))]
    })
  )
}

function scoreEntry(
  entry: CorpusEntry,
  terms: string[],
  idf: Map<string, number>
) {
  const title = entry.title.toLowerCase()
  const keywords = entry.keywords.map((keyword) => keyword.toLowerCase())
  const text = entry.text.toLowerCase()

  let score = 0
  let matchedTerms = 0

  for (const term of terms) {
    let termScore = 0

    if (countOccurrences(title, term) > 0) termScore += TITLE_WEIGHT
    if (keywords.some((keyword) => countOccurrences(keyword, term) > 0)) {
      termScore += KEYWORD_WEIGHT
    }

    const textHits = Math.min(
      countOccurrences(text, term),
      MAX_TEXT_HITS_PER_TERM
    )
    termScore += textHits * TEXT_WEIGHT

    if (termScore > 0) matchedTerms += 1
    score += termScore * (idf.get(term) ?? 1)
  }

  if (matchedTerms === 0) return 0

  /**
   * Coverage multiplier. "GoTeam AI Specialist" should reach the one entry that
   * matches all three terms rather than every entry that happens to say "AI",
   * and on this corpus almost everything says "AI".
   */
  return score * (matchedTerms / terms.length)
}

export type CorpusHit = { entry: CorpusEntry; score: number }

/**
 * Highest scoring entries first, ties broken by corpus order so the same query
 * always returns the same entries in the same order.
 */
export function searchCorpus(
  query: string,
  entries: readonly CorpusEntry[],
  limit: number
): CorpusHit[] {
  const terms = queryTerms(query)
  if (terms.length === 0) return []

  const idf = inverseDocumentFrequency(terms, entries)

  return entries
    .map((entry, index) => ({
      entry,
      score: scoreEntry(entry, terms, idf),
      index,
    }))
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map(({ entry, score }) => ({ entry, score }))
}
