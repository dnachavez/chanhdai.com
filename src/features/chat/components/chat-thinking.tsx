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

import { describeActivity, isActivityPart } from "../lib/describe-activity"
import { isThinkingOpen } from "../lib/thinking-open-state"

/**
 * What the assistant is doing, while it is doing it.
 *
 * Shows the work — searching, then reading what the search turned up — and not
 * the model's raw reasoning channel. At low reasoning effort that channel is
 * terse machine notes ("Need lookup experience-aeva-1."), which reads as debug
 * output rather than as a thought process, and waiting for it to stream was also
 * what delayed the panel appearing at all. The server no longer forwards it.
 *
 * Opens while the search and read are running and closes itself once the first
 * token of the answer arrives — at which point the answer is what the visitor
 * wants to read, and the steps that produced it are a record to reopen rather
 * than a thing in the way. See `isThinkingOpen`.
 */

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
  const activity = message.parts.filter(isActivityPart)

  const hasAnswer = message.parts.some(
    (part) => part.type === "text" && "text" in part && part.text.trim() !== ""
  )

  /**
   * `null` until the visitor touches it, after which their choice wins. Derived
   * rather than synced in an effect, so the open state stays a pure function of
   * where the turn has got to.
   */
  const [pinned, setPinned] = useState<boolean | null>(null)

  if (activity.length === 0) {
    return isLive && !hasAnswer ? <ChatThinkingPlaceholder /> : null
  }

  return (
    <Collapsible
      open={isThinkingOpen({ pinned, isLive, hasAnswer })}
      onOpenChange={setPinned}
    >
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
          {activity.flatMap((part, partIndex) =>
            /**
             * A resolved step contributes more than one line — what was asked
             * and what came back — so the list is flattened rather than mapped
             * one-to-one. Keys are positional because the steps of a finished
             * turn never reorder.
             */
            describeActivity(part).map((line, lineIndex) => (
              <li
                key={`${partIndex}-${lineIndex}`}
                className="font-mono text-xs text-muted-foreground"
              >
                {line}
              </li>
            ))
          )}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  )
}
