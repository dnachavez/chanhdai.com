import type { Route } from "next"
import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export function PageHeading({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="page-heading"
      className={cn("group/page-heading", className)}
      {...props}
    >
      {children}
      <div
        data-slot="page-heading-description-line"
        className="screen-line-bottom hidden h-px group-has-data-[slot=page-heading-description]/page-heading:flex"
      />
    </div>
  )
}

/**
 * Back link above a page title, matching the treatment on blog post pages.
 * An alternative to `PageHeadingTagline` for sections that sit one level below
 * the homepage, where a way back is more useful than a repeated label.
 */
export function PageHeadingBackLink({
  href,
  children,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  href: Route
  children: React.ReactNode
}) {
  return (
    <>
      {/* Leading rule, matching the one above a blog post's back link. */}
      <div className="screen-line-bottom h-px" />

      <div
        data-slot="page-heading-back-link"
        className={cn("flex items-center p-2 pl-4", className)}
        {...props}
      >
        <Button
          className="h-7 gap-2 border-none px-0 tracking-wider text-muted-foreground hover:text-foreground hover:no-underline"
          variant="link"
          size="sm"
          asChild
        >
          <Link href={href}>
            <ArrowLeftIcon />
            {children}
          </Link>
        </Button>
      </div>

      {/* Ruled spacer band separating the back link from the title. */}
      <div className="screen-line-top screen-line-bottom py-px">
        <div className="h-4" />
      </div>
    </>
  )
}

export function PageHeadingTagline({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="page-heading-tagline"
      className={cn(
        "px-4 pb-2 font-heading text-sm/none font-medium tracking-wider text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

export function PageHeadingTitle({
  className,
  ...props
}: React.ComponentProps<"h1">) {
  return (
    <h1
      data-slot="page-heading-title"
      className={cn(
        "screen-line-top screen-line-bottom px-4",
        "font-heading text-4xl font-medium tracking-tight text-balance",
        className
      )}
      {...props}
    />
  )
}

export function PageHeadingDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="page-heading-description"
      className={cn(
        "p-4 text-base text-balance text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}
