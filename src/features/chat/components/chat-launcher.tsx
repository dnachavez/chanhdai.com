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
 * Floating entry point, mounted once in the app layout.
 *
 * Base UI's Dialog is used directly rather than through
 * `@/components/base/ui/dialog`, whose `DialogContent` hard-codes centre
 * positioning — this panel is anchored bottom-right on desktop and full-screen
 * below `sm`, where the bottom nav pill and the fade overlay own the lower edge.
 *
 * Never opens on its own. Everything here is behind a click.
 */
export function ChatLauncher() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  /**
   * Hidden on the dedicated page, which already renders a conversation. Two
   * mounted `useChat` instances hold separate histories, so the launcher there
   * would silently open an empty second thread over the one being used.
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
            className="fixed right-4 bottom-[calc(--spacing(2)+env(safe-area-inset-bottom,0))] z-50 size-11 rounded-full shadow-lg ring-1 ring-foreground/10 sm:bottom-4 lg:right-8 dark:ring-foreground/20"
            size="icon-lg"
            aria-label={CHAT_COPY.title}
          />
        }
      >
        <MessageCircleIcon />
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        {/*
          Backdrop only below `sm`. On desktop the panel is a small corner
          surface and dimming the whole page for it would overstate it.
        */}
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/20 duration-100 sm:hidden dark:bg-black/40 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />

        <DialogPrimitive.Popup
          className={[
            "fixed! z-50 flex flex-col overflow-hidden bg-background text-sm duration-100 outline-none",
            /**
             * Full-bleed below `sm`, so the panel owns the notch and the home
             * indicator too — hence the insets, without which the header sits
             * under the status bar and the composer under the gesture area.
             */
            "inset-0 h-dvh w-screen pt-[env(safe-area-inset-top,0)] pb-[env(safe-area-inset-bottom,0)]",
            "sm:p-0",
            "sm:inset-auto sm:right-4 sm:bottom-4 sm:h-[min(32rem,calc(100dvh-6rem))] sm:w-96 sm:rounded-xl sm:shadow-lg sm:ring-1 sm:ring-foreground/10 lg:right-8 sm:dark:ring-foreground/20",
            "data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
            "max-sm:data-open:slide-in-from-bottom-4 sm:data-open:zoom-in-95 sm:data-closed:zoom-out-95",
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
