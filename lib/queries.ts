import "server-only"

import { and, asc, countDistinct, desc, eq, gt, gte, ilike, inArray, isNotNull, isNull, lt, ne, or, sql, type SQL } from "drizzle-orm"
import { cache } from "react"

import { CLIENT_KINDS } from "@/lib/client-update"
import { db } from "@/lib/db"
import {
  activity,
  clientUpdate,
  comment,
  feedback,
  meeting,
  member,
  project,
  shareLink,
  task,
  user,
} from "@/lib/db/schema"
import type { FeedbackItem } from "@/components/feedback"
import { canJoin, formatSlot, joinUrl, type Viewer } from "@/lib/meetings"
import type { FeedbackWho } from "@/lib/paging"
import { monthRange, type TaskParams } from "@/lib/task-views"
import { ago, dateTime } from "@/lib/time"

// The (app) layout and its pages both read projects and members: cache() runs each once per request.
// Async so the cached value is a promise (a Drizzle query re-runs every time it's awaited).
export const listProjects = cache(async (orgId: string) =>
  db.query.project.findMany({
    where: and(eq(project.organizationId, orgId), eq(project.archived, false)),
    orderBy: asc(project.name),
  })
)

export const listMembers = cache(async (orgId: string) =>
  db
    .select({ id: user.id, name: user.name, email: user.email, image: user.image, role: member.role })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(eq(member.organizationId, orgId))
    .orderBy(asc(user.name))
)

// Archived projects (and their tasks) leave every list until they're restored.
export function listArchivedProjects(orgId: string) {
  return db.query.project.findMany({
    where: and(eq(project.organizationId, orgId), eq(project.archived, true)),
    orderBy: asc(project.name),
  })
}

const liveProjects = (orgId: string) =>
  db.select({ id: project.id }).from(project).where(and(eq(project.organizationId, orgId), eq(project.archived, false)))

const taskWith = {
  project: { columns: { id: true, name: true, color: true } },
  assignee: { columns: { id: true, name: true, image: true } },
  release: true,
  subtasks: { columns: { status: true } },
} as const

// Every task in live projects, for the pages that count, chart or draw them all (Home, Projects, Team, the 3D
// workspace, the CEO page). Descriptions stay in the database: only a short preview for the few cards shown.
export function listTasks(orgId: string) {
  return db.query.task.findMany({
    columns: { description: false },
    extras: (t, { sql }) => ({ preview: sql<string | null>`substr(${t.description}, 1, 280)`.as("preview") }),
    where: and(eq(task.organizationId, orgId), inArray(task.projectId, liveProjects(orgId))),
    with: taskWith,
    orderBy: [desc(task.updatedAt)],
  })
}
export type TaskRow = Awaited<ReturnType<typeof listTasks>>[number]

const WEEK_MS = 7 * 86_400_000
const CALENDAR_MAX = 300
const ACTIVE = ["in_progress", "review", "blocked"] as const
// `%term%` for ilike, with the user's own % _ \\ matched literally.
const contains = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`

// One page of the Tasks page (top-level tasks), filtered and ordered in the database. Order matches the Date view:
// overdue, then by deadline, then undated, then work finished before today (newest first); the Completed tab goes
// by when it was done. The board keeps done work from the last week; the calendar reads its month and undated work.
// ponytail: offset paging, so a task added while you page can repeat (the client drops repeats by id). Keyset
// paging on (rank, deadline, priority, id) if lists get busy enough for that to matter.
export async function pageTasks(orgId: string, p: TaskParams, today: string, offset: number, limit: number) {
  const pattern = p.q && contains(p.q)
  const [from, to] = monthRange(p.month ?? today.slice(0, 7))
  const where = and(
    eq(task.organizationId, orgId),
    inArray(task.projectId, liveProjects(orgId)),
    isNull(task.parentId),
    p.projectId ? eq(task.projectId, p.projectId) : undefined,
    p.person ? eq(task.assigneeId, p.person) : undefined,
    pattern
      ? or(
          ilike(task.title, pattern),
          inArray(task.projectId, db.select({ id: project.id }).from(project).where(ilike(project.name, pattern))),
          inArray(task.assigneeId, db.select({ id: user.id }).from(user).where(ilike(user.name, pattern)))
        )
      : undefined,
    p.view === "board"
      ? or(ne(task.status, "completed"), gt(task.completedAt, new Date(Date.parse(today) - WEEK_MS)))
      : p.status === "open"
        ? ne(task.status, "completed")
        : p.status === "active"
          ? inArray(task.status, ACTIVE)
          : p.status === "done"
            ? eq(task.status, "completed")
            : undefined,
    p.view === "calendar" ? or(and(gte(task.deadline, from), lt(task.deadline, to)), isNull(task.deadline)) : undefined
  )
  const [rows, total] = await Promise.all([
    db.query.task.findMany({
      columns: { description: false },
      extras: (t, { sql }) => ({ body: sql<string | null>`substr(${t.description}, 1, 1200)`.as("body") }),
      where,
      with: taskWith,
      orderBy: (t, { asc }) =>
        p.status === "done" && p.view !== "board"
          ? [sql`${t.completedAt} desc nulls last`, asc(t.id)]
          : [
              sql`case when ${t.deadline} is null then 2 when ${t.deadline} >= ${today} then 1 when ${t.status} = 'completed' then 3 else 0 end`,
              sql`case when ${t.deadline} < ${today} and ${t.status} = 'completed' then ${t.deadline} end desc nulls last`,
              asc(t.deadline),
              sql`case ${t.priority} when 'urgent' then 0 when 'normal' then 1 else 2 end`,
              asc(t.id),
            ],
      // ponytail: the calendar reads its whole month (and undated work) up to CALENDAR_MAX, no paging.
      offset: p.view === "calendar" ? 0 : offset,
      limit: p.view === "calendar" ? CALENDAR_MAX : limit,
    }),
    db.$count(task, where),
  ])
  return { rows, total }
}
export type PagedTaskRow = Awaited<ReturnType<typeof pageTasks>>["rows"][number]

// Just enough to find a task by name from the command menu.
export function taskIndex(orgId: string) {
  return db
    .select({
      id: task.id,
      title: task.title,
      status: task.status,
      projectName: project.name,
      projectColor: project.color,
    })
    .from(task)
    .innerJoin(project, eq(project.id, task.projectId))
    .where(eq(task.organizationId, orgId))
    .orderBy(desc(task.updatedAt))
}
export type TaskIndexRow = Awaited<ReturnType<typeof taskIndex>>[number]

// Cached: a task page's generateMetadata and the page itself both read it. Comments come from taskComments.
export const getTask = cache(async (orgId: string, id: string) =>
  db.query.task.findFirst({
    where: and(eq(task.organizationId, orgId), eq(task.id, id)),
    with: {
      project: true,
      assignee: { columns: { id: true, name: true, image: true } },
      release: true,
      parent: { columns: { id: true, title: true } },
      subtasks: {
        orderBy: asc(task.createdAt),
        columns: { id: true, title: true, status: true, priority: true, deadline: true },
        with: { assignee: { columns: { id: true, name: true, image: true } }, subtasks: { columns: { id: true } } },
      },
    },
  })
)

export const COMMENT_PAGE = 20

// A task's comments, newest first from `offset` (the task page shows the latest page), with the total.
export async function taskComments(orgId: string, taskId: string, offset = 0, limit = COMMENT_PAGE) {
  const where = and(eq(comment.taskId, taskId), inArray(comment.taskId, db.select({ id: task.id }).from(task).where(eq(task.organizationId, orgId))))
  const [rows, total] = await Promise.all([
    db.query.comment.findMany({
      where,
      orderBy: [desc(comment.createdAt), desc(comment.id)],
      offset,
      limit,
      with: { author: { columns: { id: true, name: true, image: true } } },
    }),
    db.$count(comment, where),
  ])
  return { rows: rows.map((c) => ({ id: c.id, body: c.body, createdAt: c.createdAt.toISOString(), author: c.author })), total }
}

// Every task's place in the tree, for the task page's contents (ancestors and the whole family under the root).
// ponytail: the whole workspace in one read; switch to a recursive CTE if workspaces reach thousands of tasks.
export function taskTree(orgId: string) {
  return db
    .select({ id: task.id, parentId: task.parentId, title: task.title, status: task.status })
    .from(task)
    .where(eq(task.organizationId, orgId))
    .orderBy(asc(task.createdAt))
}

export function recentActivity(orgId: string, limit = 8, actorId?: string) {
  return db
    .select({
      id: activity.id,
      kind: activity.kind,
      data: activity.data,
      createdAt: activity.createdAt,
      taskId: activity.taskId,
      taskTitle: task.title,
      actorId: activity.actorId,
      actor: user.name,
    })
    .from(activity)
    .leftJoin(task, eq(task.id, activity.taskId))
    .leftJoin(user, eq(user.id, activity.actorId))
    .where(
      and(eq(activity.organizationId, orgId), actorId ? eq(activity.actorId, actorId) : undefined)
    )
    .orderBy(desc(activity.createdAt))
    .limit(limit)
}

export function getProject(orgId: string, id: string) {
  return db.query.project.findFirst({ where: and(eq(project.organizationId, orgId), eq(project.id, id)) })
}

// Activity the client hasn't been told about yet, with the task's current state.
export function unreportedActivity(orgId: string, projectId: string) {
  return db
    .select({
      id: activity.id,
      kind: activity.kind,
      taskId: activity.taskId,
      createdAt: activity.createdAt,
      title: task.title,
      status: task.status,
      deadline: task.deadline,
    })
    .from(activity)
    .innerJoin(task, eq(task.id, activity.taskId))
    .where(
      and(
        eq(activity.organizationId, orgId),
        eq(activity.projectId, projectId),
        isNull(activity.reportedInUpdateId),
        inArray(activity.kind, [...CLIENT_KINDS])
      )
    )
    .orderBy(asc(activity.createdAt))
}

export async function unreportedCounts(orgId: string) {
  const rows = await db
    .select({ projectId: activity.projectId, n: countDistinct(activity.taskId) })
    .from(activity)
    .where(
      and(
        eq(activity.organizationId, orgId),
        isNull(activity.reportedInUpdateId),
        inArray(activity.kind, [...CLIENT_KINDS])
      )
    )
    .groupBy(activity.projectId)
  return new Map(rows.map((r) => [r.projectId, r.n]))
}

export const UPDATE_PAGE = 20

// Updates sent to a project's client, newest first from `offset`, with the total.
export async function clientUpdates(orgId: string, projectId: string, offset = 0, limit = UPDATE_PAGE) {
  const where = and(eq(clientUpdate.organizationId, orgId), eq(clientUpdate.projectId, projectId))
  const [rows, total] = await Promise.all([
    db
      .select({
        id: clientUpdate.id,
        message: clientUpdate.message,
        itemCount: clientUpdate.itemCount,
        createdAt: clientUpdate.createdAt,
        sentBy: user.name,
      })
      .from(clientUpdate)
      .leftJoin(user, eq(user.id, clientUpdate.sentById))
      .where(where)
      .orderBy(desc(clientUpdate.createdAt), desc(clientUpdate.id))
      .offset(offset)
      .limit(limit),
    db.$count(clientUpdate, where),
  ])
  return { rows: rows.map(({ createdAt, ...r }) => ({ ...r, when: dateTime(createdAt) })), total }
}

export function activeShareLink(orgId: string) {
  return db.query.shareLink.findFirst({
    where: and(eq(shareLink.organizationId, orgId), isNull(shareLink.revokedAt)),
  })
}

// Meetings that aren't cancelled and haven't ended, earliest first.
function liveMeetings(orgId: string, filter?: SQL) {
  return db.query.meeting.findMany({
    columns: {
      id: true,
      title: true,
      startsAt: true,
      endsAt: true,
      meetUrl: true,
      calendarUrl: true,
      canceledAt: true,
      attendeeEmails: true,
      createdById: true,
    },
    where: and(
      eq(meeting.organizationId, orgId),
      isNull(meeting.canceledAt),
      gt(meeting.endsAt, new Date()),
      filter
    ),
    with: {
      task: { columns: { id: true, title: true } },
      createdBy: { columns: { id: true, name: true, image: true } },
    },
    orderBy: asc(meeting.startsAt),
  })
}
export type MeetingRow = Awaited<ReturnType<typeof liveMeetings>>[number]

/** The next `days` (default 7). With `email`/`userId`, only meetings that person is invited to or created. */
export function upcomingMeetings(
  orgId: string,
  opts: { email?: string; userId?: string; days?: number } = {}
): Promise<MeetingRow[]> {
  const until = new Date(Date.now() + (opts.days ?? 7) * 86_400_000)
  const mine =
    opts.email || opts.userId
      ? or(
          opts.email ? sql`${opts.email.toLowerCase()} = any(${meeting.attendeeEmails})` : undefined,
          opts.userId ? eq(meeting.createdById, opts.userId) : undefined
        )
      : undefined
  return liveMeetings(orgId, and(lt(meeting.startsAt, until), mine))
}

export function taskMeetings(orgId: string, taskId: string): Promise<MeetingRow[]> {
  return liveMeetings(orgId, eq(meeting.taskId, taskId))
}

/** What `MeetingList` renders. Built on the server so guest emails, the time zone and the Join rule stay here. */
export type MeetingItem = {
  id: string
  title: string
  slot: string
  joinUrl: string | null
  task: { id: string; title: string } | null
  people: { id: string; name: string; image: string | null }[]
  canCancel: boolean
}

export function meetingItems(
  rows: MeetingRow[],
  members: { id: string; name: string; email: string; image: string | null }[],
  viewer: Viewer
): MeetingItem[] {
  const tz = process.env.APP_TIMEZONE ?? "Asia/Phnom_Penh"
  return rows.map((m) => ({
    id: m.id,
    title: m.title,
    slot: formatSlot(m, tz),
    joinUrl: canJoin(m, viewer) ? joinUrl(m) : null,
    task: m.task,
    people: members
      .filter((p) => p.id === m.createdById || m.attendeeEmails.includes(p.email.toLowerCase()))
      .map(({ id, name, image }) => ({ id, name, image })),
    // Same rule as cancelMeeting; the server re-checks.
    canCancel: viewer !== "share" && (m.createdById === viewer.userId || viewer.role !== "member"),
  }))
}

/** Dates as ISO strings for the client `MeetingBanner`. */
export function bannerMeetings(rows: MeetingRow[], viewer: Viewer) {
  return rows.map((m) => ({
    id: m.id,
    title: m.title,
    startsAt: m.startsAt.toISOString(),
    endsAt: m.endsAt.toISOString(),
    // No link means no Join button.
    meetUrl: canJoin(m, viewer) ? m.meetUrl : null,
    calendarUrl: canJoin(m, viewer) ? m.calendarUrl : null,
    canceledAt: m.canceledAt?.toISOString() ?? null,
  }))
}

type Me = { orgId: string; role: string; user: { id: string } }

// What's left to fix on each Feedback tab. Cached per request: the page reads it to pick its first tab.
export const openFeedback = cache(async (orgId: string, userId: string) => {
  const [open] = await db
    .select({
      mine: sql<number>`count(*) filter (where ${feedback.recipientId} = ${userId})`.mapWith(Number),
      given: sql<number>`count(*) filter (where ${feedback.authorId} = ${userId})`.mapWith(Number),
      all: sql<number>`count(*)`.mapWith(Number),
    })
    .from(feedback)
    .where(and(eq(feedback.organizationId, orgId), isNull(feedback.resolvedAt)))
  return open as Record<FeedbackWho, number>
})

// A page of feedback (never the screenshot bytes), newest first: for me, from me or everyone, open or fixed.
export async function feedbackPage(me: Me, who: FeedbackWho, fixed: boolean, offset: number, limit: number) {
  const where = and(
    eq(feedback.organizationId, me.orgId),
    who === "mine" ? eq(feedback.recipientId, me.user.id) : who === "given" ? eq(feedback.authorId, me.user.id) : undefined,
    fixed ? isNotNull(feedback.resolvedAt) : isNull(feedback.resolvedAt)
  )
  const [rows, total, open] = await Promise.all([
    db.query.feedback.findMany({
      where,
      with: FEEDBACK_WITH,
      orderBy: [desc(feedback.createdAt), desc(feedback.id)],
      offset,
      limit,
    }),
    db.$count(feedback, where),
    openFeedback(me.orgId, me.user.id),
  ])
  return { rows: rows.map((f) => toFeedbackItem(me, f)), total, open }
}

// One feedback for its own page, or null when it isn't in this workspace. Cached per request (metadata + page).
export const getFeedback = cache(async (me: Me, id: string) => {
  const f = await db.query.feedback.findFirst({
    where: and(eq(feedback.id, id), eq(feedback.organizationId, me.orgId)),
    with: FEEDBACK_WITH,
  })
  return f ? toFeedbackItem(me, f) : null
})

const FEEDBACK_WITH = {
  task: { columns: { id: true, title: true }, with: { project: { columns: { name: true, color: true } } } },
  author: { columns: { id: true, name: true, image: true } },
  recipient: { columns: { id: true, name: true, image: true } },
} as const

type Person = { id: string; name: string; image: string | null }
function toFeedbackItem(
  me: Me,
  f: typeof feedback.$inferSelect & {
    task: { id: string; title: string; project: { name: string; color: string } } | null
    author: Person | null
    recipient: Person | null
  }
): FeedbackItem {
  return {
    id: f.id,
    body: f.body,
    imageId: f.imageId,
    resolved: !!f.resolvedAt,
    when: ago(f.createdAt),
    task: f.task && { id: f.task.id, title: f.task.title, color: f.task.project.color, project: f.task.project.name },
    author: f.author,
    recipient: f.recipient,
    canDelete: f.authorId === me.user.id || me.role !== "member",
  }
}
