import type { Route } from "next"
import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"

import { Button } from "@/components/base/ui/button"

/**
 * Footer link out of a homepage panel to its full listing page.
 *
 * Replaces the previous inline "Show more" collapsibles. Those kept the extra
 * items out of the server-rendered HTML while still serializing them into the
 * RSC payload, so the content cost bytes on every visit and was invisible to
 * crawlers, which do not click. A real link puts it on an indexable URL.
 */
export function PanelViewAll({
  href,
  children,
}: {
  href: Route
  children: React.ReactNode
}) {
  return (
    <div className="screen-line-top flex justify-center py-2">
      <Button
        className="gap-2 pr-2.5 pl-3"
        variant="secondary"
        size="sm"
        nativeButton={false}
        render={<Link href={href} />}
      >
        {children}
        <ArrowRightIcon />
      </Button>
    </div>
  )
}
