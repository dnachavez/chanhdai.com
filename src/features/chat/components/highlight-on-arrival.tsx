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
