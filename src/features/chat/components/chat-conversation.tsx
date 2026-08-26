"use client"

import { useEffect, useMemo, useRef } from "react"
import type { UIMessage } from "ai"

import { cn } from "@/lib/utils"

import { CHAT_COPY, CONTACT_EMAIL } from "../config"
import { ChatComposer } from "./chat-composer"
import { ChatMarkdown } from "./chat-markdown"
import { useChatConversation } from "./chat-provider"
import {
  ChatSuggestions,
  readHighlights,
  readSuggestions,
  useOpeners,
} from "./chat-suggestions"
import { ChatThinking, ChatThinkingPlaceholder } from "./chat-thinking"

/**
 * The route replies to every failure with `{ error }`, so the useful message is
 * inside the body rather than in the thrown `Error`. Falls back to the generic
 * copy for transport-level failures, which have no body at all.
 */
function readError(error: Error | undefined) {
  if (!error) return null

  try {
    const parsed = JSON.parse(error.message) as { error?: unknown }
    if (typeof parsed.error === "string") return parsed.error
  } catch {
    // Not our JSON — a network error, an aborted request, or a proxy page.
  }

  return CHAT_COPY.error
}

function textOf(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => ("text" in part ? part.text : ""))
    .join("")
}

/** Copy that ends at an address, rendered with the address as a real link. */
function Notice({ copy }: { copy: string }) {
  return (
    <p className="font-mono text-sm text-muted-foreground">
      {copy.replace(CONTACT_EMAIL, "").trim()}{" "}
      <a className="text-foreground link" href={`mailto:${CONTACT_EMAIL}`}>
        {CONTACT_EMAIL}
      </a>
    </p>
  )
}

export function ChatConversation({ className }: { className?: string }) {
  const {
    messages,
    error,
    isBusy,
    isSessionOver,
    asked,
    input,
    setInput,
    send,
    stop,
  } = useChatConversation()

  /**
   * The assistant message does not exist until the first chunk lands, so between
   * pressing send and the stream opening there is nothing in `messages` to hang
   * a status on. Rendered here instead, which is what makes "Thinking…" appear
   * immediately rather than after the first round trip.
   */
  const isAwaitingReply =
    isBusy && messages[messages.length - 1]?.role === "user"

  const listRef = useRef<HTMLDivElement>(null)

  const errorMessage = readError(error)
  const openers = useOpeners(asked)

  /**
   * Anchored to the bottom while answers stream in. `scrollTop` rather than
   * `scrollIntoView` so the page behind a dialog is never dragged along with
   * it.
   */
  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [messages, isBusy])

  /**
   * Screen readers get a summary, not a token stream. Announcing the live
   * message would re-read the whole answer on every chunk, so the region stays
   * quiet until the turn finishes.
   */
  const announcement = useMemo(() => {
    if (isBusy) return "Answering…"
    if (errorMessage) return errorMessage

    const last = messages[messages.length - 1]
    return last?.role === "assistant" ? textOf(last) : ""
  }, [messages, isBusy, errorMessage])

  const lastMessage = messages[messages.length - 1]

  /**
   * Chips hang off the finished answer, so they appear once and only under the
   * turn that produced them. Falls back to openers for turns with no retrieved
   * entries — a greeting has nothing to derive follow-ups from, and offering
   * nothing there dead-ends the conversation.
   */
  const followUps = useMemo(() => {
    if (isBusy || errorMessage || isSessionOver) return []
    if (lastMessage?.role !== "assistant") return []

    const suggestions = readSuggestions(lastMessage.metadata)
    return suggestions.length > 0 ? suggestions : openers.slice(0, 2)
  }, [isBusy, errorMessage, isSessionOver, lastMessage, openers])

  return (
    <div data-chat-ui className={cn("flex min-h-0 flex-col", className)}>
      <div
        ref={listRef}
        role="log"
        className="flex-1 space-y-4 overflow-y-auto overscroll-contain p-4"
      >
        {messages.length === 0 && !errorMessage && (
          <ChatSuggestions
            questions={openers}
            onSelect={send}
            disabled={isSessionOver}
          />
        )}

        {messages.map((message) => {
          if (message.role === "user") {
            return (
              <div key={message.id} className="flex justify-end">
                <div className="prose prose-sm max-w-[85%] prose-ncdai rounded-none bg-muted px-3 py-2 text-sm wrap-break-word prose-zinc dark:prose-invert prose-p:first:mt-0 prose-p:last:mb-0">
                  <ChatMarkdown>{textOf(message)}</ChatMarkdown>
                </div>
              </div>
            )
          }

          return (
            <div key={message.id} className="space-y-1.5">
              <ChatThinking
                message={message}
                isLive={isBusy && message.id === lastMessage?.id}
              />

              <div className="prose prose-sm max-w-none prose-ncdai text-sm prose-zinc dark:prose-invert prose-p:first:mt-0 prose-p:last:mb-0">
                <ChatMarkdown highlights={readHighlights(message.metadata)}>
                  {textOf(message)}
                </ChatMarkdown>
              </div>
            </div>
          )
        })}

        {isAwaitingReply && <ChatThinkingPlaceholder />}

        {/*
          Rendered outside the message list so it is never mistaken for part of
          the answer, and so it disappears the moment the next question is sent.
        */}
        {followUps.length > 0 && (
          <ChatSuggestions questions={followUps} onSelect={send} />
        )}

        {errorMessage && <Notice copy={errorMessage} />}

        {isSessionOver && !errorMessage && (
          <Notice copy={CHAT_COPY.sessionEnded} />
        )}
      </div>

      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>

      <ChatComposer
        value={input}
        onChange={setInput}
        onSubmit={() => send(input)}
        onStop={stop}
        isBusy={isBusy}
        disabled={isSessionOver}
      />
    </div>
  )
}
