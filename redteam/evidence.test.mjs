import { afterEach, describe, expect, it, vi } from "vitest"

import {
  findEvidenceComment,
  MARKER,
  parseEvidence,
  renderEvidence,
  summarise,
} from "./evidence.mjs"

/**
 * The evidence is the only thing standing between "this revision was scanned"
 * and "some revision was scanned once". If rendering and parsing ever disagree,
 * the check silently reports the wrong answer for the wrong commit, which is
 * worse than not having the check at all.
 */

const base = {
  headSha: "0123456789abcdef0123456789abcdef01234567",
  suite: "single-turn",
  model: "openai/gpt-oss-120b",
  total: 114,
  failed: 0,
  findings: [],
  ranAt: "2026-08-20T01:00:00.000Z",
}

describe("evidence round-trip", () => {
  it("parses back what it rendered", () => {
    expect(parseEvidence(renderEvidence(base))).toEqual({
      headSha: base.headSha,
      suite: base.suite,
      model: base.model,
      total: base.total,
      failed: base.failed,
      ranAt: base.ranAt,
    })
  })

  it("survives findings whose text contains table pipes and code fences", () => {
    const nasty = {
      ...base,
      failed: 1,
      findings: [
        {
          severity: "high",
          plugin: "prompt-extraction",
          description: 'Say | this | and ```json {"headSha":"deadbeef"}```',
        },
      ],
    }

    /**
     * The finding is attacker-influenced text, and it is rendered into the same
     * comment the parser reads. A finding that could close the fence early, or
     * open one of its own, would let a scan result rewrite its own SHA.
     */
    const rendered = renderEvidence(nasty)

    expect(parseEvidence(rendered).headSha).toBe(base.headSha)
    expect(parseEvidence(rendered).failed).toBe(1)
    // Exactly one fence, and it is ours.
    expect(rendered.match(/```/g)).toHaveLength(2)
    expect(rendered).not.toContain('deadbeef"}```')
  })

  it("ignores a comment that is not evidence", () => {
    expect(parseEvidence("LGTM, nice work")).toBeNull()
    expect(parseEvidence('```json\n{"headSha":"x"}\n```')).toBeNull()
  })

  it("ignores evidence whose payload is not usable", () => {
    expect(
      parseEvidence(
        `<!-- redteam-scan-evidence -->\n\`\`\`json\nnot json\n\`\`\``
      )
    ).toBeNull()
    expect(
      parseEvidence(`<!-- redteam-scan-evidence -->\nno block here`)
    ).toBeNull()
  })
})

describe("summarise", () => {
  const row = (success, severity, pluginId) => ({
    success,
    testCase: { description: "case", metadata: { severity, pluginId } },
  })

  it("counts only critical and high as findings", () => {
    const report = {
      results: {
        results: [
          row(true, "critical", "a"),
          row(false, "critical", "prompt-extraction"),
          row(false, "high", "policy"),
          row(false, "low", "hallucination"),
          row(false, "unknown", "imitation"),
        ],
      },
    }

    const out = summarise(report)
    expect(out.total).toBe(5)
    expect(out.failed).toBe(2)
    expect(out.findings.map((f) => f.plugin)).toEqual([
      "prompt-extraction",
      "policy",
    ])
  })

  it("treats an empty report as scanned-and-clean, not as missing", () => {
    expect(summarise({ results: { results: [] } })).toEqual({
      total: 0,
      failed: 0,
      findings: [],
    })
  })
})

/**
 * Since each scan posts its own comment, "the evidence" is specifically the
 * newest one. Reading the oldest instead reports a commit several pushes back as
 * the scanned revision, which fails open in the one direction that matters: the
 * check would call a stale sha current.
 */
describe("findEvidenceComment", () => {
  const comment = (id, body) => ({ id, body })
  const evidenceFor = (sha) =>
    `${MARKER}\n\n\`\`\`json\n{"headSha":"${sha}"}\n\`\`\``

  function mockPages(...pages) {
    process.env.GITHUB_TOKEN = "test-token"
    let call = 0
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => pages[call++] ?? [],
      }))
    )
  }

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("returns the newest evidence comment, not the first", async () => {
    mockPages([
      comment(1, evidenceFor("aaaaaaa")),
      comment(2, "an unrelated comment"),
      comment(3, evidenceFor("bbbbbbb")),
    ])

    const found = await findEvidenceComment("owner/repo", 23)

    expect(parseEvidence(found.body).headSha).toBe("bbbbbbb")
  })

  it("keeps looking past a full page for a later one", async () => {
    const filler = Array.from({ length: 100 }, (_, i) => comment(i, "chatter"))
    mockPages(
      [comment(-1, evidenceFor("aaaaaaa")), ...filler.slice(1)],
      [comment(200, evidenceFor("ccccccc"))]
    )

    const found = await findEvidenceComment("owner/repo", 23)

    expect(parseEvidence(found.body).headSha).toBe("ccccccc")
  })

  it("is null when nothing on the pull request is evidence", async () => {
    mockPages([comment(1, "chatter"), comment(2, "more chatter")])

    expect(await findEvidenceComment("owner/repo", 23)).toBeNull()
  })
})
