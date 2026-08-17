"use client"

import type { Route } from "next"
import Link from "next/link"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { LINKABLE_PATHS } from "@/generated/context-bundle"

import { stripReasoningArtifacts } from "../lib/strip-reasoning"

/**
 * `@/components/markdown` wraps `MarkdownAsync`, which only renders on the
 * server. Streaming text has to re-render on the client every chunk, so this
 * uses the synchronous export instead.
 *
 * Plugins are deliberately fewer than the blog's: no `rehypeRaw`, because that
 * would let model output inject arbitrary HTML into the page.
 */

const ALLOWED_PATHS = new Set(LINKABLE_PATHS)

/**
 * Resolves an href to a route this site actually serves.
 *
 * The bundle gives the model real paths and the system prompt forbids inventing
 * others, but neither is enforceable — and a hallucinated `/blog/some-post`
 * would look identical to a real link until clicked. Matching on the pathname
 * lets fragments through (`/#gear`, `/experience#experience-aeva`) while still
 * rejecting slugs that do not exist.
 *
 * Returns null for anything unrecognised, which the renderer shows as plain
 * text rather than a broken link.
 */
function resolveInternalPath(href: string) {
  if (!href.startsWith("/") || href.startsWith("//")) return null

  const [pathname] = href.split(/[?#]/)
  const normalized =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname

  return ALLOWED_PATHS.has(normalized) ? href : null
}

/** Only http(s) leaves the site; `javascript:` and `data:` never render as links. */
function isSafeExternal(href: string) {
  try {
    const { protocol } = new URL(href)
    return protocol === "https:" || protocol === "http:"
  } catch {
    return false
  }
}

export function ChatMarkdown({ children }: { children: string }) {
  const text = stripReasoningArtifacts(children)

  if (!text) return null

  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children }) => {
          if (!href) return <>{children}</>

          const internal = resolveInternalPath(href)
          if (internal) {
            // Cast is safe here and nowhere else: `typedRoutes` cannot verify a
            // string produced at runtime, but this one matched the build-time
            // list of routes the site serves.
            return (
              <Link className="link-underline" href={internal as Route}>
                {children}
              </Link>
            )
          }

          if (isSafeExternal(href)) {
            return (
              <a
                className="link-underline"
                href={href}
                target="_blank"
                rel="nofollow noopener"
              >
                {children}
              </a>
            )
          }

          // Unrecognised internal path or unsafe scheme: keep the words, drop
          // the link, so an invented URL is never clickable.
          return <>{children}</>
        },
      }}
    >
      {text}
    </Markdown>
  )
}
