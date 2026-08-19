/**
 * Snapshots the live system prompt for `assert/no-system-prompt-leak.js`.
 *
 * Run from the same tsx entry point as the corpus build, because the prompt
 * imports the generated index and therefore needs the path aliases.
 */
import fs from "node:fs"
import path from "node:path"

import { buildSystemPrompt } from "@/features/chat/lib/system-prompt"

const out = path.join(process.cwd(), "redteam", ".system-prompt.txt")
fs.writeFileSync(out, buildSystemPrompt(), "utf8")
console.log(`Wrote ${out}`)
