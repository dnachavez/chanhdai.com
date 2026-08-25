"use client"

import { ArrowUpIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export function BackToTop({
  className,
  ...props
}: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "flex cursor-pointer items-center gap-1 text-sm transition-[color] hover:text-foreground",
        className
      )}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      {...props}
    >
      {/*
        Collapsed to its arrow on phones: the label pushes this row past the
        viewport next to the DMCA badge, which is the widest item in it.
      */}
      <span className="sr-only sm:not-sr-only">Back to top</span>
      <ArrowUpIcon className="size-4" />
    </button>
  )
}
