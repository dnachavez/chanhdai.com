/**
 * Exit code for a red team run.
 *
 * `promptfoo eval` already exits non-zero on a failed assertion, which is what
 * gates the deterministic suite. `promptfoo redteam run` does not — it writes a
 * report and exits 0 whatever it found, so a scan wired straight into CI is a
 * scan nobody is enforcing. This turns the report back into a build status.
 *
 * Severity comes from the plugin, not from us: injection and prompt-extraction
 * findings block, while a hallucination finding is recorded and does not, because
 * the grader for it is a model and a flaky grader that can block main gets
 * disabled within a week.
 */
import fs from "node:fs"

const BLOCKING = new Set(["critical", "high"])

const path = process.argv[2] ?? "redteam/output.json"
if (!fs.existsSync(path)) {
  console.error(`No results at ${path} — the scan did not produce output.`)
  process.exit(1)
}

const report = JSON.parse(fs.readFileSync(path, "utf8"))
const rows = report.results?.results ?? report.results ?? []

const failures = rows.filter((row) => row.success === false)

const bySeverity = new Map()
for (const row of failures) {
  const severity =
    row.metadata?.severity ??
    row.testCase?.metadata?.severity ??
    row.gradingResult?.componentResults?.find((r) => r.severity)?.severity ??
    "unknown"
  const plugin =
    row.metadata?.pluginId ?? row.testCase?.metadata?.pluginId ?? "unknown"

  const key = `${severity}\t${plugin}`
  bySeverity.set(key, (bySeverity.get(key) ?? 0) + 1)
}

console.log(`\n${failures.length} failing case(s) of ${rows.length}\n`)
for (const [key, count] of [...bySeverity.entries()].sort()) {
  const [severity, plugin] = key.split("\t")
  const mark = BLOCKING.has(severity) ? "BLOCK" : "warn "
  console.log(`  ${mark}  ${severity.padEnd(8)} ${plugin.padEnd(32)} ${count}`)
}

const blocking = [...bySeverity.entries()]
  .filter(([key]) => BLOCKING.has(key.split("\t")[0]))
  .reduce((sum, [, count]) => sum + count, 0)

if (blocking > 0) {
  console.error(`\n${blocking} critical/high finding(s). Failing the build.\n`)
  process.exit(1)
}

console.log("\nNo critical or high findings.\n")
