"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

/**
 * Opens and highlights the passage a chat answer was drawn from.
 *
 * A link from the assistant used to land the visitor at the top of a collapsed
 * section, leaving them to find the sentence the answer quoted. Those links now
 * carry `?hl=<exact phrase>` — either written by the model or, more often,
 * derived server-side from what the answer verbatim reused (see
 * `derive-highlights.ts`). This expands the target if it is collapsed, marks
 * every occurrence of the phrase, and scrolls to the first.
 *
 * Silently does nothing when `hl` is absent or the phrase does not match, which
 * is the intended failure mode: a paraphrased or stale phrase degrades to an
 * ordinary anchor jump rather than to a broken page.
 */

const MARK_ATTRIBUTE = "data-chat-highlight"

/**
 * Marks the chat surfaces themselves, which must never be highlighted.
 *
 * A link with no anchor — `/testimonials?hl=…`, since that page has no per-entry
 * ids — falls back to searching the whole document, and the panel is still open
 * on top of it showing the very sentence being searched for. Without this the
 * assistant's own answer gets marked alongside the page it was citing.
 */
const CHAT_UI_ATTRIBUTE = "data-chat-ui"

/** Long enough to be a real quote, short enough not to paint half the page. */
const MAX_PHRASE_LENGTH = 300

/**
 * Base UI's collapsible is uncontrolled here and rendered from server
 * components, so its open state is only reachable through its trigger. Clicking
 * it is what a visitor would do, and it keeps `ExperiencePositionItem` and
 * `ProjectItem` on the server — turning both into client components to accept an
 * `open` prop would be a far larger change for the same result.
 */
function expandAncestors(target: Element) {
  let node: Element | null = target

  while (node) {
    const collapsible: HTMLElement | null = node.closest(
      '[data-slot="collapsible"]'
    )
    if (!collapsible) break

    const trigger: HTMLElement | null = collapsible.querySelector(
      '[data-slot="collapsible-trigger"]'
    )

    if (trigger?.getAttribute("aria-expanded") === "false") trigger.click()

    node = collapsible.parentElement
  }
}

/** Whitespace-insensitive so a phrase spanning a line wrap still matches. */
function normalize(text: string) {
  return text.replace(/\s+/g, " ")
}

/**
 * Wraps every occurrence of `phrase` beneath `root` in a `<mark>`.
 *
 * Walks text nodes rather than touching `innerHTML`, so the phrase — which
 * arrives from a URL — is only ever compared as text and never parsed as markup.
 * Matching is per text node: a phrase broken across an inline element boundary
 * (a bolded word mid-sentence) is missed, which costs a highlight rather than
 * correctness.
 */
function markMatches(root: Element, phrase: string) {
  const needle = normalize(phrase).toLowerCase()
  if (!needle) return null

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const parent = node.parentElement
      if (!parent) return NodeFilter.FILTER_REJECT

      // Never mark inside a script, a style, or a mark we just added.
      if (/^(script|style|mark)$/i.test(parent.tagName)) {
        return NodeFilter.FILTER_REJECT
      }

      if (parent.closest(`[${CHAT_UI_ATTRIBUTE}]`)) {
        return NodeFilter.FILTER_REJECT
      }

      return normalize(node.nodeValue ?? "")
        .toLowerCase()
        .includes(needle)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT
    },
  })

  const targets: Text[] = []
  let current = walker.nextNode()
  while (current) {
    targets.push(current as Text)
    current = walker.nextNode()
  }

  let first: HTMLElement | null = null

  for (const node of targets) {
    const value = node.nodeValue ?? ""
    const index = normalize(value).toLowerCase().indexOf(needle)
    if (index === -1) continue

    /**
     * The index came from the normalized string, so it has to be mapped back
     * onto the original — collapsing a run of whitespace shifts every offset
     * after it.
     */
    const start = mapNormalizedIndex(value, index)
    const end = mapNormalizedIndex(value, index + needle.length)
    if (start === -1 || end === -1) continue

    const range = document.createRange()
    range.setStart(node, start)
    range.setEnd(node, Math.min(end, value.length))

    const mark = document.createElement("mark")
    mark.setAttribute(MARK_ATTRIBUTE, "true")
    // The site's own text-selection colours, so an assistant highlight reads as
    // "this is the bit" in exactly the way a manual selection does.
    mark.className = "rounded-sm bg-selection px-0.5 text-selection-foreground"

    try {
      range.surroundContents(mark)
    } catch {
      // The range crossed an element boundary. Skip this occurrence.
      continue
    }

    first ??= mark
  }

  return first
}

/** Offset in the original string corresponding to an offset in its normalized form. */
function mapNormalizedIndex(original: string, normalizedIndex: number) {
  let seen = 0
  let previousWasSpace = false

  for (let index = 0; index < original.length; index += 1) {
    if (seen === normalizedIndex) return index

    const isSpace = /\s/.test(original[index])
    if (isSpace && previousWasSpace) continue

    seen += 1
    previousWasSpace = isSpace
  }

  return seen === normalizedIndex ? original.length : -1
}

/**
 * Pulls the anchor and the highlight phrase out of the current URL.
 *
 * `hl` is expected at the very end, inside the fragment
 * (`/experience#position-aeva-1?hl=phrase`), which is not the standard ordering
 * of query and fragment. That is deliberate: the entry urls in the corpus
 * already carry their anchor, so a spec-shaped `?hl=…#anchor` would require the
 * model to splice a parameter into the middle of a url it was told to copy
 * exactly — and in testing it produced `/#education?hl=…#education-uspf`, an
 * anchor that does not exist. "Append at the end" is an instruction that cannot
 * be got wrong, and since both ends of this convention are ours, the fragment is
 * free to hold it.
 *
 * The spec ordering is still accepted, so a link written either way works.
 */
function readTarget() {
  const [hash, hashQuery] = window.location.hash.slice(1).split("?")

  const phrase =
    new URLSearchParams(hashQuery ?? "").get("hl") ??
    new URLSearchParams(window.location.search).get("hl")

  return { id: hash ? decodeURIComponent(hash) : "", phrase }
}

export function HighlightOnArrival() {
  const pathname = usePathname()

  useEffect(() => {
    /**
     * Read off `window` rather than through `useSearchParams`, which would force
     * a Suspense boundary and opt these otherwise-static pages out of
     * prerendering for a purely cosmetic effect.
     */
    const { id, phrase } = readTarget()
    if (!phrase || phrase.length > MAX_PHRASE_LENGTH) return

    const target = id ? document.getElementById(id) : null
    const root = target ?? document.body

    let cancelled = false

    /**
     * Deferred a frame: expanding a collapsible mounts its panel, and the text
     * to mark does not exist until that has painted.
     */
    expandAncestors(root)

    const timer = window.setTimeout(() => {
      if (cancelled) return

      const first = markMatches(root, phrase)
      ;(first ?? target)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      })
    }, 120)

    return () => {
      cancelled = true
      window.clearTimeout(timer)

      // Unwrap on navigation away, so a client-side route change does not leave
      // stale highlights behind on a page that is reused.
      for (const mark of document.querySelectorAll(`mark[${MARK_ATTRIBUTE}]`)) {
        mark.replaceWith(...mark.childNodes)
      }
    }
  }, [pathname])

  return null
}
