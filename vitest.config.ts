import path from "path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    /**
     * `redteam/` is included because target.mjs hand-writes the request shape
     * /api/chat accepts and the stream format it answers with. Neither contract
     * is checked by the type system or by promptfoo, and both have broken CI.
     */
    include: ["src/**/*.test.ts", "redteam/**/*.test.mjs"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
})
