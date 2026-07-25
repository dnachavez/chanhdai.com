/**
 * Collects CSP violations so a policy failure surfaces somewhere other than an
 * individual visitor's console. The policy is enforced rather than report-only,
 * which makes this the only way to learn that a directive is breaking a real
 * page for real people.
 *
 * Browsers disagree on how they deliver these: Chrome uses the Reporting API
 * (`report-to`, batched `application/reports+json` arrays), while Firefox and
 * Safari still only implement `report-uri` (a single `application/csp-report`
 * object). Both directives are set, so both shapes arrive here.
 */

type CspReportBody = {
  "blocked-uri"?: string
  "violated-directive"?: string
  "document-uri"?: string
  blockedURL?: string
  effectiveDirective?: string
  documentURL?: string
}

type ReportingApiEntry = {
  type?: string
  body?: CspReportBody
}

function normalize(body: CspReportBody) {
  return {
    blocked: body["blocked-uri"] ?? body.blockedURL,
    directive: body["violated-directive"] ?? body.effectiveDirective,
    document: body["document-uri"] ?? body.documentURL,
  }
}

export async function POST(request: Request) {
  let payload: unknown

  try {
    payload = await request.json()
  } catch {
    return new Response(null, { status: 204 })
  }

  const reports = Array.isArray(payload)
    ? (payload as ReportingApiEntry[])
        .filter((report) => report?.type === "csp-violation")
        .map((report) => normalize(report.body ?? {}))
    : [
        normalize(
          (payload as { "csp-report"?: CspReportBody })?.["csp-report"] ?? {}
        ),
      ]

  for (const report of reports) {
    if (!report.directive) continue
    /**
     * `console.error` specifically: the production build strips every other
     * console level (`compiler.removeConsole` excludes only "error"), so a
     * warn here compiles to nothing and the endpoint silently drops the very
     * reports it exists to collect.
     */
    console.error("[csp] violation", report)
  }

  /**
   * 204 unconditionally, including for junk bodies. The endpoint is public and
   * unauthenticated by necessity -- the browser posts to it before any session
   * exists -- so an error status only tells a prober that its input was parsed.
   */
  return new Response(null, { status: 204 })
}
