import Image from "next/image"
import { ArrowUpRightIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import type { Gear } from "@/features/portfolio/types/gear"

export function GearItem({
  className,
  gear,
}: {
  className?: string
  gear: Gear
}) {
  const isLink = !!gear.link

  const Comp = isLink ? "a" : "div"
  const linkProps = isLink
    ? {
        href: gear.link,
        target: "_blank" as const,
        rel: "noopener",
        "aria-label": `Open ${gear.name}`,
      }
    : {}

  return (
    <Comp
      className={cn(
        "group/gear relative flex flex-col overflow-hidden rounded-lg border border-line transition-colors hover:bg-accent-muted",
        className
      )}
      {...linkProps}
    >
      <div className="relative aspect-4/3 bg-white">
        <Image
          src={gear.image}
          alt={gear.name}
          fill
          sizes="(min-width: 768px) 240px, 45vw"
          className="object-contain p-3 grayscale transition duration-300 select-none group-hover/gear:grayscale-0"
        />
      </div>

      <div className="flex items-center gap-1.5 border-t border-line px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm leading-snug font-medium">
            {gear.name}
          </h3>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {gear.description}
          </p>
        </div>

        {isLink && (
          <ArrowUpRightIcon className="size-3.5 shrink-0 text-muted-foreground transition-colors group-hover/gear:text-foreground" />
        )}
      </div>
    </Comp>
  )
}
