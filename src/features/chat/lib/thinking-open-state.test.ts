import { describe, expect, it } from "vitest"

import { isThinkingOpen } from "./thinking-open-state"

const open = (pinned: boolean | null, isLive: boolean, hasAnswer: boolean) =>
  isThinkingOpen({ pinned, isLive, hasAnswer })

describe("isThinkingOpen", () => {
  it("walks a turn open, then closed the moment the answer starts", () => {
    // search and read running, nothing written yet
    expect(open(null, true, false)).toBe(true)
    // first token lands
    expect(open(null, true, true)).toBe(false)
    // turn finished
    expect(open(null, false, true)).toBe(false)
  })

  it("stays open through the whole retrieval phase", () => {
    expect(open(null, true, false)).toBe(true)
  })

  it("is closed for an earlier message in the thread", () => {
    expect(open(null, false, true)).toBe(false)
  })

  it("does not reopen a finished turn that produced no answer", () => {
    // A turn that errored after its tool calls: the record is there to reopen,
    // but nothing should spring open on its own.
    expect(open(null, false, false)).toBe(false)
  })

  it("lets a visitor who opened it read along while the answer streams", () => {
    expect(open(true, true, true)).toBe(true)
    expect(open(true, false, true)).toBe(true)
  })

  it("keeps it shut for a visitor who closed it mid-retrieval", () => {
    expect(open(false, true, false)).toBe(false)
  })
})
