import { tool } from "ai"
import { z } from "zod"

import { CORPUS_ENTRIES } from "@/generated/chat-corpus"

import { MAX_LOOKUP_RESULTS, MAX_TOOL_RESULT_TOKENS } from "../config"
import type { CorpusEntry } from "../types/corpus"
import { searchCorpus } from "./search-corpus"

/** Matches the build script's estimator, which set the per-entry cap. */
function estimateTokens(text: string) {
  return Math.ceil(text.length / 4)
}

export type LookupEntry = {
  id: string
  title: string
  url: string
  text: string
}

/** What the model sees. Deliberately nothing it does not need to answer with. */
export type LookupResult = {
  entries: LookupEntry[]
  /** True when relevant entries were dropped to stay inside the token cap. */
  truncated: boolean
}

/**
 * Packs entries into the result until the token cap is reached.
 *
 * The cap is the whole reason retrieval works on the free tier, so it is
 * enforced here rather than trusted to the model. A dropped entry is reported
 * as `truncated` so the answer can say the detail continues on the page instead
 * of inventing the remainder.
 */
function pack(entries: CorpusEntry[]) {
  const packed: LookupEntry[] = []
  const read: CorpusEntry[] = []
  let budget = MAX_TOOL_RESULT_TOKENS
  let truncated = false

  for (const entry of entries) {
    const cost = estimateTokens(entry.text) + 24 // id, title and url overhead
    if (cost > budget) {
      truncated = true
      continue
    }

    budget -= cost
    packed.push({
      id: entry.id,
      title: entry.title,
      url: entry.url,
      text: entry.text,
    })
    read.push(entry)
  }

  return { entries: packed, truncated, read }
}

function select(query: string | undefined, ids: string[] | undefined) {
  const selected: CorpusEntry[] = []
  const seen = new Set<string>()

  for (const id of ids ?? []) {
    const entry = CORPUS_ENTRIES.find((candidate) => candidate.id === id)
    if (entry && !seen.has(entry.id)) {
      seen.add(entry.id)
      selected.push(entry)
    }
  }

  /**
   * A query still runs when ids were given, so a hallucinated id degrades to a
   * search rather than to an empty result the model then fills in itself.
   */
  if (query && selected.length < MAX_LOOKUP_RESULTS) {
    const hits = searchCorpus(
      query,
      CORPUS_ENTRIES,
      MAX_LOOKUP_RESULTS + seen.size
    )

    for (const hit of hits) {
      if (seen.has(hit.entry.id)) continue
      if (selected.length >= MAX_LOOKUP_RESULTS) break
      seen.add(hit.entry.id)
      selected.push(hit.entry)
    }
  }

  return selected
}

/**
 * The site's only tool: search and read fused into one call.
 *
 * Splitting them would mean search, then read, then answer — three model calls,
 * each re-billing the site index against an 8,000 tokens-per-minute ceiling.
 * Fused, a turn is two calls: decide and fetch, then answer.
 *
 * `ids` is the precise path, for when the index already named the entry.
 * `query` is the lexical path, for when it did not — which is every question
 * about the contents of a blog post, since section ids are not in the index.
 *
 * Built per request rather than exported as a singleton so `onEntries` can carry
 * which entries were read back out to the route, which turns them into follow-up
 * suggestions. Those questions never enter the model's context: they are worth
 * showing the visitor and not worth spending the token budget on.
 */
export function createChatTools({
  onEntries,
}: {
  onEntries: (entries: CorpusEntry[]) => void
}) {
  return {
    lookup: tool({
      description:
        "Retrieve the full text of entries about Dan from this site: role descriptions and achievements, project write-ups, blog post sections, testimonials, awards, education, certifications and gear. Pass `ids` when the index already names what you need, `query` otherwise. Call this before stating any specific fact.",
      inputSchema: z.object({
        query: z
          .string()
          .max(200)
          .optional()
          .describe(
            "Keywords from the visitor's question. Include company, project or technology names."
          ),
        ids: z
          .array(z.string().max(120))
          .max(MAX_LOOKUP_RESULTS)
          .optional()
          .describe(
            "Entry ids copied from the index, in square brackets there."
          ),
      }),
      execute: ({ query, ids }): LookupResult => {
        const { entries, truncated, read } = pack(select(query, ids))
        onEntries(read)
        return { entries, truncated }
      },
    }),
  }
}
