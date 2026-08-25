"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { MessageCircleIcon } from "lucide-react"

import { trackEvent } from "@/lib/events"
import { Button } from "@/components/ui/button"

import { CHAT_COPY } from "../config"

/**
 * The phone's way into chat, sitting in the bottom nav beside search and the
 * menu rather than floating over the page next to it.
 *
 * A link rather than a trigger: `chat-launcher.tsx` explains why the panel is
 * `sm`-only and phones get the page instead. Styled off `NavMobileTrigger`,
 * which it stands next to.
 */
export function ChatNavItem() {
  const pathname = usePathname()
  const isActive = pathname === "/chat"

  return (
    <Button
      className="touch-manipulation border-none active:scale-none aria-[current=page]:bg-accent"
      variant="ghost"
      size="icon-sm"
      asChild
    >
      <Link
        className="cursor-default"
        href="/chat"
        aria-label={CHAT_COPY.launcher}
        aria-current={isActive ? "page" : undefined}
        onClick={() =>
          trackEvent({
            name: "chat_open",
            properties: { source: "bottom_nav" },
          })
        }
      >
        <MessageCircleIcon />
      </Link>
    </Button>
  )
}

export default ChatNavItem
