/**
 * Repairs for two link defects `gpt-oss-120b` produces on this corpus.
 *
 * Both were observed rather than anticipated, and neither yielded to prompting:
 * the model is told to use ASCII brackets and to keep the excerpt in `?hl=`, and
 * it complies on short entries and reverts on long ones. This is the layer that
 * can actually enforce it.
 *
 * Kept out of the component so it can be tested without a DOM.
 */

/**
 * gpt-oss intermittently emits full-width brackets around link text —
 * `【the GoTeam role】(/experience#position-goteam-1)` — which Markdown does not
 * recognise, so the whole construct renders as literal text with a bare path
 * trailing it.
 *
 * Only rewritten where a `(` follows, so a legitimate use of the characters in
 * prose is left alone.
 */
export function normalizeLinkBrackets(text: string) {
  return text.replace(/【([^】]{1,240})】(?=\()/g, "[$1]")
}

/**
 * Below this the link text is a label ("the Aeva role"), not something quoted
 * off the page, and highlighting it would find nothing.
 */
const MIN_EXCERPT_LENGTH = 24

/**
 * Turns a link whose text is itself an excerpt into a link that highlights it.
 *
 * The answer reads better when the sentence being cited *is* the link than when
 * a bare "[the Tolstoy role]" is appended after it, so the prompt asks for the
 * excerpt as link text and this derives the `?hl=` from it. No truncation: the
 * excerpt is the sentence the visitor is reading, and shortening it would break
 * the prose it sits in.
 *
 * An `hl` the model supplied itself is left alone — it knows which fragment it
 * quoted better than a length heuristic does.
 */
export function highlightFromLinkText(href: string, text: string) {
  if (hasHighlight(href)) return href
  if (text.trim().length < MIN_EXCERPT_LENGTH) return href

  return withHighlight(href, text.trim())
}

export function hasHighlight(href: string) {
  return /[?&]hl=/.test(href)
}

export function withHighlight(href: string, phrase: string) {
  const separator = href.includes("?") ? "&" : "?"
  return `${href}${separator}hl=${encodeURIComponent(phrase)}`
}

/**
 * Attaches a server-derived highlight to a link that carries none.
 *
 * The route works out which passage of each retrieved entry the answer actually
 * reused (see `derive-highlights.ts`) and sends the result keyed by entry url.
 * This is where those land, because the model annotates its own links only about
 * half the time — and when it does, its choice is left alone.
 *
 * Matching ignores any existing query and fragment ordering, so a link the model
 * wrote as `/experience#position-aeva-1` still finds the entry keyed under that
 * exact url.
 */
export function applyDerivedHighlight(
  href: string,
  highlights: Record<string, string> | undefined
) {
  if (!highlights || hasHighlight(href)) return href

  const phrase = highlights[href] ?? highlights[stripQuery(href)]
  return phrase ? withHighlight(href, phrase) : href
}

function stripQuery(href: string) {
  const [path, rest = ""] = href.split("#")
  const [cleanPath] = path.split("?")
  const [anchor] = rest.split("?")

  return anchor ? `${cleanPath}#${anchor}` : cleanPath
}

/**
 * The `?hl=` for a link, taking the best-informed source that has one.
 *
 * An `hl` the model wrote itself wins, then the phrase derived server-side from
 * what the answer verbatim reused, then the link text.
 *
 * Link text is last because it is the weakest signal of the three, and reading
 * it first made the highlight worse rather than better: the model routinely
 * links a section's title, and a corpus title like "Senior Full Stack Developer
 * at Aeva AI Receptionist" is composed from two fields that the page renders as
 * separate headings. Long enough to pass for an excerpt, findable nowhere — and
 * it displaced the derived phrase, which would have matched.
 */
export function resolveHighlight(
  href: string,
  linkText: string,
  highlights: Record<string, string> | undefined
) {
  return highlightFromLinkText(
    applyDerivedHighlight(href, highlights),
    linkText
  )
}
