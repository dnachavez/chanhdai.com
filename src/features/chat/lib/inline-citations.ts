import { withHighlight } from "./normalize-links"

/**
 * Turns the cited words themselves into the link.
 *
 * The alternative is what the model does unprompted: write the sentence, then
 * bolt `[the Tolstoy role](/experience#position-tolstoy-1)` onto the end of it.
 * Reading that means reading the claim, then a second fragment that repeats
 * where the claim came from. Linking the words in place says the same thing in
 * one pass.
 *
 * Done here rather than by instruction because instruction did not hold. Asked
 * to link the words themselves, `gpt-oss-120b` produced `[/testimonials]` — a
 * bracket with no target, which Markdown renders as literal text and which is
 * worse than the appended link it replaced. The server already knows which
 * passage each answer reused (see `derive-highlights.ts`), so the mapping needed
 * to do this correctly is available without asking the model for it at all.
 */

/**
 * Regions that must not be rewritten: an existing link's text or target, inline
 * code, and fenced blocks. Wrapping a phrase inside any of them produces broken
 * Markdown rather than a citation.
 */
function maskedRegions(markdown: string) {
  const regions: Array<[number, number]> = []
  const patterns = [
    /\[[^\]]*\]\([^)]*\)/g, // complete links
    /```[\s\S]*?```/g, // fenced code
    /`[^`\n]*`/g, // inline code
  ]

  for (const pattern of patterns) {
    for (
      let match = pattern.exec(markdown);
      match;
      match = pattern.exec(markdown)
    ) {
      regions.push([match.index, match.index + match[0].length])
    }
  }

  return regions
}

function isMasked(
  regions: Array<[number, number]>,
  start: number,
  end: number
) {
  return regions.some(([from, to]) => start < to && end > from)
}

/**
 * Case-insensitive, whitespace-tolerant search for `phrase` in `markdown`.
 *
 * Whitespace differs because the answer may wrap where the source did not, and
 * the source is Markdown the answer reflowed. Returns the span in the original
 * so the answer's own wording and casing survive into the link text.
 */
function findPhrase(
  markdown: string,
  phrase: string,
  regions: Array<[number, number]>
) {
  const words = phrase.trim().split(/\s+/).map(wordPattern)
  if (words.length === 0) return null

  // Emphasis may sit between words in the answer but not in the source, so allow
  // stray markers at the joins rather than requiring a literal match.
  const pattern = new RegExp(words.join("[\\s*_]+"), "gi")

  for (
    let match = pattern.exec(markdown);
    match;
    match = pattern.exec(markdown)
  ) {
    const start = match.index
    const end = start + match[0].length
    if (!isMasked(regions, start, end)) return { start, end, text: match[0] }
  }

  return null
}

/**
 * One word of the phrase, matched regardless of which apostrophe or dash the
 * answer chose. The phrase comes from the source and is searched for in the
 * answer, and the model routinely restyles `We've` to `We’ve` in between.
 */
function wordPattern(word: string) {
  return word
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/['’]/g, "['’]")
    .replace(/[-–—]/g, "[-–—]")
}

/**
 * Bracketed bare paths with no target — `[/testimonials]`, `【/testimonials】` —
 * which Markdown renders as literal text. Emitted when the model is told to link
 * its words and reaches for the syntax without a destination.
 *
 * Full-width brackets are included because that is the form gpt-oss reaches for
 * once the words above it are already linked: `normalizeLinkBrackets` only
 * converts `【…】` that a `(` follows, so the target-less kind arrives here
 * intact. A path is required inside, so `【brackets】` in prose is left alone.
 */
const ORPHAN_PATH_LINK = /\s*[[【](\/[^\]】\s]*)[\]】](?!\()/g

/**
 * A short trailing link, as opposed to a cited excerpt. Removed once the same
 * page is linked from the words above it, so the answer does not carry both.
 */
const SHORT_LABEL_LENGTH = 24

export function inlineCitations(
  markdown: string,
  highlights: Record<string, string> | undefined
) {
  let output = markdown

  if (highlights) {
    // Longest first: a short phrase nested inside a longer one would otherwise
    // consume it and leave the better citation unplaceable.
    const ordered = Object.entries(highlights).sort(
      ([, a], [, b]) => b.length - a.length
    )

    for (const [url, phrase] of ordered) {
      const found = findPhrase(output, phrase, maskedRegions(output))
      if (!found) continue

      const link = `[${found.text}](${withHighlight(url, phrase)})`
      output = output.slice(0, found.start) + link + output.slice(found.end)

      output = dropRedundantLink(output, url)
    }
  }

  return output
    .replace(ORPHAN_PATH_LINK, "")
    .replace(/ +([.,;:!?])/g, "$1")
    .trim()
}

/**
 * Removes a short standalone link to `url`, keeping only the inlined citation.
 *
 * Deliberately conservative: only labels, never excerpts, and only the second
 * occurrence onward, so the link created a moment ago is never the one removed.
 */
function dropRedundantLink(markdown: string, url: string) {
  const pattern = /\[([^\]]*)\]\(([^)]*)\)/g
  let seenInlined = false
  let output = ""
  let cursor = 0

  for (
    let match = pattern.exec(markdown);
    match;
    match = pattern.exec(markdown)
  ) {
    const [whole, label, href] = match
    if (!href.startsWith(url)) continue

    if (!seenInlined) {
      seenInlined = true
      continue
    }

    if (label.trim().length >= SHORT_LABEL_LENGTH) continue

    // Take the separator before it too, so removal does not strand a space.
    let start = match.index
    while (start > 0 && /[\s—–-]/.test(markdown[start - 1])) start -= 1

    output += markdown.slice(cursor, start)
    cursor = match.index + whole.length
  }

  return output + markdown.slice(cursor)
}
