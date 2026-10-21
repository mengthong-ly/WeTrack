import { and, eq, gt, isNull, lte, notInArray, sql } from "drizzle-orm"

import { authorized } from "@/lib/cron"
import { db } from "@/lib/db"
import { meeting } from "@/lib/db/schema"
import { getEvent, googleToken } from "@/lib/google"
import { slackReminder } from "@/lib/meetings"
import { postSlack } from "@/lib/slack"

const TZ = process.env.APP_TIMEZONE ?? "Asia/Phnom_Penh"

// Every 5 minutes. Posts the 1-hour Slack reminder and fills Meet links Google was still creating.
// A meeting is claimed with remindedAt first, so a duplicate cron delivery posts nothing twice;
// a failed Slack post frees the claim so the next run retries it.
export async function GET(request: Request) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 })

  const now = sql`now()`
  const due = await db
    .update(meeting)
    .set({ remindedAt: now })
    .where(
      and(
        isNull(meeting.remindedAt),
        isNull(meeting.canceledAt),
        gt(meeting.startsAt, now),
        lte(meeting.startsAt, sql`now() + interval '60 minutes'`)
      )
    )
    .returning()

  const tokens = new Map<string, string | null>()
  let filled = 0
  // Never throws: a Google failure just leaves the link empty (logged by meeting id only).
  async function fill(m: { id: string; createdById: string | null; googleEventId: string }) {
    try {
      if (!m.createdById) return null
      if (!tokens.has(m.createdById)) tokens.set(m.createdById, await googleToken(m.createdById))
      const token = tokens.get(m.createdById)
      const url = token ? (await getEvent(token, m.googleEventId))?.meetUrl : null
      if (!url) return null
      await db.update(meeting).set({ meetUrl: url }).where(eq(meeting.id, m.id))
      filled++
      return url
    } catch {
      console.error(`Meet link fill failed for meeting ${m.id}`)
      return null
    }
  }

  let reminded = 0
  for (const m of due) {
    try {
      const meetUrl = m.meetUrl ?? (await fill(m))
      // "skipped" (no webhook) keeps the claim: nothing to retry.
      await postSlack(m.organizationId, slackReminder({ ...m, meetUrl }, TZ))
      reminded++
    } catch {
      console.error(`Reminder failed for meeting ${m.id}`)
      await db.update(meeting).set({ remindedAt: null }).where(eq(meeting.id, m.id))
    }
  }

  // Meetings starting within 24h that still have no link, so the banner and reminder can link to the Meet.
  const dueIds = due.map((m) => m.id)
  const missing = await db
    .select()
    .from(meeting)
    .where(
      and(
        isNull(meeting.meetUrl),
        isNull(meeting.canceledAt),
        gt(meeting.startsAt, now),
        lte(meeting.startsAt, sql`now() + interval '24 hours'`),
        dueIds.length ? notInArray(meeting.id, dueIds) : undefined
      )
    )
  for (const m of missing) await fill(m)

  return Response.json({ reminded, filled })
}
