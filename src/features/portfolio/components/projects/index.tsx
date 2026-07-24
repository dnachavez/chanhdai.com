import {
  Panel,
  PanelHeader,
  PanelTitle,
  PanelTitleSup,
} from "@/features/portfolio/components/panel"
import { PanelTitleCopy } from "@/features/portfolio/components/panel-title-copy"
import { PanelViewAll } from "@/features/portfolio/components/panel-view-all"
import { PROJECTS } from "@/features/portfolio/data/projects"

import { ProjectItem } from "./project-item"

const ID = "projects"

/** How many projects the homepage shows before linking to the full list. */
const MAX = 4

export function Projects() {
  return (
    <Panel id={ID}>
      <PanelHeader>
        <PanelTitle>
          <a href={`#${ID}`}>Projects</a>
          <PanelTitleSup>({PROJECTS.length})</PanelTitleSup>
          <PanelTitleCopy id={ID} />
        </PanelTitle>
      </PanelHeader>

      <ul>
        {PROJECTS.slice(0, MAX).map((project) => (
          <li key={project.id} className="border-b border-line">
            <ProjectItem project={project} />
          </li>
        ))}
      </ul>

      {PROJECTS.length > MAX && (
        <PanelViewAll href="/projects">Show more</PanelViewAll>
      )}
    </Panel>
  )
}
