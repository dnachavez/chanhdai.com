import { addQueryParams } from "@/utils/url"
import { IdCardIcon } from "lucide-react"

import { UTM_PARAMS } from "@/config/site"
import { Button } from "@/components/base/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/base/ui/tooltip"
import { Panel, PanelContent } from "@/features/portfolio/components/panel"
import { SOCIAL_ICONS } from "@/features/portfolio/components/social-link-icons"
import { SOCIAL_LINKS } from "@/features/portfolio/data/social-links"

export function SocialLinks() {
  return (
    <Panel>
      <h2 className="sr-only">Social Links</h2>

      <PanelContent>
        <ul className="flex flex-wrap gap-2">
          {SOCIAL_LINKS.map((item) => (
            <li key={item.name}>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      className="text-foreground/80 shadow-none [&_svg:not([class*='size-'])]:size-4.5"
                      variant="outline"
                      size="icon-sm"
                      nativeButton={false}
                      render={
                        <a
                          href={addQueryParams(item.href, UTM_PARAMS)}
                          target="_blank"
                          rel="noopener"
                        >
                          {SOCIAL_ICONS[item.name]}
                          <span className="sr-only">{item.title}</span>
                        </a>
                      }
                    />
                  }
                />
                <TooltipContent>
                  {item.title} ({item.handle})
                </TooltipContent>
              </Tooltip>
            </li>
          ))}

          {/* The /vcard route already builds a real contact card from USER; it
              just had nothing pointing at it. */}
          <li>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    className="text-foreground/80 shadow-none [&_svg:not([class*='size-'])]:size-4.5"
                    variant="outline"
                    size="icon-sm"
                    nativeButton={false}
                    render={
                      <a href="/vcard" download>
                        <IdCardIcon />
                        <span className="sr-only">Save contact</span>
                      </a>
                    }
                  />
                }
              />
              <TooltipContent>Save contact (.vcf)</TooltipContent>
            </Tooltip>
          </li>
        </ul>
      </PanelContent>
    </Panel>
  )
}
