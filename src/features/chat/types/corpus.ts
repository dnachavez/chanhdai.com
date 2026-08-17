/**
 * The retrievable unit of the site.
 *
 * One entry is what the assistant can fetch and read in a single `lookup`
 * result, so the granularity matters: an experience *position* rather than a
 * company, one section of a blog post rather than the whole post. Anything
 * larger than `MAX_TOOL_RESULT_TOKENS` cannot be served whole and is split at
 * build time.
 */
export type CorpusEntryKind =
  | "about"
  | "experience"
  | "project"
  | "education"
  | "award"
  | "certification"
  | "testimonial"
  | "gear"
  | "writing"

export type CorpusEntry = {
  /** Stable, slug-shaped, and quoted back by the model to fetch this entry directly. */
  id: string
  kind: CorpusEntryKind
  title: string
  /** Site-relative path, anchor included where the page has one. */
  url: string
  /**
   * Extra terms the lexical scorer weights above body text — skills, company
   * names, tags. Not shown to the model; they only steer retrieval.
   */
  keywords: string[]
  text: string
  /**
   * The question this entry is the answer to, phrased as a visitor would type
   * it. Doubles as an opening suggestion and as the cross-reference other
   * entries offer, so one string serves both menus.
   */
  question: string
  /**
   * Questions a visitor would plausibly ask *next*, surfaced as chips once this
   * entry has actually been retrieved — which is what makes them contextual
   * without costing a model call.
   *
   * Two kinds, in order: one that goes deeper into this entry, then the
   * `question` of the entries most related to it. The second kind is what makes
   * the chips navigation rather than restatement — a follow-up derived only from
   * the entry just described tends to re-ask the question that retrieved it.
   */
  followUps: string[]
}
