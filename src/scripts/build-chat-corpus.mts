/**
 * Emits the two tiers the chat assistant runs on.
 *
 * Tier one is `SITE_INDEX`: a compact map of everything that exists, sent on
 * every single request. Tier two is `CORPUS_ENTRIES`: the full text, fetched
 * just-in-time by the `lookup` tool for the question actually asked.
 *
 * The split exists because of Groq's 8,000 tokens-per-minute free-tier ceiling
 * (see the derivation in `src/features/chat/config.ts`). Stuffing the whole
 * ~13k-token corpus into the prompt 413s every request; a ~1.1k index plus one
 * bounded tool result fits, and — the part that matters — carries *more* depth
 * per topic than the stuffed version ever could, because nothing has to be
 * trimmed out of tier two to make room.
 *
 * Both tiers read the same data modules and MDX the site itself renders, so
 * neither can describe a version of the site that no longer exists. Wired into
 * `pnpm build` ahead of `next build`, which means a deploy regenerates them
 * whether or not anyone remembered to.
 *
 * Four files come out of one pass:
 *
 * - `chat-index.ts` — tier one. Server-only.
 * - `chat-corpus.ts` — tier two. Server-only, and deliberately a separate
 *   module: `chat-client.ts` is imported by client components, and merging them
 *   would risk shipping ~50KB of corpus text to every visitor's browser.
 * - `chat-client.ts` — the two lists the browser genuinely needs: linkable
 *   paths (to demote hallucinated links to plain text) and opening suggestions.
 * - `chat-corpus.md` — the reviewable artifact. It is what you read in a diff to
 *   see what the bot learned this release.
 *
 * The `.ts` files are JSON-encoded rather than template literals because blog
 * posts contain backticks and `${`, both of which would terminate one.
 *
 * Output is deterministic — no timestamps, no absolute URLs built from
 * environment variables — so an unchanged content tree produces an empty diff.
 */

import fs from "node:fs"
import path from "node:path"

import {
  INDEX_TOKEN_BUDGET,
  MAX_TOOL_RESULT_TOKENS,
} from "@/features/chat/config"
import type { CorpusEntry } from "@/features/chat/types/corpus"
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

/**
 * Entry ids are quoted back by the model to fetch an entry directly, so they
 * have to survive a round trip through prose. Slugs do; the UUIDs on `AWARDS`
 * do not.
 */
function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

function period(start: string, end?: string) {
  if (!end) return `${start} – Present`
  return end === start ? start : `${start} – ${end}`
}

/* -------------------------------------------------------------------------- *
 * Tier two: the corpus
 * -------------------------------------------------------------------------- */

function aboutEntries(): CorpusEntry[] {
  return [
    {
      id: "about-dan",
      kind: "about",
      title: "About Dan Chavez",
      url: "/#hello",
      keywords: [
        USER.displayName,
        USER.username,
        USER.jobTitle,
        "bio",
        "background",
        "who",
        "summary",
      ],
      text: `${stripHtml(USER.about)}

Full name: ${USER.displayName}
Username: ${USER.username}
Pronouns: ${USER.pronouns}
Location: ${USER.address} (timezone ${USER.timeZone})
Current title: ${USER.jobTitle}
Website: ${USER.website}`,
      question: "Who are you?",
      followUps: ["What are you working on right now?"],
    },
    {
      id: "about-profiles",
      kind: "about",
      title: "Profiles and where to find me",
      url: "/#hello",
      keywords: [
        "contact",
        "email",
        "github",
        "linkedin",
        "social",
        "profile",
        "hire",
        "reach",
        ...SOCIAL_LINKS.map((link) => link.title),
      ],
      text: SOCIAL_LINKS.map(
        (link) => `- ${link.title} (${link.handle}): ${link.href}`
      ).join("\n"),
      question: "How can I reach you?",
      followUps: ["Are you open to work?"],
    },
  ]
}

function experienceEntries(): CorpusEntry[] {
  return EXPERIENCES.flatMap((company) =>
    company.positions.map<CorpusEntry>((position) => {
      const meta = [
        `Company: ${company.companyName}`,
        `Role: ${position.title}`,
        `Period: ${period(position.employmentPeriod.start, position.employmentPeriod.end)}`,
        position.employmentType && `Employment type: ${position.employmentType}`,
        company.location &&
          `Location: ${company.location}${company.locationType ? ` (${company.locationType})` : ""}`,
        company.companyWebsite && `Company website: ${company.companyWebsite}`,
        company.isCurrentEmployer && "This is the current employer.",
        position.skills?.length && `Skills: ${position.skills.join(", ")}`,
      ]
        .filter(Boolean)
        .join("\n")

      return {
        id: `experience-${company.id}-${position.id}`,
        kind: "experience",
        title: `${position.title} at ${company.companyName}`,
        url: `/experience#position-${company.id}-${position.id}`,
        keywords: [
          company.companyName,
          company.id,
          position.title,
          ...(position.skills ?? []),
          "job",
          "role",
          "work",
          "experience",
        ],
        text: position.description
          ? `${meta}\n\n${position.description.trim()}`
          : meta,
        question: `What did you build at ${company.companyName}?`,
        followUps: position.skills?.length
          ? [`How did you use ${position.skills[0]} at ${company.companyName}?`]
          : [`What did the ${position.title} role involve?`],
      }
    })
  )
}

function projectEntries(): CorpusEntry[] {
  return PROJECTS.map<CorpusEntry>((project) => {
    const meta = [
      `Project: ${project.title}`,
      `Period: ${period(project.period.start, project.period.end)}`,
      project.link && `External link: ${project.link}`,
      `Skills: ${project.skills.join(", ")}`,
    ]
      .filter(Boolean)
      .join("\n")

    return {
      id: `project-${project.id}`,
      kind: "project",
      title: project.title,
      url: `/projects#project-${project.id}`,
      keywords: [project.title, project.id, ...project.skills, "project", "built"],
      text: project.description
        ? `${meta}\n\n${project.description.trim()}`
        : meta,
      question: `Tell me about ${project.title}.`,
      followUps: [`What did you build ${project.title} with?`],
    }
  })
}

function educationEntries(): CorpusEntry[] {
  return EDUCATION.map<CorpusEntry>((entry) => {
    const meta = [
      `School: ${entry.school}`,
      entry.degree &&
        `Degree: ${entry.degree}${entry.fieldOfStudy ? `, ${entry.fieldOfStudy}` : ""}`,
      `Period: ${period(entry.period.start, entry.period.end)}`,
      entry.skills?.length && `Skills: ${entry.skills.join(", ")}`,
    ]
      .filter(Boolean)
      .join("\n")

    return {
      id: `education-${entry.id}`,
      kind: "education",
      title: entry.school,
      url: "/#education",
      keywords: [
        entry.school,
        entry.id,
        entry.degree ?? "",
        entry.fieldOfStudy ?? "",
        ...(entry.skills ?? []),
        "school",
        "degree",
        "study",
        "university",
        "education",
        "gpa",
        "graduate",
        "thesis",
      ].filter(Boolean),
      text: entry.description
        ? `${meta}\n\n${entry.description.trim()}`
        : meta,
      question: `What did you study at ${entry.school}?`,
      followUps: [`What did you achieve at ${entry.school}?`],
    }
  })
}

function awardEntries(): CorpusEntry[] {
  return AWARDS.map<CorpusEntry>((award) => ({
    id: `award-${slugify(award.title)}`,
    kind: "award",
    title: `${award.title} — ${award.prize}`,
    url: "/#awards",
    keywords: [
      award.title,
      award.prize,
      award.grade,
      "award",
      "competition",
      "hackathon",
      "won",
    ],
    text: [
      `Award: ${award.title}`,
      `Result: ${award.prize}`,
      `Date: ${award.date}`,
      award.grade && `Stage: ${award.grade}`,
      award.referenceLink && `Reference: ${award.referenceLink}`,
      award.description?.trim() && `\n${award.description.trim()}`,
    ]
      .filter(Boolean)
      .join("\n"),
    question: `What did you build for ${award.title}?`,
    followUps: ["What other competitions have you won?"],
  }))
}

function certificationEntries(): CorpusEntry[] {
  return CERTIFICATIONS.map<CorpusEntry>((certification) => ({
    id: `certification-${slugify(certification.title)}`,
    kind: "certification",
    title: certification.title,
    url: "/#certs",
    keywords: [
      certification.title,
      certification.issuer,
      "certification",
      "certificate",
      "credential",
      "course",
    ],
    text: [
      `Certification: ${certification.title}`,
      `Issuer: ${certification.issuer}`,
      `Issued: ${certification.issueDate}`,
      certification.credentialID && `Credential ID: ${certification.credentialID}`,
      `Credential URL: ${certification.credentialURL}`,
    ]
      .filter(Boolean)
      .join("\n"),
    question: `Tell me about your ${certification.title}.`,
    followUps: ["What other certifications do you hold?"],
  }))
}

function testimonialEntries(): CorpusEntry[] {
  return [...TESTIMONIALS_1, ...TESTIMONIALS_2].map<CorpusEntry>(
    (testimonial) => ({
      id: `testimonial-${slugify(testimonial.authorName)}`,
      kind: "testimonial",
      title: `Testimonial from ${testimonial.authorName}`,
      url: "/testimonials",
      keywords: [
        testimonial.authorName,
        testimonial.authorTagline,
        "testimonial",
        "recommendation",
        "reference",
        "colleague",
        "praise",
      ],
      text: `This is a direct quote. Reproduce it verbatim or not at all.

${testimonial.authorName} (${testimonial.authorTagline}), ${testimonial.date}:
"${testimonial.quote}"`,
      question: `What did ${testimonial.authorName} say about you?`,
      followUps: [`How did you work with ${testimonial.authorName}?`],
    })
  )
}

/**
 * Gear is grouped by category rather than one entry per item. A single monitor
 * is far too small to justify a retrieval slot, and "what's your setup?" wants
 * the whole category anyway.
 */
function gearEntries(): CorpusEntry[] {
  const categories = new Map<string, typeof GEAR>()

  for (const item of GEAR) {
    const bucket = categories.get(item.category) ?? []
    bucket.push(item)
    categories.set(item.category, bucket)
  }

  return [...categories].map<CorpusEntry>(([category, items]) => ({
    id: `gear-${slugify(category)}`,
    kind: "gear",
    title: `Gear: ${category}`,
    url: "/#gear",
    keywords: [
      category,
      ...items.map((item) => item.name),
      "gear",
      "setup",
      "everyday carry",
      "hardware",
      "desk",
    ],
    text: items
      .map(
        (item) =>
          `- ${item.name} — ${item.description}${item.link ? ` (${item.link})` : ""}`
      )
      .join("\n"),
    question: `What ${category.toLowerCase()} do you use?`,
    followUps: ["What else is in your setup?"],
  }))
}

/**
 * Blog posts split at `##` boundaries.
 *
 * A post body is the one thing on this site that exceeds what a tool result can
 * carry — `the-long-way-to-magna-cum-laude.mdx` alone is ~6.4k tokens against
 * an 800-token cap. Splitting by heading keeps each slice self-describing (post
 * title plus section heading) and independently retrievable, so a question
 * about one part of a post does not have to drag the rest in with it.
 *
 * Sections still over the cap are split again on paragraph boundaries, so the
 * build cannot be broken by prose that happens to run long under one heading.
 */
async function writingEntries(): Promise<CorpusEntry[]> {
  const posts = getBlogPosts()
  const entries: CorpusEntry[] = []

  for (const post of posts) {
    const body = await renderDocBody(post)
    const sections = splitByHeading(body)

    sections.forEach((section, sectionIndex) => {
      const chunks = splitToBudget(section.body, MAX_TOOL_RESULT_TOKENS - 120)

      chunks.forEach((chunk, chunkIndex) => {
        const suffix = [
          sections.length > 1 ? `-${sectionIndex}` : "",
          chunks.length > 1 ? `-${chunkIndex + 1}` : "",
        ].join("")

        const partOf =
          chunks.length > 1 ? ` (part ${chunkIndex + 1} of ${chunks.length})` : ""

        entries.push({
          id: `writing-${post.slug}${suffix}`,
          kind: "writing",
          title: section.heading
            ? `${post.metadata.title} — ${section.heading}${partOf}`
            : `${post.metadata.title}${partOf}`,
          url: `/blog/${post.slug}`,
          keywords: [
            post.metadata.title,
            post.slug,
            post.metadata.topic ?? "",
            section.heading ?? "",
            "blog",
            "post",
            "wrote",
            "writing",
            "article",
          ].filter(Boolean),
          text: `From the post "${post.metadata.title}" (published ${post.metadata.createdAt}).
${section.heading ? `Section: ${section.heading}\n` : ""}
${chunk}`,
          question: `What's "${post.metadata.title}" about?`,
          followUps: [`What's the takeaway from "${post.metadata.title}"?`],
        })
      })
    })
  }

  return entries
}

/** Splits on `##`+ headings, keeping the heading text alongside its body. */
function splitByHeading(body: string) {
  const lines = body.split("\n")
  const sections: { heading?: string; body: string }[] = []
  let heading: string | undefined
  let buffer: string[] = []

  const flush = () => {
    const text = buffer.join("\n").trim()
    if (text) sections.push({ heading, body: text })
    buffer = []
  }

  for (const line of lines) {
    const match = /^#{2,4}\s+(.*)$/.exec(line)
    if (match) {
      flush()
      heading = match[1].trim()
      continue
    }
    buffer.push(line)
  }

  flush()

  return sections.length > 0 ? sections : [{ heading: undefined, body }]
}

/** Greedy paragraph packing, so no chunk exceeds `budget` estimated tokens. */
function splitToBudget(text: string, budget: number) {
  const paragraphs = text.split(/\n{2,}/)
  const chunks: string[] = []
  let current: string[] = []

  const size = () => estimateTokens(current.join("\n\n"))

  for (const paragraph of paragraphs) {
    if (current.length > 0 && size() + estimateTokens(paragraph) > budget) {
      chunks.push(current.join("\n\n"))
      current = []
    }
    current.push(paragraph)
  }

  if (current.length > 0) chunks.push(current.join("\n\n"))

  return chunks
}

async function buildCorpus(): Promise<CorpusEntry[]> {
  const entries = [
    ...aboutEntries(),
    ...experienceEntries(),
    ...projectEntries(),
    ...educationEntries(),
    ...awardEntries(),
    ...certificationEntries(),
    ...testimonialEntries(),
    ...gearEntries(),
    ...(await writingEntries()),
  ]

  return addCrossReferences(entries)
}

/** Follow-ups offered per entry, before the route trims to `MAX_SUGGESTIONS`. */
const CROSS_REFERENCES_PER_ENTRY = 3

/**
 * Kinds that answer a navigational question rather than a topical one. "Who are
 * you?" is a fine place to start and never a useful thing to ask *next* after a
 * specific role, but the bio shares enough keywords with everything to keep
 * surfacing there.
 */
const NOT_CROSS_REFERENCED = new Set<CorpusEntry["kind"]>(["about"])

/**
 * A keyword on more than this share of the corpus carries no relatedness signal.
 * "work", "role", "project" and "AI" are on almost everything here.
 */
const GENERIC_KEYWORD_SHARE = 0.25

/**
 * Appends the questions of the most closely related entries to each entry's
 * follow-ups.
 *
 * Without this the chips restate rather than advance. A follow-up derived only
 * from the entry just described tends to re-ask the question that retrieved it —
 * "What did you build at Aeva?" offered immediately after answering exactly
 * that. Pointing sideways is what makes them useful: after the Aeva role, the
 * testimonial from Aeva's CTO and the projects sharing its stack.
 *
 * Relatedness is keyword overlap, weighted so a shared *distinctive* keyword
 * (a company name, a framework) counts and a shared generic one ("work",
 * "project") does not. Same idea as the search scorer's IDF, on a smaller scale.
 */
function addCrossReferences(entries: CorpusEntry[]): CorpusEntry[] {
  const frequency = new Map<string, number>()

  const normalized = entries.map((entry) => {
    const keywords = new Set(
      entry.keywords.map((keyword) => keyword.toLowerCase()).filter(Boolean)
    )
    for (const keyword of keywords) {
      frequency.set(keyword, (frequency.get(keyword) ?? 0) + 1)
    }
    return keywords
  })

  const genericAbove = entries.length * GENERIC_KEYWORD_SHARE

  return entries.map((entry, index) => {
    const own = normalized[index]

    const related = entries
      .map((candidate, candidateIndex) => {
        if (candidateIndex === index) return null
        if (NOT_CROSS_REFERENCED.has(candidate.kind)) return null

        let score = 0
        for (const keyword of normalized[candidateIndex]) {
          if (!own.has(keyword)) continue

          const shared = frequency.get(keyword) ?? 1
          if (shared > genericAbove) continue

          score += 1 / shared
        }

        return score > 0 ? { candidate, candidateIndex, score } : null
      })
      .filter((hit): hit is NonNullable<typeof hit> => hit !== null)
      .sort((a, b) => b.score - a.score || a.candidateIndex - b.candidateIndex)
      .slice(0, CROSS_REFERENCES_PER_ENTRY)
      .map((hit) => hit.candidate.question)

    return {
      ...entry,
      followUps: [...new Set([...entry.followUps, ...related])],
    }
  })
}

/* -------------------------------------------------------------------------- *
 * Tier one: the index
 * -------------------------------------------------------------------------- */

/**
 * What exists, and the id to fetch it by. Nothing more.
 *
 * The temptation is to let a description or a bullet slip in "because it's
 * short". Every one of those is billed on every request forever, and together
 * they are what pushed the previous design past the ceiling. Depth belongs in
 * tier two.
 */
function buildIndex(entries: CorpusEntry[]) {
  const byId = (id: string) => entries.find((entry) => entry.id === id)

  const experience = EXPERIENCES.map((company) => {
    const positions = company.positions
      .map(
        (position) =>
          `  - ${position.title} (${period(position.employmentPeriod.start, position.employmentPeriod.end)}) [experience-${company.id}-${position.id}]`
      )
      .join("\n")

    return `- ${company.companyName}${company.isCurrentEmployer ? " (current)" : ""}\n${positions}`
  }).join("\n")

  const projects = PROJECTS.map(
    (project) =>
      `- ${project.title} (${period(project.period.start, project.period.end)}) [project-${project.id}]`
  ).join("\n")

  const education = EDUCATION.map(
    (entry) =>
      `- ${entry.school}${entry.degree ? `, ${entry.degree}` : ""} (${period(entry.period.start, entry.period.end)}) [education-${entry.id}]`
  ).join("\n")

  const awards = AWARDS.map(
    (award) =>
      `- ${award.prize} — ${award.title}, ${award.date} [award-${slugify(award.title)}]`
  ).join("\n")

  const certifications = CERTIFICATIONS.map(
    (certification) =>
      `- ${certification.title} (${certification.issuer}) [certification-${slugify(certification.title)}]`
  ).join("\n")

  const testimonials = [...TESTIMONIALS_1, ...TESTIMONIALS_2]
    .map(
      (testimonial) =>
        `- ${testimonial.authorName}, ${testimonial.authorTagline} [testimonial-${slugify(testimonial.authorName)}]`
    )
    .join("\n")

  const gear = entries
    .filter((entry) => entry.kind === "gear")
    .map((entry) => `- ${entry.title.replace(/^Gear: /, "")} [${entry.id}]`)
    .join("\n")

  /**
   * Section ids are deliberately *not* enumerated here. The long post alone has
   * enough of them to cost more than the rest of the index put together, and
   * listing them invites the model to guess which section answers a question
   * instead of running a query that knows.
   */
  const writing = getBlogPosts()
    .map((post) => {
      const sections = entries.filter(
        (entry) =>
          entry.kind === "writing" &&
          (entry.id === `writing-${post.slug}` ||
            entry.id.startsWith(`writing-${post.slug}-`))
      ).length

      return `- "${post.metadata.title}" (${post.metadata.createdAt}) — /blog/${post.slug}, ${sections} sections`
    })
    .join("\n")

  return `# Index of ${USER.displayName}'s site

This lists what exists and the id to retrieve it by. It is an index, not the
content: call the \`lookup\` tool with the ids in square brackets, or with a
query, before making any specific claim.

## Who

${USER.displayName} (${USER.username}), ${USER.jobTitle}, based in ${USER.address}.
${USER.bio}
Full background at /#hello — id ${byId("about-dan")?.id}. Profiles and contact — id ${byId("about-profiles")?.id}.

## Experience — page /experience, anchors /experience#position-<id>

${experience}

## Projects — page /projects, anchors /projects#project-<id>

${projects}

## Education — page /#education

${education}

## Awards — page /#awards

${awards}

## Certifications — page /#certs

${certifications}

## Testimonials — page /testimonials

${testimonials}

## Gear — page /#gear

${gear}

## Writing — page /blog

Post bodies are retrievable in full, split into sections. Reach them with a
query rather than an id; section ids are not listed here.

${writing}
`
}

/* -------------------------------------------------------------------------- *
 * Client-side lists
 * -------------------------------------------------------------------------- */

/**
 * Every route the bot is allowed to link to.
 *
 * The system prompt tells the model to use only the paths written in the index,
 * but a prompt is a request, not a guarantee — and an invented slug would
 * render as a perfectly clickable link to a 404. The client checks hrefs
 * against this list and demotes anything unrecognised to plain text.
 *
 * Only pathnames are listed. Fragments and query strings are checked against
 * the pathname they hang off, which covers the homepage anchors (`/#gear`), the
 * per-entry anchors on /experience and /projects, and the `?hl=` highlight
 * parameter without enumerating every id.
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

/**
 * Opening suggestions, derived from real content rather than written down.
 *
 * A hardcoded list goes stale the moment a role or a post lands. These are the
 * corpus entries' own `question` values, so they follow the site by
 * construction — and every one of them is guaranteed answerable, because the
 * entry that answers it is what produced the question. The client samples a few
 * per mount so two visits do not look identical.
 *
 * One per kind, newest first within each, so the menu spans the site rather than
 * offering four variations on the current job.
 */
function suggestedOpeners(entries: CorpusEntry[]) {
  /**
   * These render as chips in a 24rem panel, so a question naming
   * "University of Southern Philippines Foundation" wraps to three lines and
   * crowds out the rest. Entries whose question is too long simply do not open
   * the menu; they are still reachable by asking, and still offered as
   * cross-references where the specificity earns its length.
   */
  const CHIP_LENGTH_LIMIT = 52

  const byKind = new Map<CorpusEntry["kind"], string>()

  for (const entry of entries) {
    // Skip the bio: the page the visitor is already looking at answers it.
    if (entry.kind === "about") continue
    if (entry.question.length > CHIP_LENGTH_LIMIT) continue
    if (!byKind.has(entry.kind)) byKind.set(entry.kind, entry.question)
  }

  return [
    ...byKind.values(),
    /** Three the corpus cannot phrase for itself. */
    "How was this site made?",
    "Are you open to work?",
    "What have you built with AI?",
  ]
}

/* -------------------------------------------------------------------------- *
 * Emit
 * -------------------------------------------------------------------------- */

function reviewableMarkdown(index: string, entries: CorpusEntry[]) {
  const body = entries
    .map(
      (entry) =>
        `### ${entry.id}

- Kind: ${entry.kind}
- Title: ${entry.title}
- URL: ${entry.url}
- Tokens: ~${estimateTokens(entry.text)}
- Keywords: ${entry.keywords.join(", ")}
- Follow-ups: ${entry.followUps.join(" / ")}

${entry.text}`
    )
    .join("\n\n")

  return `<!-- Generated by src/scripts/build-chat-corpus.mts. Do not edit. -->

${index}
---

# Corpus (${entries.length} entries, fetched on demand)

${body}
`
}

/** Per-section costs, so a budget failure says which section to look at. */
function reportIndexSections(index: string) {
  return index
    .split(/^## /m)
    .slice(1)
    .map((section) => {
      const [heading] = section.split("\n")
      return { heading, tokens: estimateTokens(section) }
    })
    .sort((a, b) => b.tokens - a.tokens)
}

function assertUniqueIds(entries: CorpusEntry[]) {
  const seen = new Set<string>()

  for (const entry of entries) {
    if (seen.has(entry.id)) {
      throw new Error(
        `Duplicate corpus entry id "${entry.id}". Ids are how the model fetches an entry, so a collision makes one of them unreachable.`
      )
    }
    seen.add(entry.id)
  }
}

async function main() {
  const entries = await buildCorpus()
  assertUniqueIds(entries)

  const index = buildIndex(entries)
  const indexTokens = estimateTokens(index)
  const corpusTokens = entries.reduce(
    (total, entry) => total + estimateTokens(entry.text),
    0
  )

  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  const header = `// Generated by src/scripts/build-chat-corpus.mts. Do not edit.\n`

  fs.writeFileSync(
    path.join(OUTPUT_DIR, "chat-index.ts"),
    header +
      `export const SITE_INDEX = ${JSON.stringify(index)}\n\n` +
      `export const SITE_INDEX_ESTIMATED_TOKENS = ${indexTokens}\n`,
    "utf-8"
  )

  fs.writeFileSync(
    path.join(OUTPUT_DIR, "chat-corpus.ts"),
    header +
      `import type { CorpusEntry } from "@/features/chat/types/corpus"\n\n` +
      `export const CORPUS_ENTRIES: readonly CorpusEntry[] = ${JSON.stringify(entries, null, 2)}\n`,
    "utf-8"
  )

  fs.writeFileSync(
    path.join(OUTPUT_DIR, "chat-client.ts"),
    header +
      `export const LINKABLE_PATHS: readonly string[] = ${JSON.stringify(linkablePaths())}\n\n` +
      `export const SUGGESTED_OPENERS: readonly string[] = ${JSON.stringify(suggestedOpeners(entries), null, 2)}\n`,
    "utf-8"
  )

  fs.writeFileSync(
    path.join(OUTPUT_DIR, "chat-corpus.md"),
    reviewableMarkdown(index, entries),
    "utf-8"
  )

  console.log(
    `[chat-corpus] index ~${indexTokens.toLocaleString()} tokens (budget ${INDEX_TOKEN_BUDGET.toLocaleString()}), ` +
      `corpus ${entries.length} entries / ~${corpusTokens.toLocaleString()} tokens`
  )

  let failed = false

  if (indexTokens > INDEX_TOKEN_BUDGET) {
    for (const { heading, tokens } of reportIndexSections(index)) {
      console.error(
        `[chat-corpus]   ${heading.padEnd(20)} ~${tokens.toLocaleString()} tokens`
      )
    }
    console.error(
      `[chat-corpus] Index over budget by ~${(indexTokens - INDEX_TOKEN_BUDGET).toLocaleString()} tokens. ` +
        `The index is resent on every request and counts against Groq's 8,000 tokens-per-minute ceiling. ` +
        `Move detail out of the largest section above into a corpus entry rather than raising INDEX_TOKEN_BUDGET.`
    )
    failed = true
  }

  const oversized = entries.filter(
    (entry) => estimateTokens(entry.text) > MAX_TOOL_RESULT_TOKENS
  )

  for (const entry of oversized) {
    console.error(
      `[chat-corpus] Entry "${entry.id}" is ~${estimateTokens(entry.text).toLocaleString()} tokens, ` +
        `over the ${MAX_TOOL_RESULT_TOKENS.toLocaleString()}-token cap on a single tool result. ` +
        `It can never be served whole — split it, or shorten the source.`
    )
    failed = true
  }

  if (failed) process.exit(1)
}

await main()
