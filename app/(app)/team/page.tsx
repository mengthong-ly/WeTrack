import { and, eq, gt } from "drizzle-orm"
import type { Metadata } from "next"

import { CancelInvite, InviteForm } from "@/components/invite-form"
import { Reveal } from "@/components/motion-bits"
import { ShareLinkCard } from "@/components/share-link-card"
import { Workload } from "@/components/workload"
import { workload } from "@/lib/dashboard"
import { db } from "@/lib/db"
import { invitation } from "@/lib/db/schema"
import { activeShareLink, listMembers, listTasks } from "@/lib/queries"
import { todayISO } from "@/lib/schedule"
import { requireMember } from "@/lib/session"
import { ago } from "@/lib/time"

export const metadata: Metadata = { title: "Team" }

export default async function TeamPage() {
  const me = await requireMember()
  const canInvite = me.role !== "member"
  const [members, tasks, link, invites] = await Promise.all([
    listMembers(me.orgId),
    listTasks(me.orgId),
    activeShareLink(me.orgId),
    db.query.invitation.findMany({
      where: and(eq(invitation.organizationId, me.orgId), eq(invitation.status, "pending"), gt(invitation.expiresAt, new Date())),
    }),
  ])

  return (
    <div className="flex flex-col gap-6">
      <Reveal>
        <h1 className="text-3xl font-light tracking-tight sm:text-4xl">Team</h1>
        <p className="mt-1 text-muted-foreground">{me.orgName}</p>
      </Reveal>

      <Reveal index={1} className="rounded-tile bg-card p-3 shadow-sm">
        <h2 className="px-3 pt-3 pb-4 text-lg">Workload</h2>
        <Workload
          rows={workload(members, tasks, todayISO())}
          href={(id) => `/tasks?person=${id}`}
          sub={(m) => (m.id === me.user.id ? `${m.email} · you` : m.email)}
          trailing={(m) => <span className="rounded-full bg-muted px-3 py-1 text-xs capitalize">{m.role}</span>}
        />
      </Reveal>

      {canInvite && (
        <Reveal index={2} className="rounded-tile bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg">Invite a teammate</h2>
          <InviteForm />
          {invites.length > 0 && (
            <ul className="mt-5 flex flex-col divide-y">
              {invites.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span>
                    {inv.email} <span className="text-muted-foreground">· {inv.role ?? "member"} · pending</span>
                  </span>
                  <CancelInvite id={inv.id} />
                </li>
              ))}
            </ul>
          )}
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

    </div>
  )
}
