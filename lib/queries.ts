import "server-only"

import { and, asc, countDistinct, desc, eq, gt, inArray, isNull, lt, or, sql, type SQL } from "drizzle-orm"
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
  subtask,
  task,
  user,
} from "@/lib/db/schema"
import { canJoin, formatSlot, joinUrl, type Viewer } from "@/lib/meetings"

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

export function listTasks(orgId: string) {
  const live = db
    .select({ id: project.id })
    .from(project)
    .where(and(eq(project.organizationId, orgId), eq(project.archived, false)))
  return db.query.task.findMany({
    where: and(eq(task.organizationId, orgId), inArray(task.projectId, live)),
    with: {
      project: { columns: { id: true, name: true, color: true } },
      assignee: { columns: { id: true, name: true, image: true } },
      release: true,
      subtasks: { columns: { done: true } },
    },
    orderBy: [desc(task.updatedAt)],
  })
}
export type TaskRow = Awaited<ReturnType<typeof listTasks>>[number]

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

// Cached: a task page's generateMetadata and the page itself both read it.
export const getTask = cache(async (orgId: string, id: string) =>
  db.query.task.findFirst({
    where: and(eq(task.organizationId, orgId), eq(task.id, id)),
    with: {
      project: true,
      assignee: { columns: { id: true, name: true, image: true } },
      release: true,
      subtasks: { orderBy: [asc(subtask.position), asc(subtask.createdAt)] },
      comments: {
        orderBy: asc(comment.createdAt),
        with: { author: { columns: { id: true, name: true, image: true } } },
      },
    },
  })
)

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

export function clientUpdates(orgId: string, projectId: string) {
  return db
    .select({
      id: clientUpdate.id,
      message: clientUpdate.message,
      itemCount: clientUpdate.itemCount,
      createdAt: clientUpdate.createdAt,
      sentBy: user.name,
    })
    .from(clientUpdate)
    .leftJoin(user, eq(user.id, clientUpdate.sentById))
    .where(and(eq(clientUpdate.organizationId, orgId), eq(clientUpdate.projectId, projectId)))
    .orderBy(desc(clientUpdate.createdAt))
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

// Every point but the screenshot bytes, newest first. ponytail: last 500, page it if teams outgrow that.
export function listFeedback(orgId: string) {
  return db.query.feedback.findMany({
    columns: { image: false },
    where: eq(feedback.organizationId, orgId),
    with: {
      task: { columns: { id: true, title: true }, with: { project: { columns: { name: true, color: true } } } },
      author: { columns: { id: true, name: true, image: true } },
      recipient: { columns: { id: true, name: true, image: true } },
    },
    orderBy: desc(feedback.createdAt),
    limit: 500,
  })
}
