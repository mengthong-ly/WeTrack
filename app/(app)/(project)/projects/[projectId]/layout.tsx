import { notFound } from "next/navigation"
import { Suspense } from "react"

import { Account, Frame } from "@/app/(app)/frame"
import { ProjectSidebar, ProjectSidebarHead } from "@/components/app-sidebar"
import { getProject } from "@/lib/queries"
import { requireMember } from "@/lib/session"
import { attachmentSrc } from "@/lib/utils"

// Task management mode: everything here is inside one project. The sidebar swaps to the project's own sections
// and its New task button; "All projects" (or the header switcher) goes back to project selection.
export default function ProjectLayout({ children, params }: LayoutProps<"/projects/[projectId]">) {
  const projectId = params.then((p) => p.projectId)
  return (
    <Frame
      projectId={projectId}
      sidebar={
        <ProjectSidebar
          head={
            <Suspense fallback={<ProjectSidebarHead />}>
              <Head projectId={projectId} />
            </Suspense>
          }
          account={<Account />}
        />
      }
    >
      {children}
    </Frame>
  )
}

// The project's mark and name at the top of the sidebar. A project that isn't in this workspace is a 404.
async function Head({ projectId }: { projectId: Promise<string> }) {
  const me = await requireMember()
  const project = await getProject(me.orgId, await projectId)
  if (!project) notFound()
  return (
    <ProjectSidebarHead
      project={{ id: project.id, name: project.name, color: project.color, logo: project.logoId && attachmentSrc(project.logoId) }}
      archived={project.archived}
    />
  )
}
