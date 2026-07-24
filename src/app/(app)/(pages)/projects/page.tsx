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
import { ProjectItem } from "@/features/portfolio/components/projects/project-item"
import { PROJECTS } from "@/features/portfolio/data/projects"

const title = "Projects"
const description =
  "Every project by Dan Chavez, a senior full stack and AI engineer in Cebu City, Philippines: AI agents, IoT, developer tooling, and open source."

/** Short enough to stay legible on a 1200x630 card. */
const tagline = "Everything I've built."

const ogImage = `/og/simple?title=${encodeURIComponent(title)}&description=${encodeURIComponent(tagline)}`

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/projects",
  },
  openGraph: {
    ...baseOpenGraph,
    url: "/projects",
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

function getProjectsJsonLd(): WithContext<ItemList> {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": absoluteUrl("/projects"),
    name: `${title} — Dan Chavez`,
    description,
    url: absoluteUrl("/projects"),
    numberOfItems: PROJECTS.length,
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    itemListElement: PROJECTS.map((project, index) => ({
      "@type": "ListItem" as const,
      position: index + 1,
      item: {
        "@type": "CreativeWork" as const,
        name: project.title,
        ...(project.description && { description: project.description }),
        ...(project.link && { url: project.link }),
        ...(project.skills?.length && { keywords: project.skills.join(", ") }),
      },
    })),
  }
}

export default function Page() {
  return (
    <>
      <JsonLdScript data={getProjectsJsonLd()} />

      <JsonLdScript
        data={jsonLdBreadcrumbList([
          {
            name: "Home",
            href: "/",
          },
          {
            name: title,
            href: "/projects",
          },
        ])}
      />

      <div className="min-h-svh">
        <PageHeading>
          <PageHeadingBackLink href="/">Home</PageHeadingBackLink>
          <PageHeadingTitle>{title}</PageHeadingTitle>
        </PageHeading>

        <ul className="screen-line-bottom">
          {PROJECTS.map((project) => (
            <li key={project.id} className="border-b border-line">
              <ProjectItem project={project} />
            </li>
          ))}
        </ul>

        <div className="h-4" />
      </div>
    </>
  )
}
