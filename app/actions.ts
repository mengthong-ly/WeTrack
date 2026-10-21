"use server"

import { and, eq, inArray, isNull, max } from "drizzle-orm"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import {
  activity,
  clientUpdate,
  comment,
  meeting,
  member,
  project,
  shareLink,
  subtask,
  task,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TYPES,
  user,
  workspaceIntegration,
} from "@/lib/db/schema"
import { createEvent, deleteEvent, googleToken } from "@/lib/google"
import { meetingSlot, parseEmails, slackCancelled, slackCreated } from "@/lib/meetings"
import { getSession, requireMember } from "@/lib/session"
import { hashShareToken, newShareToken } from "@/lib/share"
import { postSlack, postToWebhook } from "@/lib/slack"

type Result = { error?: string }

const isoDate = z.iso.date().nullable()
const optionalText = z
  .string()
  .trim()
  .max(5000)
  .transform((s) => s || null)
  .nullable()

const refresh = () => revalidatePath("/", "layout")

async function log(orgId: string, actorId: string, kind: string, rest: Partial<typeof activity.$inferInsert>) {
  await db.insert(activity).values({ organizationId: orgId, actorId, kind, ...rest })
}

async function ownProject(orgId: string, projectId: string) {
  return db.query.project.findFirst({
    where: and(eq(project.id, projectId), eq(project.organizationId, orgId)),
  })
}

async function ownTask(orgId: string, taskId: string) {
  return db.query.task.findFirst({ where: and(eq(task.id, taskId), eq(task.organizationId, orgId)) })
}

async function isMember(orgId: string, userId: string) {
  const m = await db.query.member.findFirst({
    where: and(eq(member.organizationId, orgId), eq(member.userId, userId)),
  })
  return !!m
}

// ---------- Workspace ----------

export async function createWorkspace(name: string): Promise<Result> {
  const session = await getSession()
  if (!session) redirect("/sign-in")
  const parsed = z.string().trim().min(2).max(60).safeParse(name)
  if (!parsed.success) return { error: "Workspace name must be 2–60 characters." }
  const slug = `${parsed.data.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${crypto.randomUUID().slice(0, 6)}`
  await auth.api.createOrganization({ headers: await headers(), body: { name: parsed.data, slug } })
  redirect("/")
}

export async function inviteMember(email: string, role: "member" | "admin"): Promise<Result> {
  const me = await requireMember()
  if (me.role === "member") return { error: "Only owners and admins can invite." }
  const parsed = z.email().safeParse(email.trim().toLowerCase())
  if (!parsed.success) return { error: "Enter a valid email." }
  try {
    await auth.api.createInvitation({
      headers: await headers(),
      body: { email: parsed.data, role, organizationId: me.orgId, resend: true },
    })
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not send the invite." }
  }
  refresh()
  return {}
}

export async function cancelInvite(invitationId: string): Promise<Result> {
  await requireMember()
  try {
    await auth.api.cancelInvitation({ headers: await headers(), body: { invitationId } })
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not cancel the invite." }
  }
  refresh()
  return {}
}

// ---------- Projects ----------

const projectInput = z.object({
  name: z.string().trim().min(1, "Name the project.").max(60),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
})

export async function createProject(input: z.input<typeof projectInput>): Promise<Result> {
  const me = await requireMember()
  const parsed = projectInput.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  await db.insert(project).values({ organizationId: me.orgId, ...parsed.data })
  refresh()
  return {}
}

export async function archiveProject(projectId: string): Promise<Result> {
  const me = await requireMember()
  if (!(await ownProject(me.orgId, projectId))) return { error: "Project not found." }
  await db.update(project).set({ archived: true }).where(eq(project.id, projectId))
  refresh()
  return {}
}

// ---------- Tasks ----------

const taskFields = z.object({
  title: z.string().trim().min(1, "Give the task a title.").max(200),
  description: optionalText,
  projectId: z.string().min(1, "Pick a project."),
  assigneeId: z.string().nullable(),
  type: z.enum(TASK_TYPES),
  priority: z.enum(TASK_PRIORITIES),
  status: z.enum(TASK_STATUSES),
  progress: z.number().int().min(0).max(100),
  startDate: isoDate,
  deadline: isoDate,
})

export async function createTask(
  input: z.input<typeof taskFields>
): Promise<Result & { id?: string }> {
  const me = await requireMember()
  const parsed = taskFields.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const data = parsed.data
  if (!(await ownProject(me.orgId, data.projectId))) return { error: "Project not found." }
  if (data.assigneeId && !(await isMember(me.orgId, data.assigneeId)))
    return { error: "Assignee isn't in this workspace." }

  const [row] = await db
    .insert(task)
    .values({
      ...data,
      organizationId: me.orgId,
      createdById: me.user.id,
      completedAt: data.status === "completed" ? new Date() : null,
    })
    .returning({ id: task.id })
  await log(me.orgId, me.user.id, "task_created", { projectId: data.projectId, taskId: row.id })
  refresh()
  return { id: row.id }
}

const taskPatch = taskFields.partial()

export async function updateTask(taskId: string, patch: z.input<typeof taskPatch>): Promise<Result> {
  const me = await requireMember()
  const parsed = taskPatch.safeParse(patch)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const data = parsed.data
  const before = await ownTask(me.orgId, taskId)
  if (!before) return { error: "Task not found." }
  if (data.projectId && !(await ownProject(me.orgId, data.projectId))) return { error: "Project not found." }
  if (data.assigneeId && !(await isMember(me.orgId, data.assigneeId)))
    return { error: "Assignee isn't in this workspace." }

  const completedAt =
    data.status === undefined || data.status === before.status
      ? undefined
      : data.status === "completed"
        ? new Date()
        : null
  await db
    .update(task)
    .set({ ...data, ...(completedAt !== undefined && { completedAt }) })
    .where(eq(task.id, taskId))

  const ctx = { projectId: data.projectId ?? before.projectId, taskId }
  if (data.status && data.status !== before.status) {
    await log(me.orgId, me.user.id, data.status === "completed" ? "task_completed" : "status_changed", {
      ...ctx,
      data: { from: before.status, to: data.status },
    })
  }
  if (data.deadline !== undefined && data.deadline !== before.deadline) {
    await log(me.orgId, me.user.id, "deadline_changed", {
      ...ctx,
      data: { from: before.deadline, to: data.deadline },
    })
  }
  refresh()
  return {}
}

export async function deleteTask(taskId: string): Promise<Result> {
  const me = await requireMember()
  if (!(await ownTask(me.orgId, taskId))) return { error: "Task not found." }
  await db.delete(task).where(eq(task.id, taskId))
  refresh()
  return {}
}

// ---------- Sub-tasks & comments ----------

export async function addSubtask(taskId: string, title: string): Promise<Result> {
  const me = await requireMember()
  const parsed = z.string().trim().min(1).max(200).safeParse(title)
  if (!parsed.success) return { error: "Sub-task needs a title." }
  if (!(await ownTask(me.orgId, taskId))) return { error: "Task not found." }
  const [{ last }] = await db
    .select({ last: max(subtask.position) })
    .from(subtask)
    .where(eq(subtask.taskId, taskId))
  await db.insert(subtask).values({ taskId, title: parsed.data, position: (last ?? -1) + 1 })
  refresh()
  return {}
}

async function ownSubtask(orgId: string, subtaskId: string) {
  const row = await db.query.subtask.findFirst({
    where: eq(subtask.id, subtaskId),
    with: { task: { columns: { organizationId: true } } },
  })
  return row?.task.organizationId === orgId ? row : null
}

export async function toggleSubtask(subtaskId: string, done: boolean): Promise<Result> {
  const me = await requireMember()
  if (!(await ownSubtask(me.orgId, subtaskId))) return { error: "Sub-task not found." }
  await db.update(subtask).set({ done }).where(eq(subtask.id, subtaskId))
  refresh()
  return {}
}

export async function deleteSubtask(subtaskId: string): Promise<Result> {
  const me = await requireMember()
  if (!(await ownSubtask(me.orgId, subtaskId))) return { error: "Sub-task not found." }
  await db.delete(subtask).where(eq(subtask.id, subtaskId))
  refresh()
  return {}
}

export async function addComment(taskId: string, body: string): Promise<Result> {
  const me = await requireMember()
  const parsed = z.string().trim().min(1).max(5000).safeParse(body)
  if (!parsed.success) return { error: "Write something first." }
  if (!(await ownTask(me.orgId, taskId))) return { error: "Task not found." }
  await db.insert(comment).values({ taskId, authorId: me.user.id, body: parsed.data })
  refresh()
  return {}
}

// ---------- CEO share link ----------

export async function createShareLink(): Promise<Result & { token?: string }> {
  const me = await requireMember()
  if (me.role === "member") return { error: "Only owners and admins can manage the share link." }
  const token = newShareToken()
  // One live link per workspace: regenerating revokes the old one.
  await db.transaction(async (tx) => {
    await tx
      .update(shareLink)
      .set({ revokedAt: new Date() })
      .where(and(eq(shareLink.organizationId, me.orgId), isNull(shareLink.revokedAt)))
    await tx.insert(shareLink).values({
      organizationId: me.orgId,
      tokenHash: hashShareToken(token),
      createdById: me.user.id,
    })
  })
  refresh()
  return { token }
}

export async function revokeShareLink(): Promise<Result> {
  const me = await requireMember()
  if (me.role === "member") return { error: "Only owners and admins can manage the share link." }
  await db
    .update(shareLink)
    .set({ revokedAt: new Date() })
    .where(and(eq(shareLink.organizationId, me.orgId), isNull(shareLink.revokedAt)))
  refresh()
  return {}
}

// ---------- Integrations ----------

export async function setSlackWebhook(url: string | null): Promise<Result> {
  const me = await requireMember()
  if (me.role === "member") return { error: "Only owners and admins can change Slack." }
  let value: string | null = null
  if (url !== null) {
    value = url.trim()
    if (!/^https:\/\/hooks\.slack\.com\//.test(value)) return { error: "Paste a Slack incoming webhook URL." }
    try {
      await postToWebhook(value, "WeTrack is connected. Meeting links and reminders will appear here.")
    } catch {
      return { error: "Slack didn't accept that webhook." }
    }
  }
  await db
    .insert(workspaceIntegration)
    .values({ organizationId: me.orgId, slackWebhookUrl: value })
    .onConflictDoUpdate({ target: workspaceIntegration.organizationId, set: { slackWebhookUrl: value } })
  refresh()
  return {}
}

// ---------- Meetings ----------

const tz = () => process.env.APP_TIMEZONE ?? "Asia/Phnom_Penh"
const HHMM = /^\d{2}:\d{2}$/

const meetingInput = z.object({
  title: z.string().trim().min(1, "Give the meeting a title.").max(200, "Keep the title under 200 characters."),
  date: z.iso.date("Pick a date."),
  start: z.string().regex(HHMM, "Pick a start and end time."),
  end: z.string().regex(HHMM, "Pick a start and end time."),
  memberIds: z.array(z.string()).max(50, "Invite up to 50 people."),
  guests: z.string().max(2000, "That guest list is too long."),
  taskId: z.string().nullable(),
})

export async function createMeeting(
  input: z.input<typeof meetingInput>
): Promise<Result & { id?: string; warning?: string; needsGoogle?: true }> {
  const me = await requireMember()
  const parsed = meetingInput.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { title, date, start, end, memberIds, guests, taskId } = parsed.data

  const zone = tz()
  const slot = meetingSlot(date, start, end, zone)
  if ("error" in slot) return slot
  if (slot.startsAt.getTime() < Date.now() - 5 * 60_000) return { error: "Pick a time in the future." }

  const ids = [...new Set(memberIds)]
  const members = ids.length
    ? await db
        .select({ email: user.email })
        .from(member)
        .innerJoin(user, eq(user.id, member.userId))
        .where(and(eq(member.organizationId, me.orgId), inArray(member.userId, ids)))
    : []
  if (members.length !== ids.length) return { error: "Someone you picked isn't in this workspace." }

  const parsedGuests = parseEmails(guests)
  if (parsedGuests.invalid.length) return { error: `Check these emails: ${parsedGuests.invalid.join(", ")}` }

  // The organizer is stored as an attendee so "meetings I'm in" matches by email.
  const myEmail = me.user.email.toLowerCase()
  const emails = [...new Set([myEmail, ...members.map((m) => m.email.toLowerCase()), ...parsedGuests.emails])]
  if (emails.length > 50) return { error: "Invite up to 50 people." }

  const t = taskId ? await ownTask(me.orgId, taskId) : undefined
  if (taskId && !t) return { error: "Task not found." }

  const token = await googleToken(me.user.id)
  if (!token) return { error: "Connect Google Calendar first.", needsGoogle: true }

  const event = await createEvent(token, {
    title,
    description: t ? `From WeTrack: ${process.env.BETTER_AUTH_URL}/tasks/${t.id}` : "",
    slot,
    // Google adds the organizer itself.
    emails: emails.filter((e) => e !== myEmail),
    tz: zone,
  })
  if ("error" in event) return { error: event.error }

  const [row] = await db
    .insert(meeting)
    .values({
      organizationId: me.orgId,
      taskId: t?.id ?? null,
      createdById: me.user.id,
      title,
      ...slot,
      attendeeEmails: emails,
      googleEventId: event.id,
      meetUrl: event.meetUrl,
      calendarUrl: event.calendarUrl,
    })
    .returning()
  if (t) await log(me.orgId, me.user.id, "meeting_scheduled", { projectId: t.projectId, taskId: t.id, data: { title } })

  let warning: string | undefined
  try {
    await postSlack(me.orgId, slackCreated(row, me.user.name, zone))
  } catch {
    console.error("Slack post failed: meeting created")
    warning = "Meeting created, but Slack didn't get it."
  }
  refresh()
  return { id: row.id, warning }
}

export async function cancelMeeting(id: string): Promise<Result & { warning?: string }> {
  const me = await requireMember()
  const m = await db.query.meeting.findFirst({
    where: and(eq(meeting.id, id), eq(meeting.organizationId, me.orgId), isNull(meeting.canceledAt)),
  })
  if (!m) return { error: "Meeting not found." }
  if (m.createdById !== me.user.id && me.role === "member")
    return { error: "Only the organizer or an admin can cancel." }

  // The event lives on the creator's calendar, so only their token can delete it.
  const token = m.createdById ? await googleToken(m.createdById) : null
  const deleted = token ? await deleteEvent(token, m.googleEventId) : null
  const warning = deleted && "ok" in deleted ? undefined : "Cancelled here. Delete it in Google Calendar too."

  const done = await db
    .update(meeting)
    .set({ canceledAt: new Date() })
    .where(and(eq(meeting.id, m.id), isNull(meeting.canceledAt)))
    .returning({ id: meeting.id })
  if (!done.length) return { error: "Meeting not found." }

  try {
    await postSlack(me.orgId, slackCancelled(m, me.user.name, tz()))
  } catch {
    console.error("Slack post failed: meeting cancelled")
  }
  refresh()
  return { warning }
}

// ---------- Client updates ----------

const ALREADY_REPORTED = Symbol("already reported")

const clientUpdateInput = z.object({
  projectId: z.string().min(1),
  activityIds: z.array(z.string().min(1)).min(1, "Tick at least one item.").max(500),
  message: z.string().trim().min(1, "The message is empty.").max(10_000),
  itemCount: z.number().int().min(1),
})

export async function sendClientUpdate(input: z.input<typeof clientUpdateInput>): Promise<Result> {
  const me = await requireMember()
  const parsed = clientUpdateInput.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { projectId, activityIds, message, itemCount } = parsed.data
  const p = await ownProject(me.orgId, projectId)
  if (!p) return { error: "Project not found." }

  const stamped = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(clientUpdate)
      .values({ organizationId: me.orgId, projectId, sentById: me.user.id, message, itemCount })
      .returning({ id: clientUpdate.id })
    // Only stamp rows that belong to this project and are still unreported.
    const done = await tx
      .update(activity)
      .set({ reportedInUpdateId: row.id })
      .where(
        and(
          eq(activity.organizationId, me.orgId),
          eq(activity.projectId, projectId),
          isNull(activity.reportedInUpdateId),
          inArray(activity.id, activityIds)
        )
      )
      .returning({ id: activity.id })
    if (done.length === 0) throw ALREADY_REPORTED
    return done.length
  }).catch((e) => {
    if (e === ALREADY_REPORTED) return 0
    throw e
  })
  if (!stamped) return { error: "Those items were already reported. Refresh the page." }

  await log(me.orgId, me.user.id, "client_update_sent", { projectId, data: { project: p.name, items: itemCount } })
  refresh()
  return {}
}
