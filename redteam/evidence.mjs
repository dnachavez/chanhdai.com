/**
 * SHA-bound evidence for the generated scan.
 *
 * The scan is expensive — minutes of wall clock and a few hundred model calls —
 * so it must not re-run on every commit pushed to a pull request. But a check
 * that simply does not run leaves the pull request looking unreviewed, and a
 * check that reports the *last* run regardless of what has changed since is
 * worse: it reports green for code nobody scanned.
 *
 * So the result is recorded against the exact commit it was produced from, in a
 * comment on the pull request, and a cheap check reads it back. Same revision,
 * the stored conclusion stands and nothing re-runs. New commits, the evidence no
 * longer matches and the check says so until someone asks for another scan.
 *
 * The shape is borrowed from the adversarial review in aeva-website, minus the
 * parts this repository has no use for — no publisher signatures, no
 * adjudication, one comment rather than a durable record. What is kept is the
 * part that matters: evidence binds to a SHA, and the check reflects the
 * evidence rather than the run.
 */

export const MARKER = "<!-- redteam-scan-evidence -->"
export const CHECK_NAME = "Red team scan"

const API = process.env.GITHUB_API_URL ?? "https://api.github.com"

export async function github(path, options = {}) {
  const token = process.env.GITHUB_TOKEN
  if (!token) throw new Error("GITHUB_TOKEN is required")

  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-github-api-version": "2022-11-28",
      ...options.headers,
    },
  })

  if (!response.ok) {
    throw new Error(
      `GitHub ${options.method ?? "GET"} ${path} -> ${response.status} ${await response.text()}`
    )
  }

  return response.status === 204 ? null : response.json()
}

/**
 * Findings are attacker-influenced text rendered into the same comment the
 * parser reads back, so one could otherwise close the JSON fence early or open a
 * fence of its own — and a scan result able to rewrite its own `headSha` is a
 * scan result able to mark any revision clean.
 *
 * Backticks and newlines go, pipes are escaped so the table survives, and the
 * cell is truncated. The parser's fence pattern happens to require a newline
 * after ```json today, which is the only reason this was not already a hole;
 * leaving it resting on that would be resting on an accident.
 */
function safeCell(text) {
  return String(text ?? "")
    .replace(/[`\r\n]+/g, " ")
    .replace(/\|/g, "\\|")
    .slice(0, 90)
}

/**
 * The machine-readable half is a fenced JSON block rather than front matter or
 * an HTML attribute, so the same comment a human reads is the one the check
 * parses. Two representations of one fact drift.
 */
export function renderEvidence(evidence) {
  const { headSha, suite, model, total, failed, findings, runUrl, ranAt } =
    evidence

  const verdict = failed === 0 ? "no findings" : `${failed} finding(s)`
  const lines = [
    MARKER,
    `### Red team scan — ${verdict}`,
    "",
    `\`${headSha.slice(0, 7)}\` · ${suite} · ${total} cases · target \`${model}\``,
    runUrl ? `[run](${runUrl})` : null,
    "",
  ]

  if (findings?.length) {
    lines.push("| severity | plugin | case |", "| --- | --- | --- |")
    for (const f of findings.slice(0, 25)) {
      lines.push(
        `| ${f.severity} | \`${safeCell(f.plugin)}\` | ${safeCell(f.description)} |`
      )
    }
    if (findings.length > 25) {
      lines.push("", `_…and ${findings.length - 25} more._`)
    }
    lines.push("")
  }

  lines.push(
    "<sub>Bound to the commit above. Push a new commit and this goes stale;",
    "comment `/redteam` to scan again, or run `pnpm redteam:scan` locally.</sub>",
    "",
    "```json",
    JSON.stringify({ headSha, suite, model, total, failed, ranAt }, null, 2),
    "```"
  )

  return lines.filter((line) => line !== null).join("\n")
}

export function parseEvidence(body) {
  if (!body?.includes(MARKER)) return null

  const match = /```json\s*\n([\s\S]*?)\n```/.exec(body)
  if (!match) return null

  try {
    const parsed = JSON.parse(match[1])
    return typeof parsed?.headSha === "string" ? parsed : null
  } catch {
    return null
  }
}

export async function findEvidenceComment(repo, prNumber) {
  /**
   * Paged deliberately: a busy pull request can push the evidence past the first
   * page, and a missed comment reads as "never scanned" and prompts a re-run of
   * the one thing this file exists to avoid re-running.
   */
  for (let page = 1; page <= 10; page++) {
    const comments = await github(
      `/repos/${repo}/issues/${prNumber}/comments?per_page=100&page=${page}`
    )
    if (!comments.length) return null

    const found = comments.find((comment) => comment.body?.includes(MARKER))
    if (found) return found
    if (comments.length < 100) return null
  }

  return null
}

export async function upsertEvidence(repo, prNumber, evidence) {
  const body = renderEvidence(evidence)
  const existing = await findEvidenceComment(repo, prNumber)

  if (existing) {
    return github(`/repos/${repo}/issues/comments/${existing.id}`, {
      method: "PATCH",
      body: JSON.stringify({ body }),
    })
  }

  return github(`/repos/${repo}/issues/${prNumber}/comments`, {
    method: "POST",
    body: JSON.stringify({ body }),
  })
}

export async function publishCheck(
  repo,
  headSha,
  { conclusion, title, summary }
) {
  return github(`/repos/${repo}/check-runs`, {
    method: "POST",
    body: JSON.stringify({
      name: CHECK_NAME,
      head_sha: headSha,
      status: "completed",
      conclusion,
      completed_at: new Date().toISOString(),
      output: { title, summary },
    }),
  })
}

/**
 * Reduces a promptfoo result file to what the evidence needs.
 *
 * Severity comes from the plugin rather than from us, and only critical and high
 * count as findings. Everything below that is recorded in the comment and does
 * not turn the check red: a medium hallucination finding is worth reading and is
 * not worth blocking a merge, and conflating the two is how a check stops being
 * read at all.
 */
export function summarise(report) {
  const rows = report.results?.results ?? report.results ?? []
  const findings = []

  for (const row of rows) {
    if (row.success !== false) continue

    const meta = { ...row.testCase?.metadata, ...row.metadata }
    const severity = meta.severity ?? "unknown"
    if (severity !== "critical" && severity !== "high") continue

    findings.push({
      severity,
      plugin: meta.pluginId ?? "unknown",
      description:
        row.testCase?.description ?? row.testCase?.vars?.prompt ?? "",
    })
  }

  return { total: rows.length, failed: findings.length, findings }
}
