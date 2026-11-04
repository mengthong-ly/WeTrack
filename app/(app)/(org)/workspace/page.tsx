import type { Metadata } from "next"

import { Workspace } from "@/components/workspace"
import { needsAttention } from "@/lib/dashboard"
import { activeShareLink, listArchivedProjects, listMembers, listProjects, listTasks, unreportedCounts } from "@/lib/queries"
import { sceneData } from "@/lib/scene"
import { todayISO } from "@/lib/schedule"
import { requireMember } from "@/lib/session"
import { toCard } from "@/lib/task-view"
import { ago } from "@/lib/time"

export const metadata: Metadata = { title: "Workspace" }

export default async function WorkspacePage() {
  const me = await requireMember()
  const today = todayISO()
  const canShare = me.role !== "member"
  const [projects, tasks, members, unreported, link, archived] = await Promise.all([
    listProjects(me.orgId),
    listTasks(me.orgId),
    listMembers(me.orgId),
    unreportedCounts(me.orgId),
    canShare ? activeShareLink(me.orgId) : null,
    listArchivedProjects(me.orgId),
  ])

  return (
    <Workspace
      scene={sceneData(projects, tasks, members, today, { full: true, workspace: { name: me.orgName, logo: me.orgLogo } })}
      cards={tasks.map((t) => ({ ...toCard(t, today), projectId: t.projectId, assigneeId: t.assigneeId }))}
      members={members.map(({ id, name, image }) => ({ id, name, image }))}
      meId={me.user.id}
      attention={needsAttention(tasks, today).map((a) => a.task.id)}
      archived={archived.map(({ id, name, color }) => ({ id, name, color }))}
      unreported={Object.fromEntries(unreported)}
      share={
        canShare
          ? {
              active: link
                ? {
                    createdAt: link.createdAt.toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      timeZone: process.env.APP_TIMEZONE ?? "Asia/Phnom_Penh",
                    }),
                    lastViewed: link.lastViewedAt && ago(link.lastViewedAt),
                  }
                : null,
            }
          : null
      }
    />
  )
}
