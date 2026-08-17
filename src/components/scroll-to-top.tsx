"use client"

import { useState } from "react"
import { ArrowUpIcon } from "lucide-react"
import { useMotionValueEvent, useScroll } from "motion/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/base/ui/button"

export function ScrollToTop({
  className,
  ...props
}: React.ComponentProps<"button">) {
  const { scrollY } = useScroll()

  const [visible, setVisible] = useState(false)
  const [scrollDirection, setScrollDirection] = useState<"up" | "down">("down")

  useMotionValueEvent(scrollY, "change", (latestValue) => {
    setVisible(latestValue >= 400)

    const prev = scrollY.getPrevious() ?? 0
    const diff = latestValue - prev
    setScrollDirection(diff > 0 ? "down" : "up")
  })

  return (
    <Button
      data-visible={visible}
      data-scroll-direction={scrollDirection}
      className={cn(
        /**
         * Positioning belongs to `FloatingActions`, which lays this out beside
         * the chat launcher. Kept purely presentational here so neither button
         * has to know the other's size.
         */
        "transition-[background-color,opacity,width,margin] duration-300",
        "data-[scroll-direction=down]:opacity-30 data-[scroll-direction=up]:opacity-100",
        "data-[scroll-direction=down]:hover:opacity-100",
        /**
         * Collapses to nothing rather than merely fading, so the launcher sits
         * flush in the corner while this button is hidden and slides across to
         * make room as it appears. Fading alone left a permanent 40px hole to
         * the launcher's right that read as bad alignment.
         *
         * The left margin is the row's only gap — `gap-2` on the row would
         * survive the collapse and reopen that hole.
         */
        "ml-2 w-8 data-[visible=false]:pointer-events-none data-[visible=false]:ml-0 data-[visible=false]:w-0 data-[visible=false]:opacity-0",
        "overflow-hidden",
        "border-none",
        className
      )}
      variant="secondary"
      size="icon-sm"
      aria-label="Scroll to top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      {...props}
    >
      <ArrowUpIcon />
    </Button>
  )
}
