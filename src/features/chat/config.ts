import { decodeEmail } from "@/utils/string"

import { USER } from "@/features/portfolio/data/user"

export const CHAT_MODEL = "openai/gpt-oss-120b"

/**
 * Read from the same encoded value the Overview panel reveals, so the address
 * the bot hands out and the address the page shows can never drift apart.
 */
export const CONTACT_EMAIL = decodeEmail(USER.emailB64)

/**
 * Turns kept in the conversation, counting both sides. The bundle is resent
 * every turn, so history is the only part of the request that grows — and on a
 * free tier where the whole request is charged against an 8,000 tokens-per-
 * minute ceiling, growth directly reduces how many questions fit in a minute.
 */
export const MAX_HISTORY_MESSAGES = 6

/**
 * Caps the reply's share of the per-minute token ceiling. Long enough for the
 * two-to-four sentence answers the system prompt asks for, short enough that
 * one verbose reply cannot eat the budget for the next question.
 */
export const MAX_OUTPUT_TOKENS = 600

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

/**
 * One per audience: hiring, client work, craft, availability. Phrased as a
 * visitor would type them rather than as menu labels.
 */
export const STARTER_QUESTIONS = [
  "What are you working on right now?",
  "What have you built with AI?",
  "How was this site made?",
  "Are you open to work?",
] as const

export const CHAT_COPY = {
  title: "Ask me anything",
  subtitle: "Answers come from what's published on this site.",
  placeholder: "Ask about my work…",
  empty: "No messages yet.",
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
