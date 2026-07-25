import type { Metadata } from "next"
import type { ItemList, WithContext } from "schema-dts"

import { X_HANDLE } from "@/config/site"
import { jsonLdBreadcrumbList, JsonLdScript } from "@/lib/json-ld"
import { baseOpenGraph } from "@/lib/metadata"
import { absoluteUrl } from "@/lib/utils"
import {
  PageHeading,
  PageHeadingBackLink,
  PageHeadingTitle,
} from "@/components/page-heading"
import { ExperienceList } from "@/features/portfolio/components/experiences"
import { EXPERIENCES } from "@/features/portfolio/data/experiences"

const title = "Experience"
const description =
  "The full work history of Dan Chavez, a senior full stack and AI engineer in Cebu City, Philippines, from self-taught beginnings to production AI platforms."

/** Short enough to stay legible on a 1200x630 card. */
const tagline = "Every role, in full."

const ogImage = `/og/simple?title=${encodeURIComponent(title)}&description=${encodeURIComponent(tagline)}`

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/experience",
  },
  openGraph: {
    ...baseOpenGraph,
    url: "/experience",
    type: "website",
    images: {
      url: ogImage,
      width: 1200,
      height: 630,
      alt: title,
    },
  },
  twitter: {
    card: "summary_large_image",
    site: X_HANDLE,
    creator: X_HANDLE,
    images: [ogImage],
  },
}

/**
 * Employment periods are authored as "MM.YYYY" or "YYYY" for display; Schema.org
 * dates must be ISO 8601. Returns undefined for anything unrecognised so an
 * invalid date is omitted rather than emitted.
 */
function toIsoDate(period: string | undefined) {
  if (!period) return undefined
  if (/^\d{4}$/.test(period)) return period

  const match = period.match(/^(\d{2})\.(\d{4})$/)
  return match ? `${match[2]}-${match[1]}` : undefined
}

/**
 * An ItemList of the roles rather than a list of Organizations: the page is a
 * chronology of positions, and each entry points at the employer while staying
 * attached to the site's single Person entity.
 */
function getExperienceJsonLd(): WithContext<ItemList> {
  // One entry per position, not per company: several companies hold more than
  // one role. Flatten first so `position` stays sequential and unique, and
  // `numberOfItems` matches the number of elements actually emitted.
  const roles = EXPERIENCES.flatMap((experience) =>
    experience.positions.map((position) => ({ experience, position }))
  )

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": absoluteUrl("/experience"),
    name: `${title} — Dan Chavez`,
    description,
    url: absoluteUrl("/experience"),
    numberOfItems: roles.length,
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    itemListElement: roles.map(({ experience, position }, index) => ({
      "@type": "ListItem" as const,
      position: index + 1,
      item: {
        "@type": "EmployeeRole" as const,
        roleName: position.title,
        ...(toIsoDate(position.employmentPeriod.start) && {
          startDate: toIsoDate(position.employmentPeriod.start),
        }),
        ...(toIsoDate(position.employmentPeriod.end) && {
          endDate: toIsoDate(position.employmentPeriod.end),
        }),
        worksFor: {
          "@type": "Organization" as const,
          name: experience.companyName,
          ...(experience.companyWebsite && {
            url: experience.companyWebsite,
          }),
        },
      },
    })),
  }
}

export default function Page() {
  return (
    <>
      <JsonLdScript data={getExperienceJsonLd()} />

      <JsonLdScript
        data={jsonLdBreadcrumbList([
          {
            name: "Home",
            href: "/",
          },
          {
            name: title,
            href: "/experience",
          },
        ])}
      />

      <div className="min-h-svh">
        <PageHeading>
          <PageHeadingBackLink href="/">Home</PageHeadingBackLink>
          <PageHeadingTitle>{title}</PageHeadingTitle>
        </PageHeading>

        <div className="screen-line-bottom pr-2 pl-4">
          <ExperienceList experiences={EXPERIENCES} headingAs="h2" />
        </div>

        <div className="h-4" />
      </div>
    </>
  )
}
