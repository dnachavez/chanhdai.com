import Image from "next/image"
import { addQueryParams } from "@/utils/url"

import { UTM_PARAMS } from "@/config/site"

import type { Experience } from "../../types/experiences"
import { ExperiencePositionItem } from "./experience-position-item"

/**
 * The homepage nests these under a `PanelTitle` h2, so h3/h4 is right there.
 * `/experience` has no such section heading, so it shifts both up one level to
 * keep the document outline contiguous from its h1.
 */
type HeadingLevel = "h2" | "h3"

const POSITION_HEADING = { h2: "h3", h3: "h4" } as const

export function ExperienceItem({
  experience,
  headingAs = "h3",
}: {
  experience: Experience
  headingAs?: HeadingLevel
}) {
  const Heading = headingAs

  return (
    <div
      id={`experience-${experience.id}`}
      className="group/experience screen-line-bottom scroll-mt-14 space-y-4 py-4"
    >
      <div className="flex items-start gap-3 sm:items-center">
        <div className="flex size-6 shrink-0 items-center justify-center select-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:text-muted-foreground [&_svg:not([class*='size-'])]:size-5">
          {experience.companyLogo ? (
            <Image
              src={experience.companyLogo}
              alt={`${experience.companyName} logo`}
              width={24}
              height={24}
              quality={100}
              className="rounded-full grayscale transition-[filter] duration-300 ease-[cubic-bezier(0.42,0,0.58,1)] group-hover/experience:grayscale-0"
              unoptimized
              aria-hidden
            />
          ) : (
            (experience.companyIcon ?? (
              <span className="flex size-2 rounded-full bg-zinc-300 dark:bg-zinc-600" />
            ))
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-x-3 gap-y-1 pr-1 sm:flex-row sm:items-baseline sm:justify-between">
          <Heading className="text-xl/6 font-medium">
            {experience.companyWebsite ? (
              <a
                className="link"
                href={addQueryParams(experience.companyWebsite, UTM_PARAMS)}
                target="_blank"
                rel="noopener"
              >
                {experience.companyName}
              </a>
            ) : (
              experience.companyName
            )}
          </Heading>

          {experience.location && experience.locationType && (
            <dl className="flex min-w-0 items-center gap-1.5 text-sm whitespace-nowrap text-muted-foreground">
              <dt className="sr-only">Location</dt>
              <dd className="truncate">{experience.location}</dd>

              <dt className="sr-only">Location type</dt>
              <dd>({experience.locationType})</dd>

              {experience.isCurrentEmployer && (
                <>
                  <dt className="sr-only">Employment status</dt>
                  <dd>
                    <span className="sr-only">Current</span>
                    <span className="relative flex size-2.5 translate-x-px translate-y-px items-center justify-center">
                      <span className="absolute inline-flex size-2.5 animate-ping rounded-full bg-info opacity-50" />
                      <span className="relative inline-flex size-1.5 rounded-full bg-info" />
                    </span>
                  </dd>
                </>
              )}
            </dl>
          )}
        </div>
      </div>

      <div className="relative space-y-4 before:absolute before:left-3 before:h-full before:w-px before:bg-border">
        {experience.positions.map((position) => (
          <ExperiencePositionItem
            key={position.id}
            position={position}
            /**
             * Position ids are only unique within a company ("1" appears eight
             * times on the page), so the anchor is qualified here where both
             * halves are in scope. The chat assistant links to these to point at
             * a specific role rather than a whole employer.
             */
            anchorId={`position-${experience.id}-${position.id}`}
            headingAs={POSITION_HEADING[headingAs]}
          />
        ))}
      </div>
    </div>
  )
}
