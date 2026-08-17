"use client"

import { useState } from "react"
import type { UIMessage } from "ai"

import {
  Collapsible,
  CollapsibleChevronsUpDownIcon,
} from "@/components/base/collapsible-animated"
import {
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/base/ui/collapsible"

import type { LookupResult } from "../lib/tools"

/**
 * What the assistant is doing, while it is doing it.
 *
 * Shows the work — which entries are being searched for and read — and not the
 * model's raw reasoning channel. At low reasoning effort that channel is terse
 * machine notes ("Need lookup experience-aeva-1."), which reads as debug output
 * rather than as a thought process, and waiting for it to stream was also what
 * delayed the panel appearing at all. The server no longer forwards it.
 *
 * Opens itself as soon as there is something to show and never closes itself
 * again: a panel that collapses the moment the answer starts pulls the thing the
 * visitor was reading out from under them.
 */

type ToolPart = {
  type: string
  state: string
  input?: { query?: string; ids?: string[] }
  output?: LookupResult
  errorText?: string
}

function isLookupPart(
  part: UIMessage["parts"][number]
): part is ToolPart & UIMessage["parts"][number] {
  return part.type === "tool-lookup"
}

/** One line per lookup, phrased as the work rather than as the tool call. */
function describeLookup(part: ToolPart) {
  const query = part.input?.query
  const ids = part.input?.ids

  switch (part.state) {
    case "input-streaming":
      return "Working out what to look up…"

    case "input-available":
      if (query) return `Looking for “${query}”…`
      if (ids?.length)
        return `Opening ${ids.length === 1 ? "an entry" : `${ids.length} entries`}…`
      return "Looking something up…"

    case "output-available": {
      const titles = part.output?.entries.map((entry) => entry.title) ?? []
      if (titles.length === 0) return "Found nothing on that."
      return `Reading ${titles.join(", ")}`
    }

    case "output-error":
      return "That lookup failed."

    default:
      return "Looking something up…"
  }
}

/**
 * The label on its own, with no disclosure control.
 *
 * Rendered the instant a question is sent — before the assistant message exists,
 * which is the gap that used to read as the widget having ignored the question.
 * There is nothing to expand yet, so there is no chevron to suggest otherwise.
 */
export function ChatThinkingPlaceholder() {
  return (
    <p className="animate-pulse font-mono text-xs text-muted-foreground">
      Thinking…
    </p>
  )
}

export function ChatThinking({
  message,
  isLive,
}: {
  message: UIMessage
  /** True while this message is the one still streaming. */
  isLive: boolean
}) {
  const lookups = message.parts.filter(isLookupPart)

  const hasAnswer = message.parts.some(
    (part) => part.type === "text" && "text" in part && part.text.trim() !== ""
  )

  /**
   * `null` until the visitor touches it, after which their choice wins. Derived
   * rather than synced in an effect, so the open state stays a pure function of
   * whether there is anything to show.
   */
  const [pinnedOpen, setPinnedOpen] = useState<boolean | null>(null)

  if (lookups.length === 0) {
    return isLive && !hasAnswer ? <ChatThinkingPlaceholder /> : null
  }

  return (
    <Collapsible open={pinnedOpen ?? true} onOpenChange={setPinnedOpen}>
      <CollapsibleTrigger className="group flex w-full items-center gap-1.5 rounded-md text-left font-mono text-xs text-muted-foreground transition-colors ease-out hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
        <span className={isLive && !hasAnswer ? "animate-pulse" : undefined}>
          {isLive && !hasAnswer ? "Thinking…" : "Thought process"}
        </span>
        <span className="[&_svg]:size-3">
          <CollapsibleChevronsUpDownIcon duration={0.15} />
        </span>
      </CollapsibleTrigger>

      <CollapsibleContent className="overflow-hidden">
        <ul className="mt-1.5 space-y-0.5 border-l border-line pl-3">
          {lookups.map((part, index) => (
            <li key={index} className="font-mono text-xs text-muted-foreground">
              {describeLookup(part)}
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  )
}
