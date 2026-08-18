"use client"

/**
 * First, and before `@ai-sdk/react`: it builds zod v4 schemas at module scope,
 * and this is what stops that from tripping the CSP. See the module for why.
 */
import "../lib/zod-jitless"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, type UIMessage } from "ai"

import { trackEvent } from "@/lib/events"

import { MAX_TURNS_PER_SESSION } from "../config"

/**
 * Owns the one conversation on the page.
 *
 * `useChat` used to live inside the panel, which meant closing the panel
 * unmounted the hook and threw the thread away — reopening it looked like the
 * visitor had never asked anything. Hoisting it into a provider mounted in the
 * app layout makes the panel a view of the conversation rather than its owner,
 * and lets the launcher and /chat share one thread instead of quietly keeping
 * two.
 */

const STORAGE_KEY = "chat:messages"

type ChatContextValue = {
  messages: UIMessage[]
  status: ReturnType<typeof useChat>["status"]
  error: Error | undefined
  isBusy: boolean
  isSessionOver: boolean
  /** Questions already asked, so suggestion chips do not offer them again. */
  asked: string[]
  input: string
  setInput: (value: string) => void
  send: (text: string) => void
  stop: () => void
  clear: () => void
}

const ChatContext = createContext<ChatContextValue | null>(null)

export function useChatConversation() {
  const context = useContext(ChatContext)

  if (!context) {
    throw new Error("useChatConversation must be used within a ChatProvider")
  }

  return context
}

/**
 * Rehydrated once, before the first paint that could show an empty thread.
 *
 * `sessionStorage` rather than `localStorage`: the thread should survive a
 * reload and a navigation, and die with the tab. Note that this also makes
 * `MAX_TURNS_PER_SESSION` genuinely sticky rather than resettable with F5,
 * which is the intended reading of "per session".
 */
function readStoredMessages(): UIMessage[] {
  if (typeof window === "undefined") return []

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []

    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed.filter(
      (message): message is UIMessage =>
        typeof message === "object" &&
        message !== null &&
        "role" in message &&
        "parts" in message
    )
  } catch {
    // Corrupt or unavailable storage (private mode, quota) is not worth a
    // failure here; the visitor just starts a fresh thread.
    return []
  }
}

function textOf(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => ("text" in part ? part.text : ""))
    .join("")
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  /**
   * Read lazily rather than in an effect. `useChat` takes its initial messages
   * once, so restoring them afterwards would need a `setMessages` round trip and
   * a frame of visibly empty conversation first.
   */
  const [initialMessages] = useState(readStoredMessages)

  const { messages, sendMessage, status, error, stop, setMessages } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    messages: initialMessages,
  })

  const [input, setInput] = useState("")

  const isBusy = status === "submitted" || status === "streaming"

  /** Skips the write for the initial render, which would only echo what it read. */
  const hydrated = useRef(false)

  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true
      if (messages.length === 0) return
    }

    try {
      if (messages.length === 0) window.sessionStorage.removeItem(STORAGE_KEY)
      else window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
    } catch {
      // Over quota or storage disabled. The in-memory thread still works.
    }
  }, [messages])

  const assistantTurns = messages.filter(
    (message) => message.role === "assistant"
  ).length

  const isSessionOver = assistantTurns >= MAX_TURNS_PER_SESSION

  const asked = useMemo(
    () => messages.filter((message) => message.role === "user").map(textOf),
    [messages]
  )

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || isBusy || isSessionOver) return

      trackEvent({
        name: "chat_question",
        properties: { question: trimmed, question_length: trimmed.length },
      })

      void sendMessage({ text: trimmed })
      setInput("")
    },
    [isBusy, isSessionOver, sendMessage]
  )

  const clear = useCallback(() => {
    setMessages([])
    setInput("")
  }, [setMessages])

  const value = useMemo<ChatContextValue>(
    () => ({
      messages,
      status,
      error,
      isBusy,
      isSessionOver,
      asked,
      input,
      setInput,
      send,
      stop,
      clear,
    }),
    [
      messages,
      status,
      error,
      isBusy,
      isSessionOver,
      asked,
      input,
      send,
      stop,
      clear,
    ]
  )

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}
