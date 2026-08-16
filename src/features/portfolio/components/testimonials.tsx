"use client"

import { useRef } from "react"
import { useInView, usePageInView } from "motion/react"

import { cn } from "@/lib/utils"
import { useMediaQuery } from "@/hooks/use-media-query"
import type { MarqueeContentProps } from "@/components/kibo-ui/marquee"
import {
  Marquee,
  MarqueeContent,
  MarqueeFade,
  MarqueeItem,
} from "@/components/kibo-ui/marquee"
import {
  Testimonial,
  TestimonialAuthor,
  TestimonialAuthorName,
  TestimonialAuthorTagline,
  TestimonialAvatar,
  TestimonialAvatarImg,
  TestimonialAvatarRing,
  TestimonialQuote,
} from "@/components/testimonial"
import { TestimonialSpotlight } from "@/components/testimonial-spotlight"
import { Twemoji } from "@/components/twemoji"
import {
  TESTIMONIALS_1,
  TESTIMONIALS_2,
} from "@/features/portfolio/data/testimonials"
import type { Testimonial as TestimonialType } from "@/features/portfolio/types/testimonials"

import { Panel, PanelContent, PanelHeader, PanelTitle } from "./panel"
import { PanelViewAll } from "./panel-view-all"

const ID = "testimonials"

const TESTIMONIALS = [...TESTIMONIALS_1, ...TESTIMONIALS_2].sort(
  (a, b) => Number(a.order ?? 999) - Number(b.order ?? 999)
)

const TESTIMONIALS_MOBILE = TESTIMONIALS.slice(0, 8)

const TESTIMONIALS_FEATURED = TESTIMONIALS.filter((item) => item.isFeatured)

const TESTIMONIALS_1_FILTERED = TESTIMONIALS_1.filter(
  (item) => !item.isFeatured
)

const TESTIMONIALS_2_FILTERED = TESTIMONIALS_2.filter(
  (item) => !item.isFeatured
)

export function Testimonials() {
  const ref = useRef<HTMLDivElement>(null)
  const isPageInView = usePageInView()
  const isInView = useInView(ref)
  const isDesktop = useMediaQuery("(min-width: 40rem)") // sm breakpoint
  const play = isPageInView && isInView && isDesktop

  return (
    <Panel ref={ref} id={ID}>
      <PanelHeader>
        <PanelTitle>Trusted by clients</PanelTitle>
      </PanelHeader>

      <div className="grid gap-4 py-4 sm:hidden">
        {TESTIMONIALS_MOBILE.map((item) => (
          <TestimonialItem
            key={item.url}
            className="screen-line-top screen-line-bottom"
            {...item}
          />
        ))}
      </div>

      <PanelContent className="hidden gap-1 sm:grid sm:grid-cols-2">
        {TESTIMONIALS_FEATURED.map((item) => (
          <TestimonialSpotlight
            key={item.url}
            className="bg-background inset-ring-foreground/20 [--spotlight-size:50%]"
          >
            <TestimonialItem {...item} showIcon />
          </TestimonialSpotlight>
        ))}

        {TESTIMONIALS_1_FILTERED.length > 0 && (
          <TestimonialsMarquee
            className="sm:col-span-2"
            data={TESTIMONIALS_1_FILTERED}
            play={play}
          />
        )}

        {TESTIMONIALS_2_FILTERED.length > 0 && (
          <TestimonialsMarquee
            className="sm:col-span-2"
            data={TESTIMONIALS_2_FILTERED}
            direction="right"
            play={play}
          />
        )}
      </PanelContent>

      <PanelViewAll href="/testimonials">Show more</PanelViewAll>
    </Panel>
  )
}

function TestimonialsMarquee({
  data,
  direction,
  play,
  className,
}: {
  data: TestimonialType[]
  direction?: MarqueeContentProps["direction"]
  play?: boolean
  className?: string
}) {
  return (
    <Marquee className={className}>
      <MarqueeFade side="left" />
      <MarqueeFade side="right" />

      <MarqueeContent
        className="[&_.rfm-initial-child-container]:items-stretch! [&_.rfm-marquee]:items-stretch!"
        play={play}
        pauseOnHover={false}
        direction={direction}
        speed={30}
      >
        {data.map((item) => (
          <MarqueeItem
            key={item.url}
            className="mx-0.5 h-full w-xs rounded-xl bg-background inset-ring-1 inset-ring-border transition-[background-color] ease-out hover:bg-accent-muted"
          >
            {/* Long quotes would otherwise stretch the whole row; the full text lives on /testimonials */}
            <TestimonialItem {...item} quoteClassName="line-clamp-6" />
          </MarqueeItem>
        ))}
      </MarqueeContent>
    </Marquee>
  )
}

function TestimonialItem({
  className,
  quoteClassName,
  authorAvatar,
  authorName,
  authorTagline,
  url,
  quote,
  icon,
  showIcon = false,
}: TestimonialType & {
  className?: string
  quoteClassName?: string
  showIcon?: boolean
}) {
  return (
    <Testimonial className={cn("group/testimonial relative", className)}>
      <TestimonialQuote className="font-serif text-base">
        <p className={quoteClassName}>
          <Twemoji className="grayscale transition-[filter] duration-300 ease-[cubic-bezier(0.42,0,0.58,1)] group-hover/testimonial:grayscale-0">
            {quote}
          </Twemoji>
        </p>
      </TestimonialQuote>

      <TestimonialAuthor>
        <TestimonialAvatar>
          <TestimonialAvatarImg
            className="grayscale transition-[filter] duration-300 ease-[cubic-bezier(0.42,0,0.58,1)] group-hover/testimonial:grayscale-0"
            src={authorAvatar}
            alt={authorName}
          />
          <TestimonialAvatarRing />
        </TestimonialAvatar>

        <TestimonialAuthorName>
          <a href={url} target="_blank" rel="noopener">
            <span className="absolute inset-0" aria-hidden />
            {authorName}
          </a>
        </TestimonialAuthorName>
        <TestimonialAuthorTagline>{authorTagline}</TestimonialAuthorTagline>
      </TestimonialAuthor>

      {showIcon && icon && (
        <div
          className="pointer-events-none absolute right-3 bottom-3 flex size-8 items-center justify-center [&_svg]:size-4 [&_svg]:text-muted-foreground/80"
          aria-hidden
        >
          {icon}
        </div>
      )}
    </Testimonial>
  )
}
