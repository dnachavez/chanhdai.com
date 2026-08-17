import { decodeEmail } from "@/utils/string"

import { USER } from "@/features/portfolio/data/user"

export const CHAT_MODEL = "openai/gpt-oss-120b"

/**
 * Read from the same encoded value the Overview panel reveals, so the address
 * the bot hands out and the address the page shows can never drift apart.
 */
export const CONTACT_EMAIL = decodeEmail(USER.emailB64)

/* -------------------------------------------------------------------------- *
 * Token ceiling
 *
 * Every number in this block is derived from one constraint: on Groq's free
 * tier `openai/gpt-oss-120b` allows 8,000 tokens per minute counting input and
 * output together (plus 30 requests/minute and 1,000/day). The model's own
 * context window is 131k and irrelevant here.
 *
 * Two failures hang off that ceiling and only one is fatal:
 *
 * - A single request over 8,000 tokens fails with a 413 every time, for
 *   everyone, forever. No retry helps.
 * - More than roughly one *turn* per minute gets a retryable 429, handled by
 *   the per-IP limiter and the "give it a minute" copy.
 *
 * Retrieval is a tool rather than a stuffed bundle because of this. The whole
 * corpus is ~13k tokens, so sending it whole is a guaranteed 413; sending a
 * ~1.1k index and letting the model fetch what the question needs keeps every
 * individual call at roughly half the ceiling. Measured against these values:
 *
 *   question                            call 1        call 2        turn
 *   ----------------------------------------------------------------------
 *   "What did you build at Aeva?"       3023 / 39     3375 / 110    6,547
 *   "What's <the long post> about?"     3025 / 49     3784 / 136    6,994
 *   "What's your GPA?"                  3018 / 31     3838 / 48     6,935
 *   "Hey there" (no lookup)             3016 / 27     —             3,043
 *
 * The number that matters for the fatal failure is the largest single call —
 * 3,920 at worst, less than half of 8,000, so a 413 is structurally impossible.
 * The turn totals are what bound throughput to about one question per minute,
 * which the per-IP limiter and the "give it a minute" copy already handle.
 *
 * The `Developer:` comment on each line is the value to use after upgrading to
 * Groq's pay-as-you-go plan ($0.15/M in, $0.60/M out — about $0.002 a turn at
 * full depth). Upgrading is this block and nothing else.
 * -------------------------------------------------------------------------- */

/**
 * Model calls per turn, counting the answer. Two allows exactly one round of
 * retrieval, which covers nearly every question; a third would re-bill the
 * index and push a turn over the ceiling.
 */
export const MAX_STEPS = 2 // Developer: 4

/**
 * Ceiling on a single `lookup` result, summed across the entries it returns.
 * Also the per-entry cap the build asserts, since an entry larger than this
 * could never be served whole.
 */
export const MAX_TOOL_RESULT_TOKENS = 800 // Developer: 4_000

/**
 * Turns kept from the conversation, counting both sides. History is the only
 * part of the payload that grows without bound, and the oldest turns are the
 * least useful per token.
 */
export const MAX_HISTORY_MESSAGES = 4 // Developer: 12

/**
 * Caps the reply's share of the ceiling. Long enough for the two-to-four
 * sentence answers the system prompt asks for, short enough that one verbose
 * reply cannot eat the budget for the next question.
 */
export const MAX_OUTPUT_TOKENS = 600 // Developer: 1_000

/**
 * Low effort is a latency and budget decision. With retrieval in place the
 * task is extraction and rephrasing from material now guaranteed to be in
 * context, not derivation.
 */
export const REASONING_EFFORT = "low" as const // Developer: "medium"

/**
 * Hard cap on the always-in-context index, asserted by the build.
 *
 * Unlike the numbers above this one does not move on the Developer plan. A
 * small always-in-context tier is a quality decision as much as a cost one:
 * padding it back out to the whole corpus is what degraded answers into
 * confident recombination in the first place.
 */
export const INDEX_TOKEN_BUDGET = 1_100

/** Entries one `lookup` may return, before the token cap trims further. */
export const MAX_LOOKUP_RESULTS = 4

/**
 * Assistant replies allowed per conversation. Client-supplied and therefore
 * trivially reset by anyone who cares to; it exists to bound honest use, not to
 * stop abuse. The per-IP limit is the actual control.
 */
export const MAX_TURNS_PER_SESSION = 10

export const RATE_LIMIT = {
  requests: 20,
  windowMs: 60 * 60 * 1000,
} as const

/** Longer than any real question, short enough to bound a prompt-stuffing attempt. */
export const MAX_MESSAGE_LENGTH = 1_000

/** Follow-up chips offered after a turn, and openers offered before one. */
export const MAX_SUGGESTIONS = 3
export const MAX_OPENERS = 4

export const CHAT_COPY = {
  title: "Ask me anything",
  subtitle: "Answers come from what's published on this site.",
  placeholder: "Ask about my work…",
  error: `Something broke. Email me: ${CONTACT_EMAIL}`,
  /**
   * Distinct from `error`: the upstream per-minute ceiling is a wait, not a
   * fault, and telling someone to email instead of retrying loses a visitor who
   * would have got an answer sixty seconds later.
   */
  busy: `Too many questions at once — give it a minute. Or email me: ${CONTACT_EMAIL}`,
  rateLimited: `That's the limit for now. Email me: ${CONTACT_EMAIL}`,
  sessionEnded: `That's the limit for this conversation. Email me: ${CONTACT_EMAIL}`,
  unavailable: `Chat is off right now. Email me: ${CONTACT_EMAIL}`,
} as const
