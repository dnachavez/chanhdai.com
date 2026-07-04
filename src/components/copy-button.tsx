"use client"

import type { Event } from "@/lib/events"
import { trackEvent } from "@/lib/events"
import type { CopyButtonProps } from "@/components/copy-button-primitive"
import { CopyButton as CopyButtonPrimitive } from "@/components/copy-button-primitive"

export function CopyButton({
  size = "icon-sm",
  event,
  ...props
}: CopyButtonProps & {
  event?: Event["name"]
}) {
  return (
    <CopyButtonPrimitive
      variant="secondary"
      size={size}
      onCopySuccess={(copiedValue) => {
        if (event) {
          trackEvent({
            name: event,
            properties: {
              code: copiedValue,
            },
          })
        }
      }}
      {...props}
    />
  )
}
