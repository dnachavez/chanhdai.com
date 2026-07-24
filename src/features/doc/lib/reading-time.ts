/** Average adult reading speed for non-technical prose, in words per minute. */
const WORDS_PER_MINUTE = 220

/**
 * Estimates reading time from raw MDX.
 *
 * JSX blocks, code fences, imports and link URLs are stripped first: a post
 * carrying 80-odd `<Photo>` tags would otherwise read as far longer than it is,
 * since the markup outweighs the prose.
 */
export function getReadingTimeMinutes(mdx: string): number {
  const prose = mdx
    .replace(/^---\n[\s\S]*?\n---/, "") // frontmatter
    .replace(/```[\s\S]*?```/g, "") // fenced code
    .replace(/`[^`]*`/g, "") // inline code
    .replace(/<[^>]+>/g, " ") // JSX and HTML tags
    .replace(/^import .*$/gm, "")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1") // keep link text, drop URLs
    .replace(/[#>*_~|-]/g, " ")

  const words = prose.split(/\s+/).filter(Boolean).length

  return Math.max(1, Math.round(words / WORDS_PER_MINUTE))
}
