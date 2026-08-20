/**
 * Records a finished scan against the commit it ran on.
 *
 * Used by the comment-triggered workflow and by a local run, so a scan done on a
 * laptop counts the same as one done in CI — which is the point. The expensive
 * thing should only have to happen once per revision, wherever it happened.
 *
 *   GITHUB_TOKEN=... PR=23 HEAD_SHA=$(git rev-parse HEAD) \
 *     node redteam/publish-evidence.mjs redteam/output.json
 */
import fs from "node:fs"

import { postEvidence, publishCheck, summarise } from "./evidence.mjs"

const {
  GITHUB_REPOSITORY: repo,
  PR: prNumber,
  HEAD_SHA: headSha,
  SUITE: suite = "single-turn",
  TARGET_MODEL: model = "unknown",
  RUN_URL: runUrl,
} = process.env

const path = process.argv[2] ?? "redteam/output.json"

if (!repo || !prNumber || !headSha) {
  console.error("GITHUB_REPOSITORY, PR and HEAD_SHA are required")
  process.exit(1)
}

if (!fs.existsSync(path)) {
  console.error(`No results at ${path} — the scan produced no output.`)
  process.exit(1)
}

const { total, failed, findings } = summarise(
  JSON.parse(fs.readFileSync(path, "utf8"))
)

const evidence = {
  headSha,
  suite,
  model,
  total,
  failed,
  findings,
  runUrl,
  ranAt: new Date().toISOString(),
}

await postEvidence(repo, prNumber, evidence)

await publishCheck(repo, headSha, {
  conclusion: failed === 0 ? "success" : "failure",
  title:
    failed === 0
      ? `${total} cases, no critical or high findings`
      : `${failed} critical/high finding(s) across ${total} cases`,
  summary:
    `Scanned \`${headSha.slice(0, 7)}\` with the ${suite} suite against \`${model}\`.\n\n` +
    (failed === 0
      ? "Nothing at critical or high severity."
      : findings
          .slice(0, 25)
          .map((f) => `- **${f.severity}** \`${f.plugin}\` — ${f.description}`)
          .join("\n")),
})

console.log(
  `Published evidence for ${headSha.slice(0, 7)}: ${total} cases, ${failed} finding(s).`
)
