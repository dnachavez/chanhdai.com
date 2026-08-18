import { tool } from "ai"
import { z } from "zod"

import { CORPUS_ENTRIES } from "@/generated/chat-corpus"

import {
  MAX_READ_ENTRIES,
  MAX_SEARCH_HITS,
  MAX_TOOL_RESULT_TOKENS,
} from "../config"
import type { CorpusEntry } from "../types/corpus"
import { searchCorpus } from "./search-corpus"

/**
 * Two tools, deliberately: `search` finds, `read` fetches.
 *
 * The earlier version fused them into one call to save a model round trip
 * against a per-minute token ceiling. It worked, but it made the assistant guess:
 * handed an index of every id, it would jump straight to reading whichever
 * entry the title suggested, and a question whose wording did not match a title
 * went to the wrong entry with no signal that it had. Searching first turns that
 * guess into evidence — it sees what matched and how well before spending the
 * result budget on any of it.
 *
 * The third call is paid for by a much smaller index: once the model can search,
 * the prompt no longer has to enumerate every id on every request. It is still
 * the most expensive thing here — see the request budget in `config.ts`.
 */

/** Matches the build script's estimator, which set the per-entry cap. */
function estimateTokens(text: string) {
  return Math.ceil(text.length / 4)
}

export type SearchHit = {
  id: string
  title: string
  kind: CorpusEntry["kind"]
  /** First line of the entry, enough to judge relevance without reading it. */
  preview: string
}

export type SearchResult = { hits: SearchHit[] }

export type ReadEntry = {
  id: string
  title: string
  url: string
  text: string
}

export type ReadResult = {
  entries: ReadEntry[]
  /** True when entries were dropped to stay inside the token cap. */
  truncated: boolean
  /** Ids that matched nothing, so a guessed id is visible rather than silent. */
  notFound?: string[]
}

/**
 * Enough of an entry to decide whether to read it, and no more.
 *
 * A search result carrying full text would be the fused tool again with extra
 * steps. Held to roughly one line so a five-hit result costs ~200 tokens.
 */
function preview(entry: CorpusEntry) {
  const firstProseLine =
    entry.text
      .split("\n")
      .map((line) => line.replace(/^[-*]\s*/, "").trim())
      .find(
        (line) => line.length > 0 && !/^[A-Z][A-Za-z ]{2,20}: /.test(line)
      ) ?? ""

  return firstProseLine.length > 120
    ? `${firstProseLine.slice(0, 117).trimEnd()}…`
    : firstProseLine
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
  const packed: ReadEntry[] = []
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

/**
 * Built per request rather than exported as singletons so `onEntries` can carry
 * which entries were read back out to the route, which turns them into follow-up
 * suggestions and link highlights. Neither ever enters the model's context: they
 * are worth showing the visitor and not worth spending the token budget on.
 */
export function createChatTools({
  onEntries,
}: {
  onEntries: (entries: CorpusEntry[]) => void
}) {
  return {
    search: tool({
      description:
        "Find which entries on this site are relevant to a question. Returns ids, titles and one-line previews — not the content. Always search before reading, and search again with different words if nothing looks right.",
      inputSchema: z.object({
        query: z
          .string()
          .min(2)
          .max(200)
          .describe(
            "Distinctive words from the visitor's question: company, project, technology or person names."
          ),
      }),
      execute: ({ query }): SearchResult => ({
        hits: searchCorpus(query, CORPUS_ENTRIES, MAX_SEARCH_HITS).map(
          ({ entry }) => ({
            id: entry.id,
            title: entry.title,
            kind: entry.kind,
            preview: preview(entry),
          })
        ),
      }),
    }),

    read: tool({
      description:
        "Retrieve the full text of entries by id. Use the ids returned by `search`. Read only what the question needs — reading everything crowds out the answer.",
      inputSchema: z.object({
        ids: z
          .array(z.string().max(120))
          .min(1)
          .max(MAX_READ_ENTRIES)
          .describe("Entry ids from a `search` result."),
      }),
      execute: ({ ids }): ReadResult => {
        const selected: CorpusEntry[] = []
        const notFound: string[] = []
        const seen = new Set<string>()

        for (const id of ids) {
          if (seen.has(id)) continue
          seen.add(id)

          const entry = CORPUS_ENTRIES.find((candidate) => candidate.id === id)
          if (entry) selected.push(entry)
          else notFound.push(id)
        }

        const { entries, truncated, read } = pack(selected)
        onEntries(read)

        return notFound.length > 0
          ? { entries, truncated, notFound }
          : { entries, truncated }
      },
    }),
  }
}
