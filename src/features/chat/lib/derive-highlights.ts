import type { CorpusEntry } from "../types/corpus"

/**
 * Works out which passage of a retrieved entry the answer actually used.
 *
 * The system prompt asks the model to annotate its own links with `?hl=`, and it
 * complies inconsistently — reliably on short entries, rarely on long lists of
 * achievements. Rather than keep pushing a prompt that half-holds, this derives
 * the same thing from evidence: the longest run of words the answer and the entry
 * have verbatim in common is, by construction, the passage the answer was drawn
 * from.
 *
 * Matching a contiguous run rather than a whole bullet is deliberate. The client
 * marks matches per DOM text node, so a span crossing an inline element — a
 * bolded word mid-sentence — cannot be wrapped. A run lifted unbroken out of the
 * source text is far likelier to sit in one node.
 */

/** Below this a match is coincidence: "I built the" appears everywhere. */
const MIN_RUN_WORDS = 4

/** Above this the highlight stops being a citation and becomes a wall of colour. */
const MAX_RUN_WORDS = 24

type Token = { word: string; start: number; end: number }

/**
 * Words with their offsets in the source.
 *
 * One pass produces both the comparison tokens and the offsets used to slice the
 * phrase back out, so the two cannot drift — recovering offsets in a second pass
 * means re-deriving the same tokenisation and hoping it agrees.
 *
 * Markdown emphasis is excluded from the token characters rather than stripped
 * first, so `**70%**` tokenises as `70%` at the offset of the digits.
 */
function tokenize(text: string): Token[] {
  const tokens: Token[] = []
  const pattern = /[a-z0-9%+#]+(?:[.\-'’][a-z0-9%+#]+)*/gi

  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    tokens.push({
      /**
       * Typographic apostrophes are folded to straight ones. The model restyles
       * them — the source says `We've` and the answer says `We’ve` — and without
       * this the token splits in two on one side and not the other, which cuts
       * the common run short and starts the citation mid-sentence.
       */
      word: match[0].toLowerCase().replace(/’/g, "'"),
      start: match.index,
      end: match.index + match[0].length,
    })
  }

  return tokens
}

/**
 * Longest common run of words, as a span in `source`.
 *
 * A rolling two-row table rather than the full matrix. Entry texts run to a few
 * hundred words and answers to a hundred, so either would be fine; two rows is
 * the same amount of code.
 */
function longestCommonRun(source: Token[], answer: Token[]) {
  let previous = new Array<number>(answer.length + 1).fill(0)
  let best = { length: 0, end: 0 }

  for (let i = 1; i <= source.length; i += 1) {
    const current = new Array<number>(answer.length + 1).fill(0)

    for (let j = 1; j <= answer.length; j += 1) {
      if (source[i - 1].word !== answer[j - 1].word) continue

      current[j] = Math.min(previous[j - 1] + 1, MAX_RUN_WORDS)
      if (current[j] > best.length) best = { length: current[j], end: i }
    }

    previous = current
  }

  return best
}

/**
 * Metadata lines are not prose on the page.
 *
 * "Company: Aeva AI Receptionist" would match an answer that merely names the
 * employer, producing a highlight over a label the visitor cannot see — the page
 * renders the company name as a heading, not as `Company: …`.
 */
function proseOf(entry: CorpusEntry) {
  return entry.text
    .split("\n")
    .filter((line) => !/^[A-Z][A-Za-z ]{2,20}: /.test(line))
    .join("\n")
}

/**
 * The `?hl=` phrase for each entry the answer drew on, keyed by the entry's url.
 *
 * Entries the answer did not visibly use get no key, so a link to a section
 * mentioned only in passing stays an ordinary anchor jump.
 */
export function deriveHighlights(
  entries: readonly CorpusEntry[],
  answer: string
) {
  const answerTokens = tokenize(answer)
  if (answerTokens.length < MIN_RUN_WORDS) return {}

  const highlights: Record<string, string> = {}

  for (const entry of entries) {
    const prose = proseOf(entry)
    const sourceTokens = tokenize(prose)

    const { length, end } = longestCommonRun(sourceTokens, answerTokens)
    if (length < MIN_RUN_WORDS) continue

    const phrase = prose
      .slice(sourceTokens[end - length].start, sourceTokens[end - 1].end)
      .replace(/[*_`]/g, "")
      .replace(/\s+/g, " ")
      .trim()

    if (!phrase) continue

    // A longer match on the same page wins, so the best citation survives when
    // two sections of one blog post both matched.
    const existing = highlights[entry.url]
    if (!existing || phrase.length > existing.length) {
      highlights[entry.url] = phrase
    }
  }

  return highlights
}
