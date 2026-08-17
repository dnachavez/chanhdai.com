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
 * The binding constraint is Groq's free tier, not the context window.
 *
 * gpt-oss-120b accepts 131k tokens, but on the `on_demand` tier the account is
 * capped at 8,000 tokens per minute counting input and output together. The
 * bundle is resent whole on every turn, so it is charged against that ceiling
 * every single request — an early version at ~12.7k tokens could not complete
 * even one call, failing with a 413 rather than merely throttling.
 *
 * Two different failures hang off that ceiling, and only one of them is fatal:
 *
 * - A single request larger than 8,000 fails with a 413 every time, for
 *   everyone, forever. No retry helps. This budget exists to make that
 *   impossible.
 * - More than roughly one request per minute gets a retryable 429. That is a
 *   throughput problem, handled by the per-IP limiter and the "give it a
 *   minute" copy, not by this number.
 *
 * Derived by subtracting everything else in a request from the ceiling:
 * 8,000 − 600 (reply) − ~700 (system prompt) − ~400 (question and trimmed
 * history) − ~800 margin. Growth beyond this should trim a section, not raise
 * the number, because the ceiling is not ours to move.
 */
const TOKEN_BUDGET = 5_500

/**
 * Roles that keep their full achievement bullets, newest first. The rest are
 * reduced to employer, title, dates and skills.
 *
 * Every role stays present either way, because an employment timeline with
 * gaps in it is worse than one without detail. What goes is the depth on older
 * roles, which /experience still carries in full and which the assistant links
 * to.
 */
const EXPERIENCE_DETAIL_LIMIT = 4

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
  const roles = EXPERIENCES.map((company, index) => {
    const detailed = index < EXPERIENCE_DETAIL_LIMIT

    const positions = company.positions
      .map((position) => {
        const period = `${position.employmentPeriod.start} – ${position.employmentPeriod.end ?? "Present"}`
        const skills = position.skills?.length
          ? `\nSkills: ${position.skills.join(", ")}`
          : ""
        const description =
          detailed && position.description
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
    `Canonical page: /experience (the homepage shows only the three most recent roles at /#experience)

Roles beyond the ${EXPERIENCE_DETAIL_LIMIT} most recent list their employer, title, dates and skills without the detailed achievements. If asked for specifics about one of those, say the detail is on /experience rather than guessing at it.

${roles}`
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

/**
 * An index of the writing, not the writing itself.
 *
 * Post bodies were 5,951 of the bundle's 12,708 tokens — 47% — for content
 * that is one click away on a page the assistant links to. Carrying them made
 * every request exceed the free tier's per-minute ceiling outright, which cost
 * the whole feature to answer a question nobody had yet asked.
 *
 * The trade is real: the assistant can say what a post covers and link to it,
 * but cannot discuss its contents. Restoring the bodies is a paid-tier
 * decision, and `renderDocBody` in get-llm-text.ts is the seam to do it
 * through.
 */
function writingSection() {
  const posts = getBlogPosts()

  const entries = posts
    .map(
      (post) => `### ${post.metadata.title}

Canonical URL: /blog/${post.slug}
Published: ${post.metadata.createdAt}
Updated: ${post.metadata.updatedAt}
Summary: ${post.metadata.description}`
    )
    .join("\n\n")

  return section(
    "Writing",
    `Canonical page: /blog

Only titles and summaries are held here, not the posts themselves. Describe what a post covers and link to it; never invent or paraphrase its contents.

${entries}`
  )
}

function buildBundle() {
  const sections = [
    aboutSection(),
    experienceSection(),
    projectsSection(),
    educationSection(),
    awardsSection(),
    certificationsSection(),
    testimonialsSection(),
    gearSection(),
    writingSection(),
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

/** Per-section costs, so a budget failure says which section to look at. */
function reportSections(bundle: string) {
  const sections = bundle.split(/^## /m).slice(1)

  return sections
    .map((section) => {
      const [heading] = section.split("\n")
      return { heading, tokens: estimateTokens(section) }
    })
    .sort((a, b) => b.tokens - a.tokens)
}

function main() {
  const bundle = buildBundle()
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
    for (const { heading, tokens: sectionTokens } of reportSections(bundle)) {
      console.error(
        `[context-bundle]   ${heading.padEnd(16)} ~${sectionTokens.toLocaleString()} tokens`
      )
    }
    console.error(
      `[context-bundle] Over budget by ~${(tokens - TOKEN_BUDGET).toLocaleString()} tokens. ` +
        `The bundle is resent on every turn and counts against Groq's 8,000 tokens-per-minute ` +
        `free-tier ceiling, so exceeding it throttles or blocks every request. ` +
        `Trim the largest section above rather than raising TOKEN_BUDGET.`
    )
    process.exit(1)
  }
}

main()
