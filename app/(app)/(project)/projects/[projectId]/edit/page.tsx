import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { Reveal } from "@/components/motion-bits"
import { ProjectForm } from "@/components/project-form"
import { getProject, listProjectLinks } from "@/lib/queries"
import { requireMember } from "@/lib/session"
import { attachmentSrc } from "@/lib/utils"

export const metadata: Metadata = { title: "Edit project" }

// The same form as /create, filled in. Anyone in the workspace can edit a project (updateProject checks the workspace).
export default async function EditProjectPage({ params }: PageProps<"/projects/[projectId]/edit">) {
  const me = await requireMember()
  const { projectId } = await params
  const [project, links] = await Promise.all([getProject(me.orgId, projectId), listProjectLinks(me.orgId, projectId)])
  if (!project) notFound()
  return (
    <Reveal>
      <ProjectForm
        links={links.map(({ kind, title, url }) => ({ kind, title, url }))}
        project={{ id: project.id, name: project.name, description: project.description, color: project.color, logo: project.logoId && attachmentSrc(project.logoId) }}
      />
    </Reveal>
  )
}
