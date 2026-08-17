import type { Metadata } from "next"

import { X_HANDLE } from "@/config/site"
import { jsonLdBreadcrumbList, JsonLdScript } from "@/lib/json-ld"
import { baseOpenGraph } from "@/lib/metadata"
import {
  PageHeading,
  PageHeadingBackLink,
  PageHeadingTitle,
} from "@/components/page-heading"
import { ChatConversation } from "@/features/chat/components/chat-conversation"

const title = "Chat"
const description =
  "Ask questions about Dan Chavez's work, projects, and writing. Answers come from what is published on this site."

/** Short enough to stay legible on a 1200x630 card. */
const tagline = "Ask me anything."

const ogImage = `/og/simple?title=${encodeURIComponent(title)}&description=${encodeURIComponent(tagline)}`

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/chat",
  },
  openGraph: {
    ...baseOpenGraph,
    url: "/chat",
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

export default function Page() {
  return (
    <>
      <JsonLdScript
        data={jsonLdBreadcrumbList([
          {
            name: "Home",
            href: "/",
          },
          {
            name: title,
            href: "/chat",
          },
        ])}
      />

      <div className="min-h-svh">
        <PageHeading>
          <PageHeadingBackLink href="/">Home</PageHeadingBackLink>
          <PageHeadingTitle>{tagline}</PageHeadingTitle>
        </PageHeading>

        <p className="screen-line-bottom p-4 text-base text-balance text-muted-foreground">
          {description}
        </p>

        {/*
          A fixed height rather than a viewport calculation. The heading above
          wraps differently at every width, so any `100dvh - chrome` figure is
          wrong at some size — and being wrong here clips the composer. At this
          height the region is comfortable on a laptop and the page simply
          scrolls on anything shorter.
        */}
        <ChatConversation className="h-[32rem]" />

        {/*
          The bottom fade in the app layout is `fixed`, so it covers the last
          6rem of the viewport regardless of scroll position. Without this
          spacer the composer sits underneath it once the page is scrolled to
          the end.
        */}
        <div className="h-(--fade-bottom-height)" />
      </div>
    </>
  )
}
