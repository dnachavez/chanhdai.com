import fs from "fs"
import path from "path"
import { cache } from "react"
import matter from "gray-matter"

import type { Doc, DocMetadata } from "@/features/doc/types/document"

function parseFrontmatter(fileContent: string) {
  const file = matter(fileContent)

  return {
    metadata: file.data as DocMetadata,
    content: file.content,
  }
}

/**
 * Collects `.mdx` files under `dir`, recursing into nested folders. Returns
 * paths relative to `dir` so callers can derive the topic folder from them.
 */
function getMDXFiles(dir: string): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      if (entry.isDirectory()) {
        return getMDXFiles(path.join(dir, entry.name)).map((nested) =>
          path.join(entry.name, nested)
        )
      }

      return path.extname(entry.name) === ".mdx" ? [entry.name] : []
    })
    .sort()
}

function readMDXFile(filePath: string) {
  const rawContent = fs.readFileSync(filePath, "utf-8")
  return parseFrontmatter(rawContent)
}

/**
 * Reads MDX docs from `dir`, grouping them by their immediate subfolder.
 * The subfolder name is the doc's category (e.g. `content/components/*.mdx`
 * yields docs with `category: "components"`), so category is derived from the
 * file location rather than declared in frontmatter. Files placed directly in
 * `dir` (e.g. shared `props.ts`) are ignored — only category folders are read.
 *
 * Folders nested inside a category are read too, and their name becomes the
 * doc's `topic` (`content/blog/voice-ai/*.mdx` → category "blog", topic
 * "voice-ai"). This lets topic clusters be organised on disk without changing
 * the category or the URL, which stays `/blog/[slug]`.
 */
function getMDXData(dir: string) {
  const categoryDirs = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())

  const docs = categoryDirs.flatMap((categoryDir) => {
    const category = categoryDir.name
    const categoryPath = path.join(dir, category)

    return getMDXFiles(categoryPath).map<Doc>((relativePath) => {
      const { metadata, content } = readMDXFile(
        path.join(categoryPath, relativePath)
      )

      const slug = path.basename(relativePath, path.extname(relativePath))
      const topicDir = path.dirname(relativePath)
      const topic = topicDir === "." ? undefined : topicDir.split(path.sep)[0]

      return {
        metadata: { ...metadata, category, topic },
        slug,
        content,
      }
    })
  })

  assertUniqueSlugs(docs)

  return docs
}

/**
 * Slugs are the whole URL (`/blog/[slug]`), so two files with the same basename
 * in different topic folders would collide and one would become unreachable.
 * Fail the build loudly rather than silently serving whichever was read first.
 */
function assertUniqueSlugs(docs: Doc[]) {
  const seen = new Map<string, string>()

  for (const doc of docs) {
    const location = [doc.metadata.category, doc.metadata.topic, doc.slug]
      .filter(Boolean)
      .join("/")
    const previous = seen.get(doc.slug)

    if (previous) {
      throw new Error(
        `Duplicate doc slug "${doc.slug}": "${previous}" and "${location}" would both resolve to the same URL. Rename one of the files.`
      )
    }

    seen.set(doc.slug, location)
  }
}

export const getAllDocs = cache(() => {
  return getMDXData(path.join(process.cwd(), "src/features/doc/content")).sort(
    (a, b) => {
      if (a.metadata.pinned && !b.metadata.pinned) return -1
      if (!a.metadata.pinned && b.metadata.pinned) return 1

      return (
        new Date(b.metadata.createdAt).getTime() -
        new Date(a.metadata.createdAt).getTime()
      )
    }
  )
})

export function getDocBySlug(slug: string) {
  return getAllDocs().find((doc) => doc.slug === slug)
}

export function getDocsByCategory(category: string) {
  return getAllDocs().filter((doc) => doc.metadata?.category === category)
}

/** Categories derived from the doc's content subfolder. */
export const BLOG_CATEGORY = "blog"
export const COMPONENTS_CATEGORY = "components"

/** Blog posts — docs under the `blog/` content folder. */
export function getBlogPosts() {
  return getDocsByCategory(BLOG_CATEGORY)
}

/** Component docs — docs under the `components/` content folder. */
export function getComponentDocs() {
  return getDocsByCategory(COMPONENTS_CATEGORY)
}

export function findNeighbour(docs: Doc[], slug: string) {
  const len = docs.length

  for (let i = 0; i < len; ++i) {
    if (docs[i].slug === slug) {
      return {
        previous: i > 0 ? docs[i - 1] : null,
        next: i < len - 1 ? docs[i + 1] : null,
      }
    }
  }

  return { previous: null, next: null }
}
