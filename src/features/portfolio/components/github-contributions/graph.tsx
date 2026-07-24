"use client"

import { use, useCallback, useRef, useState } from "react"
import { format } from "date-fns"
import { LoaderIcon } from "lucide-react"

import type { Activity } from "@/components/contribution-graph"
import {
  ContributionGraph,
  ContributionGraphBlock,
  ContributionGraphCalendar,
  ContributionGraphFooter,
  ContributionGraphLegend,
  ContributionGraphTotalCount,
} from "@/components/contribution-graph"

type HoveredCell = {
  count: number
  date: string
  x: number
  y: number
}

export function GitHubContributionGraph({
  contributions,
}: {
  contributions: Promise<Activity[]>
}) {
  const data = use(contributions)
  const containerRef = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = useState<HoveredCell | null>(null)

  /**
   * One delegated handler for the whole calendar rather than a Tooltip
   * component per day. Wrapping all 365 cells individually generated ~180 KB
   * of markup on the homepage -- a fifth of the document -- plus 365 hydrated
   * component instances each binding their own listeners, which showed up as
   * main-thread work. Every block already carries data-count/data-date, so a
   * single listener reading them off the event target does the same job.
   */
  const handlePointerMove = useCallback((event: React.PointerEvent) => {
    const target = event.target as SVGElement
    const date = target.dataset?.date
    const container = containerRef.current

    if (!date || !container) {
      setHovered(null)
      return
    }

    const cell = target.getBoundingClientRect()
    const bounds = container.getBoundingClientRect()

    setHovered({
      count: Number(target.dataset.count ?? 0),
      date,
      x: cell.left - bounds.left + cell.width / 2,
      y: cell.top - bounds.top,
    })
  }, [])

  return (
    <div
      ref={containerRef}
      className="relative"
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setHovered(null)}
    >
      <ContributionGraph
        className="mx-auto gap-4 py-4"
        data={data}
        blockSize={12}
        blockMargin={2}
        blockRadius={0}
        aria-label="GitHub Contributions Graph"
      >
        <ContributionGraphCalendar
          className="px-4 **:data-[slot=month-labels]:text-muted-foreground"
          title="GitHub Contributions"
          aria-hidden
        >
          {({ activity, dayIndex, weekIndex }) => (
            <ContributionGraphBlock
              activity={activity}
              dayIndex={dayIndex}
              weekIndex={weekIndex}
            />
          )}
        </ContributionGraphCalendar>

        <ContributionGraphFooter className="gap-4 px-4 leading-none">
          <ContributionGraphTotalCount>
            {({ totalCount }) => (
              <div className="text-muted-foreground">
                {totalCount.toLocaleString("en")} contributions in the past 365
                days.
              </div>
            )}
          </ContributionGraphTotalCount>

          <ContributionGraphLegend aria-hidden />
        </ContributionGraphFooter>
      </ContributionGraph>

      {hovered && (
        <div
          className="pointer-events-none absolute z-50 -translate-x-1/2 -translate-y-full pb-2"
          style={{ left: hovered.x, top: hovered.y }}
          role="tooltip"
        >
          <div className="w-max rounded-lg bg-foreground px-4 py-2 text-sm text-background">
            {hovered.count} contribution{hovered.count > 1 ? "s" : null} on{" "}
            {format(new Date(hovered.date), "dd.MM.yyyy")}
          </div>
        </div>
      )}
    </div>
  )
}

export function GitHubContributionFallback() {
  return (
    <div className="flex h-45 w-full items-center justify-center">
      <LoaderIcon className="animate-spin text-muted-foreground" />
    </div>
  )
}
