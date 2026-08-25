"use client"

import dynamic from "next/dynamic"

/**
 * The bottom-right corner, owned in one place, so its offsets live with the
 * `--fab-*` variables in globals.css that the chat panel reads too.
 */
const ChatLauncher = dynamic(
  () =>
    import("@/features/chat/components/chat-launcher").then(
      (mod) => mod.ChatLauncher
    ),
  { ssr: false }
)

export function FloatingActions() {
  return (
    <div className="pointer-events-none fixed right-(--fab-inset) bottom-[calc(var(--fab-inset)+env(safe-area-inset-bottom,0))] z-50 flex items-center [&>*]:pointer-events-auto">
      <ChatLauncher />
    </div>
  )
}
