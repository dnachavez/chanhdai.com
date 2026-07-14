import type { SocialProfile } from "@/features/portfolio/types/social-links"

/**
 * Keyed registry of social profiles — the single source of truth. Icons are
 * bound separately in `social-link-icons.tsx` (keyed by the same `SocialName`),
 * so adding a profile here forces the icon map to stay in sync at compile time.
 */
export const SOCIAL = {
  github: {
    title: "GitHub",
    handle: "dnachavez",
    href: "https://github.com/dnachavez",
    sameAs: true,
  },
  linkedin: {
    title: "LinkedIn",
    handle: "dnachavez",
    href: "https://linkedin.com/in/dnachavez",
    sameAs: true,
  },
  x: {
    title: "X",
    handle: "@dnachavez_dev",
    href: "https://x.com/dnachavez_dev",
    sameAs: true,
  },
  discord: {
    title: "Discord",
    handle: "dnachavez",
    href: "https://discord.com/users/1212759422594719804",
  },
  instagram: {
    title: "Instagram",
    handle: "@dnachavez.dev",
    href: "https://instagram.com/dnachavez.dev",
    sameAs: true,
  },
  tiktok: {
    title: "TikTok",
    handle: "@dnachavez",
    href: "https://tiktok.com/@dnachavez",
    sameAs: true,
  },
  facebook: {
    title: "Facebook",
    handle: "dnachavez.dev",
    href: "https://www.facebook.com/dnachavez.dev",
    sameAs: true,
  },
} satisfies Record<string, SocialProfile>

export type SocialName = keyof typeof SOCIAL

export type SocialLink = SocialProfile & { name: SocialName }

export const SOCIAL_LINKS: SocialLink[] = (
  Object.entries(SOCIAL) as [SocialName, SocialProfile][]
).map(([name, profile]) => ({ name, ...profile }))
