"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { ArrowUpIcon, SquareIcon } from "lucide-react"

import { trackEvent } from "@/lib/events"
import { cn } from "@/lib/utils"
import { Button } from "@/components/base/ui/button"

import {
  CHAT_COPY,
  CONTACT_EMAIL,
  MAX_MESSAGE_LENGTH,
  MAX_TURNS_PER_SESSION,
  STARTER_QUESTIONS,
} from "../config"
import { ChatMarkdown } from "./chat-markdown"

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

export function ChatConversation({ className }: { className?: string }) {
  const { messages, sendMessage, status, error, stop } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  })

  const [input, setInput] = useState("")
  const listRef = useRef<HTMLDivElement>(null)

  const isBusy = status === "submitted" || status === "streaming"

  const assistantTurns = messages.filter(
    (message) => message.role === "assistant"
  ).length

  const isSessionOver = assistantTurns >= MAX_TURNS_PER_SESSION
  const errorMessage = readError(error)

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
    if (last?.role !== "assistant") return ""

    return last.parts
      .filter((part) => part.type === "text")
      .map((part) => ("text" in part ? part.text : ""))
      .join("")
  }, [messages, isBusy, errorMessage])

  const submit = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isBusy || isSessionOver) return

    trackEvent({
      name: "chat_question",
      properties: { question: trimmed, question_length: trimmed.length },
    })

    void sendMessage({ text: trimmed })
    setInput("")
  }

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div
        ref={listRef}
        role="log"
        className="flex-1 space-y-4 overflow-y-auto overscroll-contain p-4"
      >
        {messages.length === 0 && !errorMessage && (
          <div className="space-y-4">
            <p className="font-mono text-sm text-muted-foreground">
              {CHAT_COPY.empty}
            </p>

            <ul className="flex flex-wrap gap-1.5">
              {STARTER_QUESTIONS.map((question) => (
                <li key={question} className="flex">
                  <button
                    type="button"
                    className="tag-base cursor-pointer text-left transition-[background-color,color] ease-out hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    onClick={() => submit(question)}
                  >
                    {question}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {messages.map((message) => {
          const text = message.parts
            .filter((part) => part.type === "text")
            .map((part) => ("text" in part ? part.text : ""))
            .join("")

          if (message.role === "user") {
            return (
              <div key={message.id} className="flex justify-end">
                <p className="max-w-[85%] rounded-xl bg-muted px-3 py-2 text-sm wrap-break-word whitespace-pre-wrap">
                  {text}
                </p>
              </div>
            )
          }

          return (
            <div
              key={message.id}
              className="prose prose-sm max-w-none prose-ncdai text-sm prose-zinc dark:prose-invert prose-p:first:mt-0 prose-p:last:mb-0"
            >
              <ChatMarkdown>{text}</ChatMarkdown>
            </div>
          )
        })}

        {status === "submitted" && (
          <p className="font-mono text-sm text-muted-foreground">Thinking…</p>
        )}

        {errorMessage && (
          <p className="font-mono text-sm text-muted-foreground">
            {errorMessage.replace(CONTACT_EMAIL, "").trim()}{" "}
            <a
              className="text-foreground link"
              href={`mailto:${CONTACT_EMAIL}`}
            >
              {CONTACT_EMAIL}
            </a>
          </p>
        )}

        {isSessionOver && !errorMessage && (
          <p className="font-mono text-sm text-muted-foreground">
            {CHAT_COPY.sessionEnded.replace(CONTACT_EMAIL, "").trim()}{" "}
            <a
              className="text-foreground link"
              href={`mailto:${CONTACT_EMAIL}`}
            >
              {CONTACT_EMAIL}
            </a>
          </p>
        )}
      </div>

      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>

      <form
        className="screen-line-top flex items-end gap-2 p-2"
        onSubmit={(event) => {
          event.preventDefault()
          submit(input)
        }}
      >
        <label className="sr-only" htmlFor="chat-input">
          {CHAT_COPY.placeholder}
        </label>

        <textarea
          id="chat-input"
          rows={1}
          value={input}
          disabled={isSessionOver}
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder={CHAT_COPY.placeholder}
          className="field-sizing-content max-h-32 min-h-9 flex-1 resize-none rounded-lg border border-input bg-transparent px-2.5 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30"
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends; Shift+Enter is a newline. Left alone while an IME is
            // composing, where Enter commits the candidate rather than the message.
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault()
              submit(input)
            }
          }}
        />

        {isBusy ? (
          <Button
            type="button"
            variant="secondary"
            size="icon-sm"
            aria-label="Stop generating"
            onClick={() => stop()}
          >
            <SquareIcon />
          </Button>
        ) : (
          <Button
            type="submit"
            size="icon-sm"
            aria-label="Send message"
            disabled={!input.trim() || isSessionOver}
          >
            <ArrowUpIcon />
          </Button>
        )}
      </form>
    </div>
  )
}
