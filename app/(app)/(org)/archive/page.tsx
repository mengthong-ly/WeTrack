import type { Metadata } from "next"
import { Suspense } from "react"

import { ArchiveTable } from "@/components/archive-table"
import { Reveal } from "@/components/motion-bits"
import { archivedTaskCounts, listArchivedProjects } from "@/lib/queries"
import { requireMember } from "@/lib/session"
import { attachmentSrc } from "@/lib/utils"

export const metadata: Metadata = { title: "Archive" }

// Archived projects: out of every list until restored; owners and admins can delete one for good from here.
export default async function ArchivePage() {
  const me = await requireMember()
  const [projects, counts] = await Promise.all([listArchivedProjects(me.orgId), archivedTaskCounts(me.orgId)])
  return (
    <Reveal className="flex flex-col gap-6">
      <Suspense>
        <ArchiveTable
          canDelete={me.role !== "member"}
          projects={projects.map((p) => ({
            id: p.id,
            name: p.name,
            color: p.color,
            logo: p.logoId && attachmentSrc(p.logoId),
            tasks: counts.get(p.id) ?? 0,
          }))}
        />
      </Suspense>
    </Reveal>
  )
}
