import Link from "next/link"
import { format } from "date-fns"

import { USER } from "@/features/portfolio/data/user"

/**
 * Visible authorship and dating for a post.
 *
 * The same facts already exist in JSON-LD and the article OG tags, but those
 * are machine-only. Readers arriving from search had no way to tell who wrote
 * a post or how current it is, and human-visible bylines and dates are an
 * E-E-A-T signal in their own right.
 */
export function DocByline({
  createdAt,
  updatedAt,
  readingTimeMinutes,
}: {
  createdAt: string
  updatedAt: string
  readingTimeMinutes: number
}) {
  const published = new Date(createdAt)
  const updated = new Date(updatedAt)
  const wasUpdated = updated.getTime() > published.getTime()

  return (
    <div className="screen-line-bottom flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-3 font-mono text-sm text-muted-foreground">
      <span>
        By{" "}
        <Link className="text-foreground link" href="/" rel="author">
          {USER.displayName}
        </Link>
      </span>

      <span aria-hidden>·</span>

      <time dateTime={published.toISOString()}>
        {format(published, "MMM d, yyyy")}
      </time>

      {wasUpdated && (
        <>
          <span aria-hidden>·</span>
          <span>
            Updated{" "}
            <time dateTime={updated.toISOString()}>
              {format(updated, "MMM d, yyyy")}
            </time>
          </span>
        </>
      )}

      <span aria-hidden>·</span>

      <span>{readingTimeMinutes} min read</span>
    </div>
  )
}
