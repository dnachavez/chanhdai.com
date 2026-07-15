import {
  Panel,
  PanelDescription,
  PanelHeader,
  PanelTitle,
  PanelTitleSup,
} from "@/features/portfolio/components/panel"
import { PanelTitleCopy } from "@/features/portfolio/components/panel-title-copy"
import { GEAR } from "@/features/portfolio/data/gear"
import type { Gear } from "@/features/portfolio/types/gear"

import { GearItem } from "./gear-item"

const ID = "gear"

export function Gear() {
  const groups = groupByCategory(GEAR)

  return (
    <Panel id={ID}>
      <PanelHeader>
        <PanelTitle>
          <a href={`#${ID}`}>Gear</a>
          <PanelTitleSup>({GEAR.length})</PanelTitleSup>
          <PanelTitleCopy id={ID} />
        </PanelTitle>

        <PanelDescription>
          The hardware and tools I use to build, create and stay productive — my
          desk configuration, daily carry.
        </PanelDescription>
      </PanelHeader>

      {Object.entries(groups).map(([category, items], index) => {
        const categoryId = `${ID}-${category
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "")}`

        return (
          <div key={category} className="border-b border-line last:border-b-0">
            <div
              id={categoryId}
              className="px-4 py-2.5 font-mono text-xs tracking-wider text-muted-foreground uppercase"
            >
              <span
                className="mr-1.5 text-muted-foreground/50 select-none"
                aria-hidden
              >
                {(index + 1).toString().padStart(2, "0")}
              </span>
              {category}
            </div>

            <ul
              aria-labelledby={categoryId}
              className="grid grid-cols-2 gap-3 px-4 pb-4 sm:grid-cols-3"
            >
              {items.map((item) => (
                <li key={item.name} className="flex">
                  <GearItem className="w-full" gear={item} />
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </Panel>
  )
}

function groupByCategory(items: Gear[]): Record<string, Gear[]> {
  return items.reduce<Record<string, Gear[]>>((acc, item) => {
    ;(acc[item.category] ??= []).push(item)
    return acc
  }, {})
}
