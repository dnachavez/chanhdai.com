import type { Route } from "next"

import type { NavItem } from "@/types/nav"
import { SOCIAL } from "@/features/portfolio/data/social-links"
import { USER } from "@/features/portfolio/data/user"

export const SITE_INFO = {
  name: USER.displayName,
  url: process.env.NEXT_PUBLIC_APP_URL || "https://www.dnachavez.dev",
  ogImage: USER.ogImage,
  description: USER.metaDescription,
}

export const BLOG_INFO = {
  title: "Blog",
  description:
    "Notes on full stack and AI engineering, and the occasional story from the road that got me here.",
}

export const LICENSE = {
  name: "MIT License",
  url: "https://github.com/dnachavez/dnachavez.dev/blob/main/LICENSE",
}

export const META_THEME_COLORS = {
  light: "#ffffff",
  dark: "#09090b",
}

export const MAIN_NAV: NavItem<Route>[] = [
  {
    title: "Blog",
    href: "/blog",
  },
  {
    title: "Experience",
    href: "/experience",
  },
  {
    title: "Projects",
    href: "/projects",
  },
  {
    title: "Testimonials",
    href: "/testimonials",
  },
]

/**
 * Deliberately not `MAIN_NAV` plus Home. The mobile nav is a `w-fit` floating
 * pill sharing its row with the command menu, and four text links -- one of
 * them "Testimonials" -- overflow it on a phone. The three pages added to
 * `MAIN_NAV` are for the header, which crawlers read (it is hidden with
 * `max-sm:hidden`, so the markup is present either way) and which has room.
 */
export const MOBILE_NAV: NavItem<Route>[] = [
  {
    title: "Home",
    href: "/",
  },
  {
    title: "Blog",
    href: "/blog",
  },
]

export const X_HANDLE = SOCIAL.x.handle
export const GITHUB_USERNAME = SOCIAL.github.handle
export const SOURCE_CODE_GITHUB_REPO = "dnachavez/dnachavez.dev"
export const SOURCE_CODE_GITHUB_URL =
  "https://github.com/dnachavez/dnachavez.dev"

export const UTM_PARAMS = {
  utm_source: "dnachavez.dev",
}
