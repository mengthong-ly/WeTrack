import { createHash, timingSafeEqual } from "node:crypto"

import { db } from "@/lib/db"
import { organization } from "@/lib/db/schema"
import { type Attention, needsAttention, projectProgress, STALE_DAYS, workload } from "@/lib/dashboard"
import { buildDigest } from "@/lib/digest"
import { sendEmail } from "@/lib/email"
import { PROJECT_HEALTH } from "@/lib/labels"
import { listMembers, listProjects, listTasks } from "@/lib/queries"
import { doneThisWeek, todayISO } from "@/lib/schedule"

const REASON: Record<Attention, string> = {
  overdue: "Overdue",
  blocked: "Blocked",
  stale: `No update in ${STALE_DAYS}+ days`,
  unassigned: "Nobody on it",
}

const sha = (s: string) => createHash("sha256").update(s).digest()

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return timingSafeEqual(sha(request.headers.get("authorization") ?? ""), sha(`Bearer ${secret}`))
}

// Monday digest for owners and admins. Vercel cron calls this with `Authorization: Bearer $CRON_SECRET`.
// ponytail: no dedupe, so a rare duplicate cron delivery sends the email twice; record a last-sent date per org if that bites.
export async function GET(request: Request) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 })

  const today = todayISO()
  const appUrl = process.env.BETTER_AUTH_URL ?? ""
  const orgs = await db.select({ id: organization.id, name: organization.name }).from(organization)
  const results = []

  for (const org of orgs) {
    try {
      const [tasks, projects, members] = await Promise.all([
        listTasks(org.id),
        listProjects(org.id),
        listMembers(org.id),
      ])
      const to = members.filter((m) => m.role === "owner" || m.role === "admin").map((m) => m.email)
      if (!tasks.length || !to.length) {
        results.push({ org: org.id, skipped: true })
        continue
      }
      const item = (t: (typeof tasks)[number]) => ({
        title: t.title,
        project: t.project.name,
        assignee: t.assignee?.name ?? null,
      })
      const { subject, text, html } = buildDigest({
        orgName: org.name,
        today,
        appUrl,
        done: tasks.filter((t) => doneThisWeek(t, today)).map(item),
        attention: needsAttention(tasks, today).map(({ task, reason }) => ({ ...item(task), reason: REASON[reason] })),
        projects: projectProgress(projects, tasks, today).map((p) => ({
          name: p.name,
          health: PROJECT_HEALTH[p.health].label,
          open: p.open,
          overdue: p.overdue,
          progress: p.progress,
        })),
        people: workload(members, tasks, today)
          .filter((w) => w.open || w.doneThisWeek)
          .map(({ member, ...w }) => ({ name: member.name, ...w })),
      })
      await sendEmail(to, subject, text, html)
      results.push({ org: org.id, sent: to.length })
    } catch (error) {
      console.error(`Digest failed for ${org.id}`, error)
      results.push({ org: org.id, error: true })
    }
  }

  const failed = results.some((r) => "error" in r)
  return Response.json({ today, results }, { status: failed ? 500 : 200 })
}
