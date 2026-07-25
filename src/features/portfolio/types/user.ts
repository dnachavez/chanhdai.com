import type { AvatarLightsVariants } from "@/features/portfolio/components/avatar-lights"

export type User = {
  firstName: string
  lastName: string
  /** Preferred public-facing name */
  displayName: string
  /** Handle/username used in links or mentions */
  username: string
  gender: "male" | "female" | "non-binary"
  /** e.g. "he/him", "she/her", "they/them" */
  pronouns: string
  /** Short role label shown in the UI under the display name */
  bio: string
  /**
   * Site-wide meta description. Kept separate from `bio` because search
   * snippets and social cards need 150-160 characters, not a UI label.
   */
  metaDescription: string
  /** Short phrases rotated in UI (e.g., homepage flip effect) */
  flipSentences: string[]
  /** General location for display */
  address: string
  /** E.164 format, base64 encoded (https://t.io.vn/base64-string-converter) */
  phoneNumberB64: string
  /** base64 encoded (https://t.io.vn/base64-string-converter) */
  emailB64: string
  /** Personal/homepage URL */
  website: string
  /** Primary/current role shown on profile */
  jobTitle: string
  /** Work history entries */
  jobs: {
    title: string
    company: string
    website: string
    experienceId?: string
  }[]
  /** Rich about section; supports Markdown */
  about: string
  /** Public URL to avatar image */
  avatar: string
  /** Different avatar variants based on theme and lighting */
  avatarVariants: AvatarLightsVariants
  /** Open Graph image URL for social sharing */
  ogImage: string
  /** Audio URL for name pronunciation */
  namePronunciationUrl: string
  /**
   * Target terms kept for content planning. Deliberately NOT emitted as a
   * `<meta name="keywords">` tag: Google has ignored that tag since 2009 and
   * Bing treats a stuffed one as a spam signal.
   */
  keywords: string[]
  /** Time zone in IANA format (e.g., "Asia/Ho_Chi_Minh") */
  timeZone: string
  /** Profile/site start date in YYYY-MM-DD */
  dateCreated: string
}
