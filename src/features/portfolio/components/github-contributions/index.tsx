import { Suspense } from "react"

import { getGitHubContributions } from "@/features/portfolio/data/github-contributions"
import { USER } from "@/features/portfolio/data/user"

import { Panel } from "../panel"
import { GitHubContributionFallback, GitHubContributionGraph } from "./graph"

export function GitHubContributions() {
  const contributions = getGitHubContributions()

  return (
    <Panel className="screen-line-top-none">
      <h2 className="sr-only">How active is {USER.displayName} on GitHub?</h2>

      <Suspense fallback={<GitHubContributionFallback />}>
        <GitHubContributionGraph contributions={contributions} />
      </Suspense>

      <div className="h-px" />
    </Panel>
  )
}
