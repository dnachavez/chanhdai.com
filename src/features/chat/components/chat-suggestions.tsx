"use client"

import { useMemo } from "react"

import { SUGGESTED_OPENERS } from "@/generated/chat-client"

import { MAX_OPENERS, MAX_SUGGESTIONS } from "../config"

/**
 * "What to ask next", offered before the first question and after every answer.
 *
 * Two sources, neither of them a hardcoded list. Openers are generated at build
 * time from the site's own content — the current employer, the newest project,
 * the newest post — so they follow the site instead of going stale. Follow-ups
 * ride in on the answer's metadata, built from the entries the assistant
 * actually read, which is what makes them track the conversation without
 * spending a model call on generating them.
 */
export function ChatSuggestions({
  questions,
  onSelect,
  disabled,
}: {
  questions: readonly string[]
  onSelect: (question: string) => void
  disabled?: boolean
}) {
  if (questions.length === 0) return null

  return (
    <ul className="flex flex-wrap gap-1.5">
      {questions.map((question) => (
        <li key={question} className="flex">
          <button
            type="button"
            disabled={disabled}
            // `tag-base` is the site-wide pill; squared off here to match the
            // rest of the chat surface, which `cn` cannot do for us because the
            // `rounded-full` is inside the utility rather than on the element.
            className="tag-base cursor-pointer rounded-none text-left transition-[background-color,color] ease-out hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => onSelect(question)}
          >
            {question}
          </button>
        </li>
      ))}
    </ul>
  )
}

/**
 * A stable random sample of the opener pool.
 *
 * Sampled per mount rather than per render — a fresh shuffle on every keystroke
 * would rearrange the chips under the visitor's cursor. Sampled at all so two
 * visits do not present an identical menu.
 *
 * The randomness is why the conversation is never server-rendered: a shuffle
 * chosen on the server and a different one chosen on the client is a hydration
 * mismatch on the chip text. See `chat-conversation-client.tsx`, which is where
 * that is dealt with.
 */
export function useOpeners(exclude: readonly string[]) {
  return useMemo(() => {
    const taken = new Set(exclude.map((question) => question.toLowerCase()))
    const pool = SUGGESTED_OPENERS.filter(
      (question) => !taken.has(question.toLowerCase())
    )

    const sampled = [...pool]
    for (let index = sampled.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1))
      ;[sampled[index], sampled[swap]] = [sampled[swap], sampled[index]]
    }

    return sampled.slice(0, MAX_OPENERS)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sample once per mount
  }, [])
}

/**
 * Follow-ups the route attached to a finished message, falling back to openers
 * for turns that needed no retrieval — a greeting or an off-topic refusal has no
 * retrieved entries to derive questions from, and offering nothing there would
 * dead-end the conversation.
 */
export function readSuggestions(metadata: unknown) {
  if (typeof metadata !== "object" || metadata === null) return []

  const { suggestions } = metadata as { suggestions?: unknown }
  if (!Array.isArray(suggestions)) return []

  return suggestions
    .filter((question): question is string => typeof question === "string")
    .slice(0, MAX_SUGGESTIONS)
}

/**
 * The per-entry highlight phrases the route derived from the finished answer.
 * Validated here rather than trusted, since metadata round-trips through
 * `sessionStorage` and could be anything by the time it comes back.
 */
export function readHighlights(metadata: unknown) {
  if (typeof metadata !== "object" || metadata === null) return undefined

  const { highlights } = metadata as { highlights?: unknown }
  if (typeof highlights !== "object" || highlights === null) return undefined

  return Object.fromEntries(
    Object.entries(highlights).filter(
      ([url, phrase]) => typeof phrase === "string" && url.startsWith("/")
    )
  ) as Record<string, string>
}
