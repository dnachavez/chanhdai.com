/**
 * Emits the single context bundle the chat widget grounds on.
 *
 * Reads the same data modules and MDX content the site itself renders, so the
 * bundle cannot describe a version of the site that no longer exists. Wired
 * into `pnpm build` ahead of `next build`, which means a deploy regenerates it
 * whether or not anyone remembered to.
 *
 * Two files come out of one pass:
 *
 * - `context-bundle.md` is the reviewable artifact. It is what you read in a
 *   diff to see what the bot learned this release.
 * - `context-bundle.ts` is what the route imports. Reading the `.md` off disk
 *   at request time would work locally and fail on Vercel, where only traced
 *   files reach the serverless bundle; a module export sidesteps file tracing
 *   entirely. It is JSON-encoded rather than a template literal because blog
 *   posts contain backticks and `${`, both of which would terminate one.
 *
 * Output is deterministic — no timestamps, no absolute URLs built from
 * environment variables — so an unchanged content tree produces an empty diff.
 */

import fs from "node:fs"
import path from "node:path"

import { getBlogPosts } from "@/features/doc/data/documents"
import { renderDocBody } from "@/features/doc/lib/get-llm-text"
import { AWARDS } from "@/features/portfolio/data/awards"
import { CERTIFICATIONS } from "@/features/portfolio/data/certifications"
import { EDUCATION } from "@/features/portfolio/data/education"
import { EXPERIENCES } from "@/features/portfolio/data/experiences"
import { GEAR } from "@/features/portfolio/data/gear"
import { PROJECTS } from "@/features/portfolio/data/projects"
import { SOCIAL_LINKS } from "@/features/portfolio/data/social-links"
import {
  TESTIMONIALS_1,
  TESTIMONIALS_2,
} from "@/features/portfolio/data/testimonials"
import { USER } from "@/features/portfolio/data/user"

const OUTPUT_DIR = path.join(process.cwd(), "src/generated")

/**
 * Ceiling on the bundle, not on the model. gpt-oss-120b takes 131k, but the
 * bundle is resent on every turn of every conversation, so its size is the
 * dominant cost driver on a free tier. Tripping this should prompt a decision
 * about what to summarise, not a bigger number.
 */
const TOKEN_BUDGET = 40_000

/** Rough enough to catch a runaway; exact counting would need a tokenizer. */
function estimateTokens(text: string) {
  return Math.ceil(text.length / 4)
}

/**
 * `USER.about` closes with a literal `<p>` carrying the caveat that the metrics
 * are historical. The caveat matters to a grounded answer; the markup does not.
 */
function stripHtml(markdown: string) {
  return markdown.replace(/<\/?[^>]+>/g, "").trim()
}

function section(heading: string, body: string) {
  return `## ${heading}\n\n${body.trim()}\n`
}

/** Matches an ATX heading, capturing its `#` run. Indented up to 3 spaces per CommonMark. */
const HEADING = /^ {0,3}(#{1,6})(\s)/
/** Opening or closing fence for a code block, ``` or ~~~. */
const FENCE = /^ {0,3}(`{3,}|~{3,})/

/**
 * Rewrites a post's headings so its shallowest one sits at `targetLevel`.
 *
 * Post bodies are spliced under a `###` entry inside the Writing section, and
 * their own `##` headings would otherwise land as siblings of `## About` and
 * `## Experience` — making "Dumalag, Capiz" read as a top-level section of the
 * profile rather than a heading inside one blog post. The shift is computed
 * from the shallowest heading present rather than hardcoded, so a post that
 * starts at `#` and one that starts at `##` both nest correctly.
 *
 * Fenced blocks are tracked so a `# comment` in a shell snippet is left alone.
 */
function nestHeadings(markdown: string, targetLevel: number) {
  const lines = markdown.split("\n")

  let fence: string | null = null
  let shallowest = 7

  for (const line of lines) {
    const fenceMatch = line.match(FENCE)
    if (fenceMatch) {
      const marker = fenceMatch[1][0]
      if (fence === null) fence = marker
      else if (fence === marker) fence = null
      continue
    }
    if (fence !== null) continue

    const headingMatch = line.match(HEADING)
    if (headingMatch) {
      shallowest = Math.min(shallowest, headingMatch[1].length)
    }
  }

  if (shallowest === 7) return markdown

  const shift = targetLevel - shallowest
  if (shift === 0) return markdown

  fence = null

  return lines
    .map((line) => {
      const fenceMatch = line.match(FENCE)
      if (fenceMatch) {
        const marker = fenceMatch[1][0]
        if (fence === null) fence = marker
        else if (fence === marker) fence = null
        return line
      }
      if (fence !== null) return line

      return line.replace(HEADING, (_, hashes: string, space: string) => {
        // Markdown stops at h6; deeper nesting would silently stop rendering
        // as a heading, so clamp rather than emit `#######`.
        const level = Math.min(6, Math.max(1, hashes.length + shift))
        return `${"#".repeat(level)}${space}`
      })
    })
    .join("\n")
}

function aboutSection() {
  return section(
    "About",
    `Canonical page: /#hello

${stripHtml(USER.about)}

### Personal details

- Full name: ${USER.displayName}
- Username: ${USER.username}
- Pronouns: ${USER.pronouns}
- Location: ${USER.address} (timezone ${USER.timeZone})
- Current title: ${USER.jobTitle}
- Website: ${USER.website}
- Contact page section: /#hello

### Profiles

${SOCIAL_LINKS.map((link) => `- ${link.title} (${link.handle}): ${link.href}`).join("\n")}`
  )
}

function experienceSection() {
  const roles = EXPERIENCES.map((company) => {
    const positions = company.positions
      .map((position) => {
        const period = `${position.employmentPeriod.start} – ${position.employmentPeriod.end ?? "Present"}`
        const skills = position.skills?.length
          ? `\nSkills: ${position.skills.join(", ")}`
          : ""
        const description = position.description
          ? `\n\n${position.description.trim()}`
          : ""

        return `#### ${position.title}\n\nPeriod: ${period}${skills}${description}`
      })
      .join("\n\n")

    const meta = [
      company.companyWebsite && `Website: ${company.companyWebsite}`,
      company.location &&
        `Location: ${company.location}${company.locationType ? ` (${company.locationType})` : ""}`,
      company.isCurrentEmployer && "This is the current employer.",
    ]
      .filter(Boolean)
      .join("\n")

    return `### ${company.companyName}\n\nCanonical URL: /experience#experience-${company.id}\n${meta}\n\n${positions}`
  }).join("\n\n")

  return section(
    "Experience",
    `Canonical page: /experience (the homepage shows only the three most recent roles at /#experience)\n\n${roles}`
  )
}

function projectsSection() {
  const projects = PROJECTS.map((project) => {
    const { start, end } = project.period
    const period = end && end !== start ? `${start} – ${end}` : start
    const external = project.link ? `\nExternal link: ${project.link}` : ""

    return `### ${project.title}

Canonical URL: /projects#project-${project.id}
Period: ${period}${external}
Skills: ${project.skills.join(", ")}

${project.description?.trim() ?? ""}`
  }).join("\n\n")

  return section("Projects", `Canonical page: /projects\n\n${projects}`)
}

function educationSection() {
  const entries = EDUCATION.map((entry) => {
    const skills = entry.skills?.length
      ? `\nSkills: ${entry.skills.join(", ")}`
      : ""

    return `### ${entry.school}

${entry.degree}${entry.fieldOfStudy ? `, ${entry.fieldOfStudy}` : ""}
Period: ${entry.period.start} – ${entry.period.end ?? "Present"}${skills}

${entry.description?.trim() ?? ""}`
  }).join("\n\n")

  return section("Education", `Canonical page: /#education\n\n${entries}`)
}

function awardsSection() {
  const awards = AWARDS.map((award) =>
    [
      `### ${award.title}`,
      `Result: ${award.prize}`,
      `Date: ${award.date}`,
      award.grade && `Stage: ${award.grade}`,
      award.description?.trim(),
    ]
      .filter(Boolean)
      .join("\n")
  ).join("\n\n")

  return section("Awards", `Canonical page: /#awards\n\n${awards}`)
}

function certificationsSection() {
  const certifications = CERTIFICATIONS.map(
    (certification) =>
      `- ${certification.title} — issued by ${certification.issuer} on ${certification.issueDate}. Credential: ${certification.credentialURL}`
  ).join("\n")

  return section(
    "Certifications",
    `Canonical page: /#certs\n\n${certifications}`
  )
}

function testimonialsSection() {
  const testimonials = [...TESTIMONIALS_1, ...TESTIMONIALS_2]
    .map(
      (testimonial) =>
        `- ${testimonial.authorName} (${testimonial.authorTagline}), ${testimonial.date}: "${testimonial.quote}"`
    )
    .join("\n")

  return section(
    "Testimonials",
    `Canonical page: /testimonials\n\nThese are direct quotes. Reproduce them verbatim or not at all.\n\n${testimonials}`
  )
}

function gearSection() {
  const gear = GEAR.map(
    (item) => `- ${item.name} (${item.category}) — ${item.description}`
  ).join("\n")

  return section("Gear", `Canonical page: /#gear\n\n${gear}`)
}

async function writingSection() {
  const posts = getBlogPosts()

  const bodies = await Promise.all(
    posts.map(async (post) => {
      const body = await renderDocBody(post.content)

      return `### ${post.metadata.title}

Canonical URL: /blog/${post.slug}
Published: ${post.metadata.createdAt}
Updated: ${post.metadata.updatedAt}
Summary: ${post.metadata.description}

${nestHeadings(body.trim(), 4)}`
    })
  )

  return section(
    "Writing",
    `Canonical page: /blog\n\n${bodies.join("\n\n---\n\n")}`
  )
}

async function buildBundle() {
  const sections = [
    aboutSection(),
    experienceSection(),
    projectsSection(),
    educationSection(),
    awardsSection(),
    certificationsSection(),
    testimonialsSection(),
    gearSection(),
    await writingSection(),
  ]

  return `# Reference material about ${USER.displayName}

Every URL below is a real page on this site. Cite them as site-relative paths
exactly as written; do not invent paths, and do not convert them to absolute
URLs.

${sections.join("\n")}`
}

/**
 * Every route the bot is allowed to link to.
 *
 * The system prompt tells the model to use only the paths written in the
 * bundle, but a prompt is a request, not a guarantee — and an invented slug
 * would render as a perfectly clickable link to a 404. The client checks
 * hrefs against this list and demotes anything unrecognised to plain text, so
 * a hallucinated link cannot be followed.
 *
 * Only pathnames are listed. Fragments are checked against the pathname they
 * hang off, which covers the homepage anchors (`/#gear`) and the per-entry
 * anchors on /experience and /projects without enumerating every id.
 */
function linkablePaths() {
  return [
    "/",
    "/blog",
    "/chat",
    "/experience",
    "/projects",
    "/testimonials",
    ...getBlogPosts().map((post) => `/blog/${post.slug}`),
  ]
}

async function main() {
  const bundle = await buildBundle()
  const tokens = estimateTokens(bundle)
  const paths = linkablePaths()

  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  fs.writeFileSync(path.join(OUTPUT_DIR, "context-bundle.md"), bundle, "utf-8")
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "context-bundle.ts"),
    `// Generated by src/scripts/build-context-bundle.mts. Do not edit.\n` +
      `export const CONTEXT_BUNDLE = ${JSON.stringify(bundle)}\n\n` +
      `export const CONTEXT_BUNDLE_ESTIMATED_TOKENS = ${tokens}\n\n` +
      `export const LINKABLE_PATHS: readonly string[] = ${JSON.stringify(paths)}\n`,
    "utf-8"
  )

  console.log(
    `[context-bundle] ${bundle.length.toLocaleString()} chars, ~${tokens.toLocaleString()} tokens (budget ${TOKEN_BUDGET.toLocaleString()})`
  )

  if (tokens > TOKEN_BUDGET) {
    console.error(
      `[context-bundle] Over budget by ~${(tokens - TOKEN_BUDGET).toLocaleString()} tokens. ` +
        `The bundle is resent on every turn, so this is a per-request cost. ` +
        `Summarise or drop a section rather than raising TOKEN_BUDGET.`
    )
    process.exit(1)
  }
}

await main()
