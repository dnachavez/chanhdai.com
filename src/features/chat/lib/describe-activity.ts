import type { UIMessage } from "ai"

import type { ReadResult, SearchResult } from "./tools"

/**
 * Turns tool parts into the lines the thought-process panel shows.
 *
 * Returns an array rather than a string, which is the whole point. A tool call
 * is a single part that mutates in place through `input-streaming` →
 * `input-available` → `output-available`, so a one-line-per-part renderer shows
 * only whichever state that part is in *now*: once the search resolves, the
 * "Searching for …" line is replaced by "Found …" and the question the model
 * actually asked is gone from the record. Emitting both lines from the resolved
 * state keeps the sequence the visitor is meant to read — searched, found, read
 * — instead of only its last frame.
 *
 * Kept out of the component so that sequence can be tested without a browser or
 * a model call, which matters when every end-to-end check costs three requests
 * against a 50-a-day allowance.
 */

export type SearchPart = {
  type: "tool-search"
  state: string
  input?: { query?: string }
  output?: SearchResult
}

export type ReadPart = {
  type: "tool-read"
  state: string
  input?: { ids?: string[] }
  output?: ReadResult
}

export type ActivityPart = SearchPart | ReadPart

export function isActivityPart(
  part: UIMessage["parts"][number]
): part is ActivityPart & UIMessage["parts"][number] {
  return part.type === "tool-search" || part.type === "tool-read"
}

function list(items: string[]) {
  if (items.length <= 1) return items.join("")
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`
}

/**
 * Lines for one step, phrased as the work rather than as the tool call.
 *
 * Present tense while a step is in flight, past tense once it has resolved, so
 * the panel reads as a log of what happened rather than a list of things
 * perpetually about to happen.
 */
export function describeActivity(part: ActivityPart): string[] {
  return part.type === "tool-search" ? describeSearch(part) : describeRead(part)
}

function describeSearch(part: SearchPart): string[] {
  const query = part.input?.query
  const asked = query ? `Searched for “${query}”` : "Searched the site"

  switch (part.state) {
    case "input-streaming":
      return ["Working out what to search for…"]

    case "input-available":
      return [query ? `Searching for “${query}”…` : "Searching…"]

    case "output-available": {
      const titles = part.output?.hits.map((hit) => hit.title) ?? []
      return [
        asked,
        titles.length === 0 ? "Found nothing" : `Found ${list(titles)}`,
      ]
    }

    case "output-error":
      return [asked, "That search failed."]

    default:
      return ["Searching…"]
  }
}

function describeRead(part: ReadPart): string[] {
  switch (part.state) {
    case "input-streaming":
      return ["Deciding what to read…"]

    case "input-available": {
      const count = part.input?.ids?.length ?? 0
      return [count > 1 ? `Reading ${count} entries…` : "Reading…"]
    }

    case "output-available": {
      const titles = part.output?.entries.map((entry) => entry.title) ?? []
      const missing = part.output?.notFound?.length ?? 0

      if (titles.length === 0) {
        return [missing > 0 ? "That entry does not exist." : "Nothing to read"]
      }

      return [`Read ${list(titles)}`]
    }

    case "output-error":
      return ["That read failed."]

    default:
      return ["Reading…"]
  }
}
