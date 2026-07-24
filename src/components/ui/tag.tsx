import React from "react"

import { cn } from "@/lib/utils"

function Tag({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span data-slot="tag" className={cn("tag-base", className)} {...props} />
  )
}

export { Tag }
