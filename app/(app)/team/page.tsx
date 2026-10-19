import { and, eq, gt } from "drizzle-orm"
import type { Metadata } from "next"

import { UserAvatar } from "@/components/bits"
import { CancelInvite, InviteForm } from "@/components/invite-form"
import { Reveal } from "@/components/motion-bits"
import { ShareLinkCard } from "@/components/share-link-card"
import { db } from "@/lib/db"
import { invitation } from "@/lib/db/schema"
import { activeShareLink, listMembers, listTasks } from "@/lib/queries"
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

      {canInvite && (
        <Reveal index={1} className="rounded-tile bg-card p-6 shadow-sm">
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
        <Reveal index={2} className="rounded-tile bg-card p-6 shadow-sm">
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

      <Reveal index={3} className="rounded-tile bg-card p-3 shadow-sm">
        <ul className="flex flex-col">
          {members.map((m) => {
            const mine = tasks.filter((t) => t.assigneeId === m.id)
            const active = mine.filter((t) => ["in_progress", "review", "blocked"].includes(t.status)).length
            const open = mine.filter((t) => t.status !== "completed").length
            return (
              <li key={m.id} className="flex items-center gap-4 rounded-panel px-3 py-3 hover:bg-muted/60">
                <UserAvatar user={m} className="size-11 ring-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate">
                    {m.name} {m.id === me.user.id && <span className="text-muted-foreground">(you)</span>}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{m.email}</p>
                </div>
                <div className="hidden text-right text-sm text-muted-foreground sm:block">
                  <p>{active} in progress</p>
                  <p>{open} open</p>
                </div>
                <span className="rounded-full bg-muted px-3 py-1 text-xs capitalize">{m.role}</span>
              </li>
            )
          })}
        </ul>
      </Reveal>
    </div>
  )
}
