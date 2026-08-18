"use client"

import dynamic from "next/dynamic"

import { cn } from "@/lib/utils"

import { CHAT_COPY } from "../config"

/**
 * `/chat` renders the conversation inline, and two things inside it differ
 * between a server render and the client's first render: the opener chips are a
 * random sample of the suggestion pool, and the thread itself is restored from
 * `sessionStorage`, which does not exist on the server. Either one produces a
 * hydration mismatch — an error, not a warning, since React discards and
 * re-renders the subtree.
 *
 * Rendering it client-only removes the class of problem rather than papering
 * over each instance. Nothing is lost: the panel is interactive-only, and the
 * page's heading and description are server-rendered around it, so what a
 * crawler sees is unchanged.
 *
 * The launcher takes the same route, via the `ssr: false` import in
 * `FloatingActions`.
 *
 * Kept in its own module because `ssr: false` is not allowed in a Server
 * Component, and the page that mounts this is one.
 */
const ChatConversation = dynamic(
  () => import("./chat-conversation").then((mod) => mod.ChatConversation),
  {
    ssr: false,
    /** Holds the page's layout at exactly the height the real panel takes. */
    loading: () => (
      <div className="flex min-h-0 flex-col">
        <div className="flex-1 p-4">
          <p className="font-mono text-sm text-muted-foreground">
            {CHAT_COPY.placeholder}
          </p>
        </div>
        <div className="screen-line-top h-13" />
      </div>
    ),
  }
)

export function ChatConversationClient({ className }: { className?: string }) {
  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <ChatConversation className="flex-1" />
    </div>
  )
}
