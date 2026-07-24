import { decodeEmail, decodePhoneNumber } from "@/utils/string"
import type { Person } from "schema-dts"

import { SITE_INFO } from "@/config/site"
import { EDUCATION } from "@/features/portfolio/data/education"
import { SOCIAL_LINKS } from "@/features/portfolio/data/social-links"
import { USER } from "@/features/portfolio/data/user"

/**
 * Stable @id anchors so Google can merge JSON-LD nodes across separate
 * <script> blocks (and pages) into a single entity in the Knowledge Graph.
 * The "#fragment" keeps each node id distinct from the page URL itself.
 */
export const JSON_LD_ID = {
  website: `${SITE_INFO.url}/#website`,
  person: `${SITE_INFO.url}/#person`,
} as const

const currentJob = USER.jobs[0]
const alumniOf = EDUCATION[0]

/**
 * Subject-matter terms for entity disambiguation. Curated rather than derived
 * from TECH_STACK: that module ships 60+ JSX icons and importing it here would
 * drag them into every page's metadata path.
 */
const KNOWS_ABOUT = [
  "Artificial Intelligence",
  "Voice AI",
  "Large Language Models",
  "Full Stack Development",
  "React",
  "Next.js",
  "TypeScript",
  "Node.js",
  "Python",
  "Amazon Web Services",
]

export const personJsonLd: Person = {
  "@type": "Person",
  "@id": JSON_LD_ID.person,
  name: USER.displayName,
  alternateName: [USER.username],
  identifier: USER.username,
  // Schema.org requires absolute URLs here; relative paths are silently dropped.
  image: `${SITE_INFO.url}${USER.avatar}`,
  url: SITE_INFO.url,
  jobTitle: USER.jobTitle,
  description: SITE_INFO.description,
  /**
   * Contact points are decoded here on purpose. The visible UI keeps them
   * base64-encoded to deter naive scrapers, but that also hides them from
   * search engines and AI assistants, which cannot answer "how do I contact
   * Dan Chavez" from an encoded string. Structured data is the canonical
   * machine-readable place for this.
   */
  email: decodeEmail(USER.emailB64),
  telephone: decodePhoneNumber(USER.phoneNumberB64),
  address: {
    "@type": "PostalAddress",
    addressLocality: "Cebu City",
    addressCountry: "PH",
  },
  worksFor: {
    "@type": "Organization",
    name: currentJob.company,
    url: currentJob.website,
  },
  alumniOf: {
    "@type": "CollegeOrUniversity",
    name: alumniOf.school,
  },
  knowsAbout: KNOWS_ABOUT,
  // Public profiles opt in via their `sameAs` flag (Knowledge Graph).
  sameAs: SOCIAL_LINKS.filter((link) => link.sameAs).map((link) => link.href),
}
