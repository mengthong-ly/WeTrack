import "server-only"

import { type AnyColumn, and, asc, countDistinct, desc, eq, gt, ilike, inArray, isNotNull, isNull, lt, ne, or, sql, type SQL } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import { cache } from "react"

import { CLIENT_KINDS, groupUpdates } from "@/lib/client-update"
import { db } from "@/lib/db"
import { TASK_STATUSES } from "@/lib/db/enums"
import {
  activity,
  agentKey,
  clientUpdate,
  comment,
  feedback,
  meeting,
  member,
  notification,
  project,
  projectLink,
  shareLink,
  task,
  taskAssignee,
  taskView,
  user,
  userLogin,
} from "@/lib/db/schema"
import type { FeedbackItem } from "@/components/feedback"
import { plainText } from "@/lib/markdown"
import { INBOX_PAGE, notificationHref, notificationVerb } from "@/lib/notifications"
import { canJoin, formatSlot, joinUrl, type Viewer } from "@/lib/meetings"
import type { FeedbackWho, MeetingParams, SortDir } from "@/lib/paging"
import type { TaskParams } from "@/lib/task-views"
import { ago, dateTime } from "@/lib/time"

// The (app) layout and its pages both read projects and members: cache() runs each once per request.
// Async so the cached value is a promise (a Drizzle query re-runs every time it's awaited).
export const listProjects = cache(async (orgId: string) =>
  db.query.project.findMany({
    where: and(eq(project.organizationId, orgId), eq(project.archived, false)),
    orderBy: asc(project.name),
  })
)

// One project in this workspace (archived ones too, so their links still open), or undefined. Cached per request:
// the project layout, its switcher and the page all ask.
export const getProject = cache(async (orgId: string, id: string) =>
  db.query.project.findFirst({ where: and(eq(project.id, id), eq(project.organizationId, orgId)) })
)

// A project's named links, in the order they were added.
export const listProjectLinks = cache(async (orgId: string, projectId: string) =>
  db
    .select({ id: projectLink.id, kind: projectLink.kind, title: projectLink.title, url: projectLink.url })
    .from(projectLink)
    .where(and(eq(projectLink.organizationId, orgId), eq(projectLink.projectId, projectId)))
    .orderBy(asc(projectLink.createdAt), asc(projectLink.id))
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

// How many tasks each archived project holds, for the Archive page.
export async function archivedTaskCounts(orgId: string) {
  const rows = await db
    .select({ projectId: task.projectId, n: sql<number>`count(*)::int` })
    .from(task)
    .innerJoin(project, eq(project.id, task.projectId))
    .where(and(eq(task.organizationId, orgId), eq(project.archived, true)))
    .groupBy(task.projectId)
  return new Map(rows.map((r) => [r.projectId, r.n]))
}

const liveProjects = (orgId: string) =>
  db.select({ id: project.id }).from(project).where(and(eq(project.organizationId, orgId), eq(project.archived, false)))

const taskWith = {
  project: { columns: { id: true, name: true, color: true } },
  assignee: { columns: { id: true, name: true, image: true } },
  assignees: { columns: { userId: true }, with: { user: { columns: { id: true, name: true, image: true } } } },
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

const ACTIVE = ["in_progress", "review", "blocked"] as const
// A column sort for orderBy. Relational queries rewrite every column in orderBy onto the root table, so a sort by a
// related row's value is a subquery written as plain SQL (only the outer column is interpolated). The direction (only ever "asc" | "desc", from readSort), empty values last either way.
const by = (expr: SQL | AnyColumn, dir: SortDir) => sql`${expr} ${sql.raw(dir)} nulls last`
// `%term%` for ilike, with the user's own % _ \\ matched literally.
const contains = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`

// One page of the Tasks page (top-level tasks), filtered and ordered in the database. A ?sort= column orders by it;
// otherwise the order matches the Date view: overdue, then by deadline, then undated, then work finished before
// today (newest first), and the Completed tab goes by when it was done.
// ponytail: offset paging, so a task added while you page can repeat (the client drops repeats by id). Keyset
// paging on (rank, deadline, priority, id) if lists get busy enough for that to matter.
export async function pageTasks(orgId: string, p: TaskParams, today: string, offset: number, limit: number) {
  const pattern = p.q && contains(p.q)
  const where = and(
    eq(task.organizationId, orgId),
    inArray(task.projectId, liveProjects(orgId)),
    isNull(task.parentId),
    p.projectId ? eq(task.projectId, p.projectId) : undefined,
    p.person ? inArray(task.id, db.select({ id: taskAssignee.taskId }).from(taskAssignee).where(eq(taskAssignee.userId, p.person))) : undefined,
    pattern
      ? or(
          ilike(task.title, pattern),
          inArray(task.projectId, db.select({ id: project.id }).from(project).where(ilike(project.name, pattern))),
          inArray(
            task.id,
            db
              .select({ id: taskAssignee.taskId })
              .from(taskAssignee)
              .innerJoin(user, eq(user.id, taskAssignee.userId))
              .where(ilike(user.name, pattern))
          )
        )
      : undefined,
    p.status === "open"
      ? ne(task.status, "completed")
      : p.status === "active"
        ? inArray(task.status, ACTIVE)
        : p.status === "done"
          ? eq(task.status, "completed")
          : undefined
  )
  const [rows, total] = await Promise.all([
    db.query.task.findMany({
      columns: { description: false },
      extras: (t, { sql }) => ({ body: sql<string | null>`substr(${t.description}, 1, 1200)`.as("body") }),
      where,
      with: taskWith,
      orderBy: (t, { asc }) =>
        p.sort
          ? [
              by(
                {
                  title: sql`lower(${t.title})`,
                  status: sql`case ${t.status} ${sql.join(TASK_STATUSES.map((x, i) => sql`when ${x} then ${i}`), sql` `)} end`,
                  priority: sql`case ${t.priority} when 'urgent' then 0 when 'normal' then 1 else 2 end`,
                  assignee: sql`(select lower(u.name) from "user" u where u.id = ${t.assigneeId})`,
                  deadline: sql`${t.deadline}`,
                }[p.sort],
                p.dir
              ),
              asc(t.id),
            ]
          : p.status === "done"
          ? [sql`${t.completedAt} desc nulls last`, asc(t.id)]
          : [
              sql`case when ${t.deadline} is null then 2 when ${t.deadline} >= ${today} then 1 when ${t.status} = 'completed' then 3 else 0 end`,
              sql`case when ${t.deadline} < ${today} and ${t.status} = 'completed' then ${t.deadline} end desc nulls last`,
              asc(t.deadline),
              sql`case ${t.priority} when 'urgent' then 0 when 'normal' then 1 else 2 end`,
              asc(t.id),
            ],
      offset,
      limit,
    }),
    db.$count(task, where),
  ])
  return { rows, total }
}
export type PagedTaskRow = Awaited<ReturnType<typeof pageTasks>>["rows"][number]

// The direct children of a task, oldest first, shaped like the Tasks page's rows (the table opens a parent in place).
export function listSubtasks(orgId: string, parentId: string) {
  return db.query.task.findMany({
    columns: { description: false },
    where: and(eq(task.organizationId, orgId), eq(task.parentId, parentId)),
    with: taskWith,
    orderBy: [asc(task.createdAt), asc(task.id)],
  })
}

// Open tasks that are yours (assigned to you or made by you) and changed, or got a comment, after you last opened them,
// or you never have. Your own edits count as opening (touchSeen), so only other people's changes show here.
export async function unseenTasks(orgId: string, userId: string, limit = 8) {
  const changedAt = sql<Date>`greatest(${task.updatedAt}, coalesce((select max(c.created_at) from comment c where c.task_id = ${task.id}), ${task.updatedAt}))`
  const where = and(
    eq(task.organizationId, orgId),
    inArray(task.projectId, liveProjects(orgId)),
    ne(task.status, "completed"),
    or(eq(task.createdById, userId), inArray(task.id, db.select({ id: taskAssignee.taskId }).from(taskAssignee).where(eq(taskAssignee.userId, userId)))),
    or(isNull(taskView.viewedAt), sql`${changedAt} > ${taskView.viewedAt}`)
  )
  const from = () =>
    db
      .select({
        id: task.id,
        title: task.title,
        status: task.status,
        projectId: task.projectId,
        projectName: project.name,
        projectColor: project.color,
        changedAt,
        viewedAt: taskView.viewedAt,
      })
      .from(task)
      .innerJoin(project, eq(project.id, task.projectId))
      .leftJoin(taskView, and(eq(taskView.taskId, task.id), eq(taskView.userId, userId)))
      .where(where)
  const [rows, [{ n }]] = await Promise.all([
    from().orderBy(desc(changedAt)).limit(limit),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(task)
      .leftJoin(taskView, and(eq(taskView.taskId, task.id), eq(taskView.userId, userId)))
      .where(where),
  ])
  return { rows, total: n }
}

// The sign-in before this one, for Home ("last login"); null on a first visit.
export async function previousLogin(userId: string) {
  const [row] = await db.select({ at: userLogin.previousAt }).from(userLogin).where(eq(userLogin.userId, userId))
  return row?.at ?? null
}

// Just enough to find a task by name from the command menu.
export function taskIndex(orgId: string) {
  return db
    .select({
      id: task.id,
      title: task.title,
      status: task.status,
      projectId: task.projectId,
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
      assignees: { columns: { userId: true }, with: { user: { columns: { id: true, name: true, image: true } } } },
      release: true,
      parent: { columns: { id: true, title: true } },
      subtasks: {
        orderBy: asc(task.createdAt),
        columns: { id: true, title: true, status: true, priority: true, deadline: true, assigneeId: true },
        with: {
          assignee: { columns: { id: true, name: true, image: true } },
          assignees: { columns: { userId: true }, with: { user: { columns: { id: true, name: true, image: true } } } },
          subtasks: { columns: { id: true } },
        },
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

export function recentActivity(orgId: string, limit = 8, actorId?: string, offset = 0) {
  return db
    .select({
      id: activity.id,
      kind: activity.kind,
      data: activity.data,
      createdAt: activity.createdAt,
      taskId: activity.taskId,
      projectId: activity.projectId,
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
    .orderBy(desc(activity.createdAt), desc(activity.id))
    .limit(limit)
    .offset(offset)
}

export function activityCount(orgId: string) {
  return db.$count(activity, eq(activity.organizationId, orgId))
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

// Your live API keys in this workspace (not revoked, not expired), newest first. Never the hash.
export function listAgentKeys(orgId: string, userId: string) {
  return db
    .select({ id: agentKey.id, name: agentKey.name, createdAt: agentKey.createdAt, lastUsedAt: agentKey.lastUsedAt, expiresAt: agentKey.expiresAt })
    .from(agentKey)
    .where(and(eq(agentKey.organizationId, orgId), eq(agentKey.userId, userId), isNull(agentKey.revokedAt), gt(agentKey.expiresAt, new Date())))
    .orderBy(desc(agentKey.createdAt))
}

export function activeShareLink(orgId: string) {
  return db.query.shareLink.findFirst({
    where: and(eq(shareLink.organizationId, orgId), isNull(shareLink.revokedAt)),
  })
}

const MEETING_COLUMNS = {
  id: true,
  title: true,
  startsAt: true,
  endsAt: true,
  meetUrl: true,
  calendarUrl: true,
  canceledAt: true,
  attendeeEmails: true,
  createdById: true,
} as const
const MEETING_WITH = {
  task: { columns: { id: true, title: true, projectId: true } },
  createdBy: { columns: { id: true, name: true, image: true } },
} as const
const invitedOrCreated = (email: string, userId: string) =>
  or(sql`${email.toLowerCase()} = any(${meeting.attendeeEmails})`, eq(meeting.createdById, userId))

// Meetings that aren't cancelled and haven't ended, earliest first.
function liveMeetings(orgId: string, filter?: SQL) {
  return db.query.meeting.findMany({
    columns: MEETING_COLUMNS,
    where: and(
      eq(meeting.organizationId, orgId),
      isNull(meeting.canceledAt),
      gt(meeting.endsAt, new Date()),
      filter
    ),
    with: MEETING_WITH,
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

// A page of the Meetings table: upcoming (not ended, soonest first), past (ended, newest first) or cancelled
// (newest first); `mine` keeps the ones the viewer is invited to or made, `q` matches the title.
export async function meetingsPage(
  orgId: string,
  p: Pick<MeetingParams, "tab" | "mine" | "q" | "sort" | "dir">,
  viewer: { email: string; userId: string },
  offset: number,
  limit: number
) {
  const now = new Date()
  const where = and(
    eq(meeting.organizationId, orgId),
    p.tab === "cancelled" ? isNotNull(meeting.canceledAt) : isNull(meeting.canceledAt),
    p.tab === "upcoming" ? gt(meeting.endsAt, now) : p.tab === "past" ? lt(meeting.endsAt, now) : undefined,
    p.mine ? invitedOrCreated(viewer.email, viewer.userId) : undefined,
    p.q ? ilike(meeting.title, contains(p.q)) : undefined
  )
  const [rows, total] = await Promise.all([
    db.query.meeting.findMany({
      columns: MEETING_COLUMNS,
      where,
      with: MEETING_WITH,
      orderBy: p.sort
        ? [by(p.sort === "title" ? sql`lower(${meeting.title})` : meeting.startsAt, p.dir), asc(meeting.id)]
        : p.tab === "upcoming"
          ? [asc(meeting.startsAt), asc(meeting.id)]
          : [desc(meeting.startsAt), desc(meeting.id)],
      offset,
      limit,
    }),
    db.$count(meeting, where),
  ])
  return { rows, total }
}

/** What `MeetingList` renders. Built on the server so guest emails, the time zone and the Join rule stay here. */
export type MeetingItem = {
  id: string
  title: string
  slot: string
  joinUrl: string | null
  task: { id: string; title: string; projectId: string } | null
  people: { id: string; name: string; image: string | null }[]
  organizer: { id: string; name: string; image: string | null } | null
  canCancel: boolean
}

export function meetingItems(
  rows: MeetingRow[],
  members: { id: string; name: string; email: string; image: string | null }[],
  viewer: Viewer
): MeetingItem[] {
  const tz = process.env.APP_TIMEZONE ?? "Asia/Phnom_Penh"
  const now = Date.now()
  return rows.map((m) => {
    const live = !m.canceledAt && m.endsAt.getTime() > now
    return {
    id: m.id,
    title: m.title,
    slot: formatSlot(m, tz),
    joinUrl: live && canJoin(m, viewer) ? joinUrl(m) : null,
    task: m.task,
    people: members
      .filter((p) => p.id === m.createdById || m.attendeeEmails.includes(p.email.toLowerCase()))
      .map(({ id, name, image }) => ({ id, name, image })),
    organizer: m.createdBy,
    // Same rule as cancelMeeting; the server re-checks. Only a meeting still to come can be cancelled.
    canCancel: live && viewer !== "share" && (m.createdById === viewer.userId || viewer.role !== "member"),
  }
  })
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
export const openFeedback = cache(async (orgId: string, userId: string, projectId: string) => {
  const [open] = await db
    .select({
      mine: sql<number>`count(*) filter (where ${feedback.recipientId} = ${userId})`.mapWith(Number),
      given: sql<number>`count(*) filter (where ${feedback.authorId} = ${userId})`.mapWith(Number),
      all: sql<number>`count(*)`.mapWith(Number),
    })
    .from(feedback)
    .where(and(eq(feedback.organizationId, orgId), eq(feedback.projectId, projectId), isNull(feedback.resolvedAt)))
  return open as Record<FeedbackWho, number>
})

// A page of feedback (never the screenshot bytes), newest first: for me, from me or everyone, open or fixed.
export async function feedbackPage(
  me: Me,
  projectId: string,
  who: FeedbackWho,
  fixed: boolean,
  offset: number,
  limit: number,
  sort: { sort: "task" | "for" | "from" | "given" | null; dir: SortDir } = { sort: null, dir: "asc" }
) {
  const where = and(
    eq(feedback.organizationId, me.orgId),
    eq(feedback.projectId, projectId),
    who === "mine" ? eq(feedback.recipientId, me.user.id) : who === "given" ? eq(feedback.authorId, me.user.id) : undefined,
    fixed ? isNotNull(feedback.resolvedAt) : isNull(feedback.resolvedAt)
  )
  const [rows, total, open] = await Promise.all([
    db.query.feedback.findMany({
      where,
      with: FEEDBACK_WITH,
      orderBy: sort.sort
        ? [
            by(
              {
                task: sql`(select lower(t.title) from task t where t.id = ${feedback.taskId})`,
                for: sql`(select lower(u.name) from "user" u where u.id = ${feedback.recipientId})`,
                from: sql`(select lower(u.name) from "user" u where u.id = ${feedback.authorId})`,
                given: feedback.createdAt,
              }[sort.sort],
              sort.dir
            ),
            desc(feedback.id),
          ]
        : [desc(feedback.createdAt), desc(feedback.id)],
      offset,
      limit,
    }),
    db.$count(feedback, where),
    openFeedback(me.orgId, me.user.id, projectId),
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
    projectId: f.projectId,
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

// A project's Client updates: what the client hasn't been told yet, grouped per task, and what was sent.
export async function loadClientUpdates(orgId: string, projectId: string) {
  const project = await getProject(orgId, projectId)
  if (!project) return null
  const [events, history] = await Promise.all([unreportedActivity(orgId, projectId), clientUpdates(orgId, projectId)])
  const items = groupUpdates(
    events.map((e) => ({ id: e.id, kind: e.kind, taskId: e.taskId, createdAt: e.createdAt.toISOString() })),
    events.map((e) => ({ id: e.taskId!, title: e.title, status: e.status, deadline: e.deadline }))
  )
  return { project, items, history }
}

export type InboxItem = {
  id: string
  actor: { name: string; image: string | null } | null
  verb: string
  subject: string | null
  /** A comment's first words, or a meeting's time. */
  preview: string | null
  href: string
  ago: string
  /** ISO time: the cursor for "Show older". */
  at: string
  unread: boolean
}

export type InboxPage = { items: InboxItem[]; unread: number; hasMore: boolean }

const text = (v: unknown) => (typeof v === "string" && v ? v : null)

// One page of this person's inbox, newest first (`before` = the last item's `at` for the next page), and how many
// they haven't seen. Read by the bell (layout), its poll and "Show older" (/api/notifications).
export async function inbox(userId: string, before?: Date): Promise<InboxPage> {
  const actor = alias(user, "actor")
  const [rows, [{ unread }]] = await Promise.all([
    db
      .select({
        id: notification.id,
        kind: notification.kind,
        data: notification.data,
        taskId: notification.taskId,
        feedbackId: notification.feedbackId,
        readAt: notification.readAt,
        createdAt: notification.createdAt,
        actorName: actor.name,
        actorImage: actor.image,
        taskTitle: task.title,
        feedbackBody: feedback.body,
      })
      .from(notification)
      .leftJoin(actor, eq(actor.id, notification.actorId))
      .leftJoin(task, eq(task.id, notification.taskId))
      .leftJoin(feedback, eq(feedback.id, notification.feedbackId))
      .where(and(eq(notification.recipientId, userId), before ? lt(notification.createdAt, before) : undefined))
      .orderBy(desc(notification.createdAt))
      .limit(INBOX_PAGE + 1),
    db
      .select({ unread: sql<number>`count(*)::int` })
      .from(notification)
      .where(and(eq(notification.recipientId, userId), isNull(notification.readAt))),
  ])
  const now = new Date()
  const items: InboxItem[] = rows.slice(0, INBOX_PAGE).map((r) => ({
    id: r.id,
    actor: r.actorName ? { name: r.actorName, image: r.actorImage } : null,
    verb: notificationVerb(r.kind, r.data),
    // A meeting names itself; otherwise the task, or the feedback's first words.
    subject: text(r.data?.subject) ?? r.taskTitle ?? (r.feedbackBody ? plainText(r.feedbackBody).slice(0, 140) || null : null),
    preview: text(r.data?.preview),
    href: notificationHref(r),
    ago: ago(r.createdAt, now),
    at: r.createdAt.toISOString(),
    unread: !r.readAt,
  }))
  return { items, unread, hasMore: rows.length > INBOX_PAGE }
}
