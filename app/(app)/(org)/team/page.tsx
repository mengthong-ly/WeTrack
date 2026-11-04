import { and, eq, gt } from "drizzle-orm"
import type { Metadata } from "next"
import { Suspense } from "react"

import { JoinCodeCard } from "@/components/join-code-card"
import { Reveal } from "@/components/motion-bits"
import { ShareLinkCard } from "@/components/share-link-card"
import { SlackCard } from "@/components/slack-card"
import { TeamSettings } from "@/components/team-settings"
import { TeamTable } from "@/components/team-table"
import { workload } from "@/lib/dashboard"
import { db } from "@/lib/db"
import { joinCode } from "@/lib/db/schema"
import { formatJoinCode } from "@/lib/join-code"
import { activeShareLink, listMembers, listTasks } from "@/lib/queries"
import { todayISO } from "@/lib/schedule"
import { requireMember } from "@/lib/session"
import { hasSlack } from "@/lib/slack"
import { ago } from "@/lib/time"

export const metadata: Metadata = { title: "Team" }

// Everyone in the workspace as a data table (TeamTable), then the settings owners and admins use to bring people in.
export default async function TeamPage() {
  const me = await requireMember()
  const canInvite = me.role !== "member"
  const [members, tasks, link, slack, code] = await Promise.all([
    listMembers(me.orgId),
    listTasks(me.orgId),
    activeShareLink(me.orgId),
    canInvite ? hasSlack(me.orgId) : false,
    canInvite
      ? db.query.joinCode.findFirst({
          where: and(eq(joinCode.organizationId, me.orgId), gt(joinCode.expiresAt, new Date())),
        })
      : undefined,
  ])

  return (
    <div className="flex flex-col gap-6">
      <Reveal className="flex flex-col gap-6">
        <Suspense>
          <TeamTable rows={workload(members, tasks, todayISO())} team={me.orgName} meId={me.user.id} canEditRoles={me.role === "owner"} />
        </Suspense>
      </Reveal>

      {canInvite && (
        <Reveal index={2} className="rounded-tile bg-card p-6 shadow-sm">
          <h2 className="mb-2 text-lg">Join code</h2>
          <JoinCodeCard active={code ? { code: formatJoinCode(code.code), expires: ago(code.expiresAt) } : null} />
        </Reveal>
      )}

      {canInvite && (
        <Reveal index={3} className="rounded-tile bg-card p-6 shadow-sm">
          <h2 className="mb-2 text-lg">CEO link</h2>
          <ShareLinkCard
            active={
              link
                ? {
                    createdAt: link.createdAt.toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      timeZone: process.env.APP_TIMEZONE ?? "Asia/Phnom_Penh",
                    }),
                    lastViewed: link.lastViewedAt && ago(link.lastViewedAt),
                  }
                : null
            }
          />
        </Reveal>
      )}

      {canInvite && (
        <Reveal index={4} className="rounded-tile bg-card p-6 shadow-sm">
          <h2 className="mb-2 text-lg">Slack</h2>
          <SlackCard connected={slack} />
        </Reveal>
      )}

      <Reveal index={5} className="rounded-tile bg-card p-6 shadow-sm">
        <h2 className="mb-2 text-lg">Team</h2>
        <TeamSettings name={me.orgName} canRename={canInvite} canLeave={me.role !== "owner"} />
      </Reveal>
    </div>
  )
}
