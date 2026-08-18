import { readFileSync } from "node:fs"
import { afterEach, describe, expect, it } from "vitest"

import { denyFunctionConstructor, restoreFunctionConstructor } from "./test-csp"

/**
 * Guards a fix that lives entirely in import order, and so cannot be read off
 * the code that depends on it.
 *
 * `@ai-sdk/react` builds zod v4 schemas while its module body runs, and zod v4
 * probes for the Function constructor the first time it builds one. Setting
 * `jitless` after that import has already happened is too late and silently
 * does nothing — the observable difference is a CSP report on a visitor's
 * browser, which no other test here would notice.
 *
 * So this reproduces the browser's half of the contract: make the Function
 * constructor throw the way `script-src` without `'unsafe-eval'` does, then
 * check nobody reached for it.
 *
 * The matching negative — that there is something here to prevent at all —
 * lives in `zod-jitless-unguarded.test.ts`. It has to be a separate file
 * because Vitest leaves `node_modules` imports to Node's own cache, which
 * `vi.resetModules()` does not clear: once this file has imported the SDK,
 * importing it again anywhere in the same worker runs no module body and
 * probes for nothing, so the negative would pass without proving anything.
 */

afterEach(restoreFunctionConstructor)

describe("zod-jitless", () => {
  it("keeps @ai-sdk/react from reaching for the Function constructor", async () => {
    await import("./zod-jitless")

    const attempts = denyFunctionConstructor()
    const { useChat } = await import("@ai-sdk/react")

    expect(attempts).toEqual([])
    expect(typeof useChat).toBe("function")
  })

  /**
   * The two tests above pass whether or not anything actually imports this
   * module, and the import they are guarding is a bare side effect that reads
   * as deletable dead weight. So check the one caller directly, in source:
   * present, and ahead of the SDK. Ordering is the whole mechanism, and a
   * formatter, a merge or a tidy-up could reorder it without any type or lint
   * error.
   */
  it("is imported by chat-provider ahead of @ai-sdk/react", () => {
    const source = readFileSync(
      new URL("../components/chat-provider.tsx", import.meta.url),
      "utf8"
    )

    const guard = source.indexOf('import "../lib/zod-jitless"')
    const sdk = source.indexOf('from "@ai-sdk/react"')

    expect(guard).toBeGreaterThan(-1)
    expect(sdk).toBeGreaterThan(-1)
    expect(guard).toBeLessThan(sdk)
  })

  it("leaves zod able to validate without the JIT path", async () => {
    await import("./zod-jitless")

    const attempts = denyFunctionConstructor()
    const { z } = await import("zod/v4")
    const schema = z.object({ name: z.string() })

    expect(schema.parse({ name: "dan" })).toEqual({ name: "dan" })
    expect(() => schema.parse({ name: 1 })).toThrow()
    expect(attempts).toEqual([])
  })
})
