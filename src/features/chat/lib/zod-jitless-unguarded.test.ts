import { afterEach, describe, expect, it } from "vitest"

import { denyFunctionConstructor, restoreFunctionConstructor } from "./test-csp"

/**
 * The negative half of `zod-jitless.test.ts`: proof that the side-effect import
 * in `chat-provider.tsx` is doing something.
 *
 * Alone in its file, and deliberately never importing `./zod-jitless`, because
 * both facts are per-worker and once either the SDK or the setting is loaded it
 * stays loaded. If this ever fails, the AI SDK has stopped building schemas
 * while its module body runs — at which point the import, its comment about
 * position, and this pair of files can all go.
 */

afterEach(restoreFunctionConstructor)

describe("zod-jitless, unguarded", () => {
  it("shows @ai-sdk/react probing for the Function constructor on its own", async () => {
    const attempts = denyFunctionConstructor()
    await import("@ai-sdk/react")

    expect(attempts.length).toBeGreaterThan(0)
  })
})
