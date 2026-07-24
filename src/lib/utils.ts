import type { ClassValue } from "clsx"
import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

import { SITE_INFO } from "@/config/site"

export const cn = (...inputs: ClassValue[]) => {
  return twMerge(clsx(inputs))
}

/**
 * Resolves a site-relative path against the canonical origin. Goes through
 * SITE_INFO so a missing NEXT_PUBLIC_APP_URL falls back to the www host
 * rather than emitting "undefined/blog/...".
 */
export function absoluteUrl(path: string) {
  return `${SITE_INFO.url}${path}`
}
