"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { MaximizeIcon, MessageCircleIcon, XIcon } from "lucide-react"

import { trackEvent } from "@/lib/events"
import { Button } from "@/components/base/ui/button"

import { CHAT_COPY } from "../config"
import { ChatConversation } from "./chat-conversation"

/**
 * Floating entry point, mounted once by `FloatingActions` in the app layout.
 *
 * Desktop only. Below `sm` the panel filled the whole screen, which is `/chat`
 * with extra steps and worse — the command menu already offers chat, and it
 * routes to the real page. So on a phone there is no launcher and the page is
 * the entry point.
 *
 * Base UI's Dialog is used directly rather than through
 * `@/components/base/ui/dialog`, whose `DialogContent` hard-codes centre
 * positioning; this panel is anchored above the launcher in the bottom-right.
 *
 * The conversation itself lives in `ChatProvider` above this, so closing the
 * panel hides the thread rather than discarding it.
 *
 * Never opens on its own. Everything here is behind a click.
 */
export function ChatLauncher() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  /**
   * Hidden on the dedicated page, which renders the same conversation inline.
   * They now share one thread, so the launcher there would be a second view of
   * the messages already on screen.
   */
  if (pathname === "/chat") return null

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next)
          trackEvent({ name: "chat_open", properties: { source: "launcher" } })
      }}
    >
      <DialogPrimitive.Trigger
        render={
          <Button
            className="hidden size-(--fab-size) rounded-full shadow-lg ring-1 ring-foreground/10 sm:flex dark:ring-foreground/20"
            size="icon-lg"
            aria-label={open ? "Close chat" : CHAT_COPY.title}
          />
        }
      >
        {/*
          The trigger doubles as the close control while the panel is open —
          it is the one part of the page not covered by it, so a bubble that
          still read "open chat" was the obvious thing to click and did nothing.
        */}
        {open ? (
          <XIcon className="size-5" />
        ) : (
          <MessageCircleIcon className="size-5" />
        )}
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Popup
          data-chat-ui
          className={[
            "fixed! z-50 flex flex-col overflow-hidden rounded-xl bg-background text-sm shadow-lg ring-1 ring-foreground/10 duration-100 outline-none dark:ring-foreground/20",
            /**
             * Anchored above the launcher row, clearing it by `--fab-gap` so the
             * panel does not sit directly on top of the bubble that opened it.
             * Every offset here comes from the same variables the row uses.
             */
            "right-(--fab-inset) bottom-[calc(var(--fab-inset)+var(--fab-size)+var(--fab-gap)+env(safe-area-inset-bottom,0))]",
            "h-[min(32rem,calc(100dvh-var(--fab-inset)*2-var(--fab-size)-var(--fab-gap)-2rem))]",
            /**
             * The launcher is `sm`-only, so this is never opened on a narrow
             * viewport — but a desktop window dragged narrow while it is open
             * should shrink rather than overflow.
             */
            "w-[min(24rem,calc(100vw-var(--fab-inset)*2))]",
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          ].join(" ")}
        >
          <header className="screen-line-bottom flex items-center gap-2 p-2 pl-4">
            <div className="flex-1">
              <DialogPrimitive.Title className="text-sm leading-none font-medium">
                {CHAT_COPY.title}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-xs text-muted-foreground">
                {CHAT_COPY.subtitle}
              </DialogPrimitive.Description>
            </div>

            <Button
              className="border-none"
              variant="ghost"
              size="icon-sm"
              aria-label="Open full page"
              nativeButton={false}
              render={<Link href="/chat" onClick={() => setOpen(false)} />}
            >
              <MaximizeIcon />
            </Button>

            <DialogPrimitive.Close
              render={
                <Button
                  className="border-none"
                  variant="ghost"
                  size="icon-sm"
                />
              }
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </header>

          <ChatConversation className="flex-1" />
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export default ChatLauncher
