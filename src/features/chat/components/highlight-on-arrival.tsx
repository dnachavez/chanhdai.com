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

/** A frame or two, so an expanding collapsible has painted its content. */
const EXPAND_DELAY = 120

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
 * Every markable text node beneath `root`, flattened into one string.
 *
 * Searching the concatenation rather than each node in turn is what lets a
 * phrase cross an inline element. "…platform for Fox Three Partners" is three
 * text nodes on the page because the company name is a link, and eighteen of the
 * corpus's entries carry an inline link like it; matching per node found none of
 * them. The marks are applied back per node afterwards, which is the only place
 * a `Range` can safely be surrounded.
 */
function collectText(root: Element) {
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

      return NodeFilter.FILTER_ACCEPT
    },
  })

  const chunks: Array<{ node: Text; start: number }> = []
  let text = ""

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    chunks.push({ node: node as Text, start: text.length })
    text += node.nodeValue ?? ""
  }

  return { chunks, text }
}

/**
 * Whitespace-collapsed text, plus each collapsed character's offset in the
 * original.
 *
 * The map is built in the same pass rather than recovered by a second one, so
 * an offset found in the collapsed string turns back into a DOM offset without
 * two tokenisations having to agree.
 */
function collapseWhitespace(text: string) {
  const offsets: number[] = []
  let collapsed = ""
  let previousWasSpace = false

  for (let index = 0; index < text.length; index += 1) {
    const isSpace = /\s/.test(text[index])
    if (isSpace && previousWasSpace) continue

    collapsed += isSpace ? " " : text[index]
    offsets.push(index)
    previousWasSpace = isSpace
  }

  offsets.push(text.length)

  return { collapsed, offsets }
}

function createMark() {
  const mark = document.createElement("mark")
  mark.setAttribute(MARK_ATTRIBUTE, "true")
  // The site's own text-selection colours, so an assistant highlight reads as
  // "this is the bit" in exactly the way a manual selection does.
  mark.className = "bg-selection text-selection-foreground"
  return mark
}

/**
 * Rounds and pads one occurrence at its ends only.
 *
 * An occurrence broken over an inline element is several marks, and giving each
 * of them the full treatment pinched the highlight at every join — two rounded
 * corners meeting mid-word, which reads as three highlights rather than one
 * sentence.
 */
function styleEdges(marks: HTMLElement[]) {
  marks[0]?.classList.add("rounded-l-sm", "pl-0.5")
  marks[marks.length - 1]?.classList.add("rounded-r-sm", "pr-0.5")
}

/**
 * Wraps every occurrence of `phrase` beneath `root` in one or more `<mark>`s.
 *
 * Walks text nodes rather than touching `innerHTML`, so the phrase — which
 * arrives from a URL — is only ever compared as text and never parsed as markup.
 *
 * Returns the first mark in document order, for the caller to scroll to.
 */
function markMatches(root: Element, phrase: string) {
  const needle = normalize(phrase).trim().toLowerCase()
  if (!needle) return null

  const { chunks, text } = collectText(root)
  const { collapsed, offsets } = collapseWhitespace(text)
  const haystack = collapsed.toLowerCase()

  const spans: Array<[number, number]> = []
  for (
    let at = haystack.indexOf(needle);
    at !== -1;
    at = haystack.indexOf(needle, at + needle.length)
  ) {
    spans.push([offsets[at], offsets[at + needle.length]])
  }

  if (spans.length === 0) return null

  /**
   * Right to left, because surrounding a range splits its text node and leaves
   * the original as the part before the split — so every offset to the left of
   * one that has already been wrapped is still valid, and none of this has to be
   * recomputed as the DOM changes underneath it.
   */
  const marksBySpan: HTMLElement[][] = spans.map(() => [])

  for (let index = chunks.length - 1; index >= 0; index -= 1) {
    const { node, start } = chunks[index]
    const end = start + (node.nodeValue ?? "").length

    for (let span = spans.length - 1; span >= 0; span -= 1) {
      const from = Math.max(spans[span][0], start) - start
      const to = Math.min(spans[span][1], end) - start
      if (to <= from) continue

      // The slice of a match that falls in this node can be the whitespace
      // between two of them, which is a mark with nothing in it.
      if (!(node.nodeValue ?? "").slice(from, to).trim()) continue

      const mark = createMark()
      const range = document.createRange()
      range.setStart(node, from)
      range.setEnd(node, to)
      range.surroundContents(mark)

      marksBySpan[span].push(mark)
    }
  }

  // Filled right to left, so each occurrence's pieces need putting back in
  // reading order before its ends can be told apart.
  for (const marks of marksBySpan) styleEdges(marks.reverse())

  return root.querySelector<HTMLElement>(`mark[${MARK_ATTRIBUTE}]`)
}

/**
 * Unwraps every mark this component added.
 *
 * `normalize()` afterwards because unwrapping leaves the surrounding text split
 * into adjacent nodes, and `markMatches` compares one text node at a time — a
 * second highlight on the same page would silently miss any phrase crossing the
 * seam left by the first.
 */
function clearMarks() {
  for (const mark of document.querySelectorAll(`mark[${MARK_ATTRIBUTE}]`)) {
    const parent = mark.parentNode
    mark.replaceWith(...mark.childNodes)
    parent?.normalize()
  }
}

/**
 * Pulls the anchor and the highlight phrase out of a url.
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
function readTarget(url: string) {
  const { hash, search } = new URL(url, window.location.href)
  const [id, hashQuery] = hash.slice(1).split("?")

  const phrase =
    new URLSearchParams(hashQuery ?? "").get("hl") ??
    new URLSearchParams(search).get("hl")

  return { id: id ? decodeURIComponent(id) : "", phrase }
}

export function HighlightOnArrival() {
  const pathname = usePathname()

  useEffect(() => {
    let cancelled = false
    let timer = 0

    function highlight(url: string) {
      clearMarks()
      window.clearTimeout(timer)

      const { id, phrase } = readTarget(url)
      if (!phrase || phrase.length > MAX_PHRASE_LENGTH) return

      const target = id ? document.getElementById(id) : null
      const root = target ?? document.body

      /**
       * Deferred a frame: expanding a collapsible mounts its panel, and the text
       * to mark does not exist until that has painted.
       */
      expandAncestors(root)

      timer = window.setTimeout(() => {
        if (cancelled) return

        const first = markMatches(root, phrase)
        ;(first ?? target)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        })
      }, EXPAND_DELAY)
    }

    /**
     * Read off `window` rather than through `useSearchParams`, which would force
     * a Suspense boundary and opt these otherwise-static pages out of
     * prerendering for a purely cosmetic effect.
     */
    highlight(window.location.href)

    /**
     * A citation pointing into the page the visitor is already on — the common
     * case, since the panel travels with them and they tend to ask about what
     * they are looking at — changes only the fragment. `usePathname` cannot see
     * that, and the App Router navigates by `pushState`, which fires neither
     * `hashchange` nor `popstate`. So nothing above re-runs and the click does
     * nothing at all.
     *
     * Reading the phrase off the link rather than off `window.location` also
     * sidesteps waiting for the router to commit, and lets the same link work
     * twice in a row.
     *
     * Capture phase because `Link` calls `preventDefault` on its way past, and a
     * listener that ran afterwards could not tell a handled navigation from a
     * cancelled one.
     */
    function onClick(event: MouseEvent) {
      if (event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return
      }

      const target = event.target
      const anchor = target instanceof Element ? target.closest("a") : null
      if (!(anchor instanceof HTMLAnchorElement)) return
      if (anchor.target && anchor.target !== "_self") return

      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin) return
      // A different page changes `pathname`, which re-runs the effect anyway.
      if (url.pathname !== window.location.pathname) return

      highlight(url.href)
    }

    function onPopState() {
      highlight(window.location.href)
    }

    document.addEventListener("click", onClick, true)
    window.addEventListener("popstate", onPopState)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      document.removeEventListener("click", onClick, true)
      window.removeEventListener("popstate", onPopState)

      // Unwrap on navigation away, so a client-side route change does not leave
      // stale highlights behind on a page that is reused.
      clearMarks()
    }
  }, [pathname])

  return null
}
