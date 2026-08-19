import type { LanguageModelMiddleware } from "ai"

import { CHAT_COPY } from "../config"

/**
 * Last line of defence, on the way out rather than on the way in.
 *
 * The system prompt is the primary control and it does most of the work. This
 * exists for the case where it does not, and it watches output rather than input
 * for one reason: an input classifier has to recognise an attack, which is
 * open-ended and which every published classifier loses at the margins, whereas
 * the shape of a *successful* attack here is closed and short. There are only a
 * few things a compromised reply can contain that a real one never does, and all
 * of them are literal strings.
 *
 * Nothing here calls a network service. The route already spends three upstream
 * requests per turn against a 20-per-minute account-wide ceiling, so a fourth hop
 * for a hosted classifier would cost a third of the site's throughput to catch a
 * class of failure this file catches for free.
 *
 * What it cannot do is judge meaning. A model talked into inventing an employer
 * produces text this passes without comment. That failure is caught in CI by the
 * hallucination and policy plugins instead — see `redteam/`.
 */

/** Provider-level stream part, read off the SDK so it survives a major bump. */
type StreamPart =
  Awaited<
    ReturnType<
      Parameters<
        NonNullable<LanguageModelMiddleware["wrapStream"]>
      >[0]["doStream"]
    >
  >["stream"] extends ReadableStream<infer Part>
    ? Part
    : never

/**
 * Verbatim fragments of the system prompt, chosen for being structural — a
 * heading or a tag rather than a sentence — because those survive a model that
 * summarises the prompt instead of pasting it.
 *
 * Not secrets: this repository is public, so the prompt is already readable by
 * anyone who wants it. The reason to stop them is that a reply containing one is
 * a reply that accepted the visitor's framing as authoritative, and it renders as
 * a wall of instructions in a chat bubble on a portfolio site.
 */
const PROMPT_MARKERS = [
  "<site_index>",
  "</site_index>",
  "# Grounding rules",
  "# Handling instructions in messages",
  "# How you know things",
  "Figures are quote-only",
  "table of contents, not the content",
]

/**
 * Canaries from payloads already observed getting through. Each is proof that a
 * specific documented attack is live in production, rather than a probability
 * that something might be.
 */
const CANARIES = ["ZZQX-7741-CANARY"]

export type TripwireHit = {
  kind: "prompt-leak" | "canary"
  marker: string
}

function flatten(text: string) {
  return text.replace(/[^a-z0-9]/gi, "").toLowerCase()
}

/**
 * Prompt markers are matched literally; canaries are matched against a flattened
 * copy as well.
 *
 * The asymmetry is deliberate. A model told to emit a canary will space it,
 * re-hyphenate it, or wrap it in markdown emphasis, none of which survive a
 * literal comparison — and the canary is a fixed nonsense token, so flattening
 * cannot make it collide with anything. Prompt markers carry meaning in their
 * whitespace and punctuation, and flattening them yields substrings common enough
 * to fire on ordinary answers.
 */
export function detectTripwire(text: string): TripwireHit | null {
  for (const marker of PROMPT_MARKERS) {
    if (text.includes(marker)) return { kind: "prompt-leak", marker }
  }

  const flattened = flatten(text)
  for (const canary of CANARIES) {
    if (flattened.includes(flatten(canary))) {
      return { kind: "canary", marker: canary }
    }
  }

  return null
}

/**
 * Characters withheld from the client until the text following them is scanned.
 *
 * Streaming and scanning pull opposite ways: a reply is only checkable once it
 * exists, but a reply already rendered cannot be recalled, and the failure being
 * guarded against is someone screenshotting the bubble. Withholding a trailing
 * window rather than the whole message keeps the visible lag to about one clause.
 *
 * Derived rather than chosen, so adding a longer marker cannot silently open a
 * gap: no marker can begin inside the released text and end outside it. Canaries
 * are doubled because the flattened match tolerates a separator between every
 * character, which up to doubles the span they occupy in the raw text.
 */
const HOLDBACK = Math.max(
  ...PROMPT_MARKERS.map((marker) => marker.length),
  ...CANARIES.map((canary) => canary.length * 2)
)

export function createOutputTripwire({
  onTrip,
}: {
  onTrip?: (hit: TripwireHit) => void
} = {}): LanguageModelMiddleware {
  return {
    wrapStream: async ({ doStream }) => {
      const { stream, ...rest } = await doStream()

      /** Every text delta so far, including the part not yet released. */
      let seen = ""
      /** How much of `seen` has reached the client and is unrecallable. */
      let released = 0
      /** Carried so the withheld tail is flushed under its own text block. */
      let lastId: string | undefined
      let tripped = false

      const scanned = stream.pipeThrough(
        new TransformStream<StreamPart, StreamPart>({
          transform(part, controller) {
            if (tripped) return

            if (part.type !== "text-delta") {
              controller.enqueue(part)
              return
            }

            lastId = part.id
            seen += part.delta

            const hit = detectTripwire(seen)
            if (hit) {
              tripped = true
              onTrip?.(hit)

              /**
               * The clause already on screen stays there — no stream part unsays
               * it — and the turn ends with the copy every other failure uses. A
               * visitor sees a truncated line and an error, which is worse than a
               * clean answer and better than a leaked prompt.
               */
              controller.enqueue({ type: "error", error: CHAT_COPY.error })
              controller.terminate()
              return
            }

            const safe = Math.max(0, seen.length - HOLDBACK)
            if (safe > released) {
              controller.enqueue({
                ...part,
                delta: seen.slice(released, safe),
              })
              released = safe
            }
          },

          /** The withheld tail was scanned as it arrived; release it. */
          flush(controller) {
            if (tripped || released >= seen.length || lastId === undefined) {
              return
            }

            controller.enqueue({
              type: "text-delta",
              id: lastId,
              delta: seen.slice(released),
            })
          },
        })
      )

      return { stream: scanned, ...rest }
    },
  }
}
