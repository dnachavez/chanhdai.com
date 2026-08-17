"use client"

import dynamic from "next/dynamic"

import { ScrollToTop } from "@/components/scroll-to-top"

/**
 * The bottom-right corner, owned in one place.
 *
 * A flex row rather than two independently `fixed` buttons, so neither needs to
 * know the other's height to avoid it. Offsets come from the `--fab-*` variables
 * in globals.css, which the chat panel reads too.
 *
 * The row is laid out right-to-left: the chat launcher is the last child but
 * paints leftmost, so when the scroll-to-top button collapses to nothing the
 * launcher ends up flush in the corner instead of holding a gap open for a
 * button that is not there.
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
    <div className="pointer-events-none fixed right-(--fab-inset) bottom-[calc(var(--fab-inset)+env(safe-area-inset-bottom,0))] z-50 flex flex-row-reverse items-center [&>*]:pointer-events-auto">
      <ScrollToTop />
      <ChatLauncher />
    </div>
  )
}
