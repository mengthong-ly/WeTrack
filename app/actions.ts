"use server"

import { and, eq, gt, inArray, isNull, sql } from "drizzle-orm"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { inAgent } from "@/lib/agent"
import { AGENT_KEY_DAYS, AGENT_KEY_LIMIT, hashAgentKey, newAgentKey } from "@/lib/agent-key"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import {
  activity,
  agentKey,
  clientUpdate,
  comment,
  feedback,
  joinCode,
  logEntry,
  meeting,
  member,
  notification,
  project,
  PROJECT_LINK_KINDS,
  projectLink,
  pushSubscription,
  shareLink,
  task,
  taskAssignee,
  taskView,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TYPES,
  user,
  workspaceIntegration,
} from "@/lib/db/schema"
import { createEvent, deleteEvent, googleToken } from "@/lib/google"
import { JOIN_CODE_DAYS, newJoinCode, normalizeJoinCode } from "@/lib/join-code"
import {
  formatSlot,
  googleError,
  joinUrl,
  LEAD_MINUTES,
  meetingSlot,
  slackCancelled,
  slackMeetingCard,
} from "@/lib/meetings"
import { normalizeLink } from "@/lib/link"
import { plainText } from "@/lib/markdown"
import { isPushEndpoint } from "@/lib/notifications"
import { notify } from "@/lib/notify"
import { listSubtasks } from "@/lib/queries"
import { todayISO } from "@/lib/schedule"
import { getSession, requireMember } from "@/lib/session"
import { toBrowserTask } from "@/lib/task-view"
import { hashShareToken, newShareToken } from "@/lib/share"
import { deleteImage, isImage, saveImage } from "@/lib/storage"
import { attachmentSrc } from "@/lib/utils"
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

// Records who did what in the Logs. Called after an action has succeeded; a failure here is logged, never shown,
// so the log can't break the thing people just did.
async function audit(
  actor: { orgId: string; user: { id: string } },
  action: string,
  rest: { targetId?: string | null; projectId?: string | null; label?: string | null; data?: Record<string, unknown> } = {}
) {
  // Calls made with an API key (lib/agent.ts) are marked so the Logs can tell them from clicks.
  const data = { ...rest.data, ...(inAgent() && { via: "agent" }) }
  try {
    await db.insert(logEntry).values({
      organizationId: actor.orgId,
      actorId: actor.user.id,
      action,
      ...rest,
      data: Object.keys(data).length ? data : undefined,
    })
  } catch (e) {
    console.error(`Log failed: ${action}`, e)
  }
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
  if (!parsed.success) return { error: "Team name must be 2–60 characters." }
  const slug = `${parsed.data.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${crypto.randomUUID().slice(0, 6)}`
  await auth.api.createOrganization({ headers: await headers(), body: { name: parsed.data, slug } })
  redirect("/")
}

// ---------- Join code & people ----------

export async function createJoinCode(): Promise<Result> {
  const me = await requireMember()
  if (me.role === "member") return { error: "Only owners and admins can share a join code." }
  const row = {
    code: newJoinCode(),
    createdById: me.user.id,
    expiresAt: new Date(Date.now() + JOIN_CODE_DAYS * 86_400_000),
    createdAt: new Date(),
  }
  await db
    .insert(joinCode)
    .values({ organizationId: me.orgId, ...row })
    .onConflictDoUpdate({ target: joinCode.organizationId, set: row })
  await audit(me, "join_code.create")
  refresh()
  return {}
}

export async function turnOffJoinCode(): Promise<Result> {
  const me = await requireMember()
  if (me.role === "member") return { error: "Only owners and admins can share a join code." }
  await db.delete(joinCode).where(eq(joinCode.organizationId, me.orgId))
  await audit(me, "join_code.off")
  refresh()
  return {}
}

export async function joinWithCode(input: string): Promise<Result> {
  const session = await getSession()
  if (!session) redirect("/sign-in")
  const code = normalizeJoinCode(input)
  if (!code) return { error: "A join code is 12 letters and numbers, like ABCD-2345-WXYZ." }
  if (await db.query.member.findFirst({ where: eq(member.userId, session.user.id) })) redirect("/")
  const row = await db.query.joinCode.findFirst({
    where: and(eq(joinCode.code, code), gt(joinCode.expiresAt, new Date())),
  })
  if (!row) return { error: "That code doesn't work. It may have expired: ask your team for a new one." }
  try {
    await auth.api.addMember({ body: { userId: session.user.id, organizationId: row.organizationId, role: "member" } })
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not join the team." }
  }
  await audit({ orgId: row.organizationId, user: session.user }, "member.join")
  redirect("/")
}

// Owners manage people. Better Auth checks the same rule (lib/auth.ts); this gives a clear message.
async function managedMember(userId: string) {
  const me = await requireMember()
  if (me.role !== "owner") return { error: "Only the owner can manage people." }
  const target = await db.query.member.findFirst({
    where: and(eq(member.organizationId, me.orgId), eq(member.userId, userId)),
  })
  if (!target || target.role === "owner") return { error: "Teammate not found." }
  return { me, target }
}

export async function setMemberRole(userId: string, role: "admin" | "member"): Promise<Result> {
  const parsed = z.enum(["admin", "member"]).safeParse(role)
  if (!parsed.success) return { error: "Pick admin or member." }
  const found = await managedMember(userId)
  if ("error" in found) return found
  try {
    await auth.api.updateMemberRole({
      headers: await headers(),
      body: { memberId: found.target.id, role: parsed.data, organizationId: found.me.orgId },
    })
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not change the role." }
  }
  await audit(found.me, "member.role", { targetId: userId, data: { role: parsed.data } })
  refresh()
  return {}
}

export async function removeMember(userId: string): Promise<Result> {
  const found = await managedMember(userId)
  if ("error" in found) return found
  try {
    await auth.api.removeMember({
      headers: await headers(),
      body: { memberIdOrEmail: found.target.id, organizationId: found.me.orgId },
    })
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not remove them." }
  }
  await audit(found.me, "member.remove", { targetId: userId })
  refresh()
  return {}
}

// Owners and admins rename the team. Better Auth enforces the same rule (lib/auth.ts).
export async function renameTeam(name: string): Promise<Result> {
  const me = await requireMember()
  if (me.role === "member") return { error: "Only owners and admins can rename the team." }
  const parsed = z.string().trim().min(2).max(60).safeParse(name)
  if (!parsed.success) return { error: "Team name must be 2–60 characters." }
  try {
    await auth.api.updateOrganization({ headers: await headers(), body: { data: { name: parsed.data }, organizationId: me.orgId } })
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not rename the team." }
  }
  await audit(me, "team.rename", { data: { name: parsed.data } })
  refresh()
  return {}
}

// Anyone but the owner can leave; their tasks stay as they are. They land on /onboarding to join or start a team.
export async function leaveTeam(): Promise<Result> {
  const me = await requireMember()
  if (me.role === "owner") return { error: "The owner can't leave. Hand the team over first." }
  try {
    await auth.api.leaveOrganization({ headers: await headers(), body: { organizationId: me.orgId } })
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not leave the team." }
  }
  await audit(me, "team.leave")
  redirect("/onboarding")
}

// ---------- Projects ----------

const projectDescription = z.string().trim().max(2000, "Keep the description under 2000 characters.").transform((s) => s || null)

const projectInput = z.object({
  name: z.string().trim().min(1, "Name the project.").max(60),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
})

// A project's named links (staging, production, a Figma file …), saved with the project: the list sent replaces the one stored.
const linkInput = z.object({
  kind: z.enum(PROJECT_LINK_KINDS),
  title: z.string().trim().min(1, "Give each link a title.").max(80),
  url: z
    .string()
    .transform((u, ctx) => normalizeLink(u) ?? (ctx.addIssue({ code: "custom", message: "That link isn't a web address." }), z.NEVER)),
})
const parseJson = (v: FormDataEntryValue | null): unknown => {
  try {
    return JSON.parse(String(v || "[]"))
  } catch {
    return null
  }
}
const linksInput = z.array(linkInput).max(30, "A project holds up to 30 links.")

async function replaceLinks(orgId: string, projectId: string, links: z.output<typeof linksInput>) {
  await db.transaction(async (tx) => {
    await tx.delete(projectLink).where(eq(projectLink.projectId, projectId))
    if (links.length) await tx.insert(projectLink).values(links.map((l, i) => ({ ...l, organizationId: orgId, projectId, createdAt: new Date(Date.now() + i) })))
  })
}

// From the /create page: name, colour, an optional description and an optional logo image, as form data.
export async function createProject(form: FormData): Promise<Result & { id?: string }> {
  const me = await requireMember()
  const parsed = projectInput.safeParse({ name: form.get("name") ?? "", color: form.get("color") ?? "" })
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const description = projectDescription.safeParse(form.get("description") ?? "")
  if (!description.success) return { error: description.error.issues[0].message }
  const links = linksInput.safeParse(parseJson(form.get("links")))
  if (!links.success) return { error: links.error.issues[0].message }
  const logo = form.get("logo")
  const file = isImage(logo) ? logo : null
  if (logo instanceof File && logo.size && !file) return { error: "Logos must be images under 4 MB." }
  const logoId = file && (await saveImage(me.orgId, me.user.id, file))
  const [row] = await db
    .insert(project)
    .values({ organizationId: me.orgId, ...parsed.data, description: description.data, logoId })
    .returning({ id: project.id })
  await replaceLinks(me.orgId, row.id, links.data)
  await audit(me, "project.create", { projectId: row.id, targetId: row.id, label: parsed.data.name })
  refresh()
  return { id: row.id }
}

// Rename or recolour; either field may be left out.
const projectPatch = projectInput.partial().extend({ description: projectDescription.optional(), links: linksInput.optional() })

export async function updateProject(projectId: string, patch: z.input<typeof projectPatch>): Promise<Result> {
  const me = await requireMember()
  const parsed = projectPatch.safeParse(patch)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const p = await ownProject(me.orgId, projectId)
  if (!p) return { error: "Project not found." }
  const { links, ...fields } = parsed.data
  if (!Object.keys(fields).length && !links) return {}
  if (Object.keys(fields).length) await db.update(project).set(fields).where(eq(project.id, projectId))
  if (links) await replaceLinks(me.orgId, projectId, links)
  await audit(me, "project.update", { projectId, targetId: projectId, label: fields.name ?? p.name, data: { changed: Object.keys(parsed.data) } })
  refresh()
  return {}
}

export async function archiveProject(projectId: string): Promise<Result> {
  return setArchived(projectId, true)
}

export async function restoreProject(projectId: string): Promise<Result> {
  return setArchived(projectId, false)
}

// Sets the project's logo from `logo` in the form, or removes it when the form has none.
export async function setProjectLogo(projectId: string, form: FormData): Promise<Result> {
  const me = await requireMember()
  const p = await ownProject(me.orgId, projectId)
  if (!p) return { error: "Project not found." }
  const logo = form.get("logo")
  const file = isImage(logo) ? logo : null
  if (logo && !file) return { error: "Logos must be images under 4 MB." }
  const logoId = file && (await saveImage(me.orgId, me.user.id, file))
  await db.update(project).set({ logoId }).where(eq(project.id, projectId))
  await deleteImage(p.logoId)
  await audit(me, "project.logo", { projectId, targetId: projectId, label: p.name, data: { removed: !file } })
  refresh()
  return {}
}

async function setArchived(projectId: string, archived: boolean): Promise<Result> {
  const me = await requireMember()
  const p = await ownProject(me.orgId, projectId)
  if (!p) return { error: "Project not found." }
  await db.update(project).set({ archived }).where(eq(project.id, projectId))
  await audit(me, archived ? "project.archive" : "project.restore", { projectId, targetId: projectId, label: p.name })
  refresh()
  return {}
}

// Deleting is for owners and admins and only from the Archive: it takes the project's tasks, feedback and updates with it.
export async function deleteProject(projectId: string): Promise<Result> {
  const me = await requireMember()
  if (me.role === "member") return { error: "Only owners and admins can delete a project." }
  const p = await ownProject(me.orgId, projectId)
  if (!p) return { error: "Project not found." }
  if (!p.archived) return { error: "Archive the project first." }
  await db.delete(project).where(eq(project.id, projectId))
  await deleteImage(p.logoId)
  await audit(me, "project.delete", { projectId, targetId: projectId, label: p.name })
  refresh()
  return {}
}

// ---------- Tasks ----------

// "Seen": when someone last opened a task. Home lists the tasks that changed after that. A person's own edits count as
// opening, so they never show up as news to themselves.
async function touchSeen(userId: string, taskIds: string[]) {
  if (!taskIds.length) return
  await db
    .insert(taskView)
    .values(taskIds.map((taskId) => ({ taskId, userId })))
    .onConflictDoUpdate({ target: [taskView.taskId, taskView.userId], set: { viewedAt: new Date() } })
}

// Opening a task page.
export async function markTaskSeen(taskId: string): Promise<void> {
  const me = await requireMember()
  if (await ownTask(me.orgId, taskId)) await touchSeen(me.user.id, [taskId])
}

// "Mark seen" on Home, one task or all listed.
export async function markTasksSeen(taskIds: string[]): Promise<void> {
  const me = await requireMember()
  const own = await db.select({ id: task.id }).from(task).where(and(eq(task.organizationId, me.orgId), inArray(task.id, taskIds.slice(0, 200))))
  await touchSeen(me.user.id, own.map((t) => t.id))
  revalidatePath("/")
}

const taskFields = z.object({
  title: z.string().trim().min(1, "Give the task a title.").max(200),
  description: optionalText,
  projectId: z.string().min(1, "Pick a project."),
  /** The lead assignee alone (the 3D workspace, quick capture); `assigneeIds` is everyone, and wins when both are sent. */
  assigneeId: z.string().nullable(),
  assigneeIds: z.array(z.string()).max(20).optional(),
  type: z.enum(TASK_TYPES),
  priority: z.enum(TASK_PRIORITIES),
  status: z.enum(TASK_STATUSES),
  progress: z.number().int().min(0).max(100),
  startDate: isoDate,
  deadline: isoDate,
  /** A sub-task: it goes in its parent's project. */
  parentId: z.string().nullish(),
})

// Who a task goes to, from whichever of `assigneeIds` / `assigneeId` was sent (undefined: leave as is). The first is the
// lead and also lands in task.assigneeId.
async function resolveAssignees(orgId: string, d: { assigneeId?: string | null; assigneeIds?: string[] }): Promise<{ ids?: string[]; error?: string }> {
  const ids = d.assigneeIds ? [...new Set(d.assigneeIds)] : d.assigneeId === undefined ? undefined : d.assigneeId ? [d.assigneeId] : []
  if (ids?.length) {
    const found = await db.$count(member, and(eq(member.organizationId, orgId), inArray(member.userId, ids)))
    if (found !== ids.length) return { error: "Assignee isn't in this workspace." }
  }
  return { ids }
}

async function setTaskAssignees(taskId: string, ids: string[]) {
  await db.transaction(async (tx) => {
    await tx.delete(taskAssignee).where(eq(taskAssignee.taskId, taskId))
    if (ids.length) await tx.insert(taskAssignee).values(ids.map((userId) => ({ taskId, userId })))
  })
}

export async function createTask(
  input: z.input<typeof taskFields>
): Promise<Result & { id?: string }> {
  const me = await requireMember()
  const parsed = taskFields.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const data = parsed.data
  if (data.parentId) {
    const parent = await ownTask(me.orgId, data.parentId)
    if (!parent) return { error: "Parent task not found." }
    data.projectId = parent.projectId
  }
  if (!(await ownProject(me.orgId, data.projectId))) return { error: "Project not found." }
  const who = await resolveAssignees(me.orgId, data)
  if (who.error) return { error: who.error }
  const { assigneeIds: _ignored, ...fields } = data
  const assignees = who.ids ?? []

  const [row] = await db
    .insert(task)
    .values({
      ...fields,
      assigneeId: assignees[0] ?? null,
      organizationId: me.orgId,
      createdById: me.user.id,
      completedAt: data.status === "completed" ? new Date() : null,
    })
    .returning({ id: task.id })
  await setTaskAssignees(row.id, assignees)
  await touchSeen(me.user.id, [row.id])
  await log(me.orgId, me.user.id, "task_created", { projectId: data.projectId, taskId: row.id })
  await notify({ orgId: me.orgId, actor: me.user, kind: "assigned", to: assignees, subject: data.title, taskId: row.id })
  await audit(me, "task.create", { projectId: data.projectId, targetId: row.id, label: data.title })
  refresh()
  return { id: row.id }
}

const taskPatch = taskFields.omit({ parentId: true }).partial() // a task stays where it was made

export async function updateTask(taskId: string, patch: z.input<typeof taskPatch>): Promise<Result> {
  const me = await requireMember()
  const parsed = taskPatch.safeParse(patch)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const data = parsed.data
  const before = await ownTask(me.orgId, taskId)
  if (!before) return { error: "Task not found." }
  if (data.projectId && !(await ownProject(me.orgId, data.projectId))) return { error: "Project not found." }
  const who = await resolveAssignees(me.orgId, data)
  if (who.error) return { error: who.error }
  const { assigneeIds: _ignored, ...fields } = data
  const assignedBefore = (await db.select({ id: taskAssignee.userId }).from(taskAssignee).where(eq(taskAssignee.taskId, taskId))).map((r) => r.id)

  const completedAt =
    data.status === undefined || data.status === before.status
      ? undefined
      : data.status === "completed"
        ? new Date()
        : null
  await db
    .update(task)
    .set({ ...fields, ...(who.ids && { assigneeId: who.ids[0] ?? null }), ...(completedAt !== undefined && { completedAt }) })
    .where(eq(task.id, taskId))
  if (who.ids) await setTaskAssignees(taskId, who.ids)
  await touchSeen(me.user.id, [taskId])

  // Feedback on a task lives in the task's project, so it moves with it.
  if (data.projectId && data.projectId !== before.projectId)
    await db.update(feedback).set({ projectId: data.projectId }).where(eq(feedback.taskId, taskId))

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

  // The new assignee hears they have it; whoever owns or made the task hears it moved.
  const notice = { orgId: me.orgId, actor: me.user, subject: data.title ?? before.title, taskId }
  const assignedNow = who.ids ?? assignedBefore
  const watchers = [...assignedNow, before.createdById]
  const added = assignedNow.filter((id) => !assignedBefore.includes(id))
  if (added.length) await notify({ ...notice, kind: "assigned", to: added })
  if (data.status && data.status !== before.status)
    await notify({
      ...notice,
      kind: data.status === "completed" ? "completed" : "status_changed",
      to: watchers,
      data: { from: before.status, to: data.status },
    })
  if (data.deadline !== undefined && data.deadline !== before.deadline)
    await notify({ ...notice, kind: "deadline_changed", to: watchers, data: { from: before.deadline, to: data.deadline } })
  await audit(me, "task.update", { projectId: ctx.projectId, targetId: taskId, label: data.title ?? before.title, data: { changed: Object.keys(data) } })
  refresh()
  return {}
}

export async function deleteTask(taskId: string): Promise<Result> {
  const me = await requireMember()
  const t = await ownTask(me.orgId, taskId)
  if (!t) return { error: "Task not found." }
  await db.delete(task).where(eq(task.id, taskId))
  await audit(me, "task.delete", { projectId: t.projectId, targetId: taskId, label: t.title })
  refresh()
  return {}
}

// ---------- Sub-tasks & comments ----------

// A task's direct sub-tasks as table rows, for the Tasks table's expand arrow. Each carries its own sub-task count, so a
// row with children of its own expands in turn.
export async function loadSubtasks(parentId: string) {
  const me = await requireMember()
  const today = todayISO()
  const rows = await listSubtasks(me.orgId, parentId)
  return rows.map((t) => toBrowserTask({ ...t, body: null }, today))
}

// Quick add from the parent's page: a full task under it, in its project, not started. Ticking and
// deleting a sub-task use updateTask and deleteTask like any task.
export async function addSubtask(parentId: string, title: string): Promise<Result & { id?: string }> {
  const me = await requireMember()
  const parsed = z.string().trim().min(1).max(200).safeParse(title)
  if (!parsed.success) return { error: "Sub-task needs a title." }
  const parent = await ownTask(me.orgId, parentId)
  if (!parent) return { error: "Task not found." }
  const [row] = await db
    .insert(task)
    .values({
      organizationId: me.orgId,
      projectId: parent.projectId,
      parentId,
      createdById: me.user.id,
      title: parsed.data,
    })
    .returning({ id: task.id })
  await touchSeen(me.user.id, [row.id, parentId])
  await log(me.orgId, me.user.id, "task_created", { projectId: parent.projectId, taskId: row.id })
  await audit(me, "task.create", { projectId: parent.projectId, targetId: row.id, label: parsed.data, data: { parentId } })
  refresh()
  return { id: row.id }
}

export async function addComment(taskId: string, body: string): Promise<Result> {
  const me = await requireMember()
  const parsed = z.string().trim().min(1).max(5000).safeParse(body)
  if (!parsed.success) return { error: "Write something first." }
  const t = await ownTask(me.orgId, taskId)
  if (!t) return { error: "Task not found." }
  await db.insert(comment).values({ taskId, authorId: me.user.id, body: parsed.data })
  await touchSeen(me.user.id, [taskId])
  // The assignee, the creator and everyone already in the thread.
  const thread = await db.selectDistinct({ id: comment.authorId }).from(comment).where(eq(comment.taskId, taskId))
  const assigned = await db.select({ id: taskAssignee.userId }).from(taskAssignee).where(eq(taskAssignee.taskId, taskId))
  await notify({
    orgId: me.orgId,
    actor: me.user,
    kind: "commented",
    to: [...assigned.map((a) => a.id), t.createdById, ...thread.map((c) => c.id)],
    subject: t.title,
    taskId,
    data: { preview: plainText(parsed.data).slice(0, 140) },
  })
  await audit(me, "comment.create", { projectId: t.projectId, targetId: taskId, label: t.title })
  refresh()
  return {}
}

// ---------- Images ----------

// An image pasted into a task description or comment. The Markdown links to it by URL.
export async function uploadImage(form: FormData): Promise<Result & { src?: string }> {
  const me = await requireMember()
  const image = form.get("image")
  if (!isImage(image)) return { error: "Images must be under 4 MB." }
  return { src: attachmentSrc(await saveImage(me.orgId, me.user.id, image)) }
}

// ---------- Feedback ----------

// One piece of feedback for a teammate: a note in `body`, its screenshots inline (uploaded as it's written).
// With a `taskId` it goes to whoever the task is assigned to now, in the task's project; without one, to
// `recipientId`, in `projectId` (the project it was given in).
export async function createFeedback(form: FormData): Promise<Result> {
  const me = await requireMember()
  const taskId = String(form.get("taskId") ?? "")
  const t = taskId ? await ownTask(me.orgId, taskId) : null
  if (taskId && !t) return { error: "That task no longer exists." }
  const projectId = t?.projectId ?? String(form.get("projectId") ?? "")
  if (!(await ownProject(me.orgId, projectId))) return { error: "Project not found." }
  const recipientId = t ? t.assigneeId : String(form.get("recipientId") ?? "") || null
  if (!t && !recipientId) return { error: "Pick who it's for, or a task." }
  if (!t && recipientId && !(await isMember(me.orgId, recipientId))) return { error: "Pick someone on the team." }
  const body = String(form.get("body") ?? "").trim().slice(0, 20000)
  if (!body) return { error: "Write a note or add a screenshot." }
  const [row] = await db
    .insert(feedback)
    .values({
      organizationId: me.orgId,
      projectId,
      taskId: t?.id ?? null,
      authorId: me.user.id,
      recipientId,
      body,
    })
    .returning({ id: feedback.id })
  await notify({
    orgId: me.orgId,
    actor: me.user,
    kind: "feedback",
    to: [recipientId],
    subject: t?.title ?? (plainText(body).slice(0, 140) || null),
    taskId: t?.id,
    feedbackId: row.id,
  })
  await audit(me, "feedback.create", { projectId, targetId: row.id, label: t?.title })
  refresh()
  return {}
}

async function ownFeedback(orgId: string, id: string) {
  return db.query.feedback.findFirst({
    columns: { id: true, authorId: true, body: true, imageId: true },
    where: and(eq(feedback.id, id), eq(feedback.organizationId, orgId)),
  })
}

export async function setFeedbackResolved(id: string, resolved: boolean): Promise<Result> {
  const me = await requireMember()
  if (!(await ownFeedback(me.orgId, id))) return { error: "Feedback not found." }
  await db.update(feedback).set({ resolvedAt: resolved ? new Date() : null }).where(eq(feedback.id, id))
  await audit(me, resolved ? "feedback.resolve" : "feedback.reopen", { targetId: id })
  refresh()
  return {}
}

export async function updateFeedback(id: string, text: string): Promise<Result> {
  const me = await requireMember()
  const row = await ownFeedback(me.orgId, id)
  if (!row) return { error: "Feedback not found." }
  if (row.authorId !== me.user.id && me.role === "member") return { error: "Only the person who wrote it can edit it." }
  const body = text.trim().slice(0, 5000)
  if (!body && !row.imageId) return { error: "Write a note, or delete the feedback." }
  await db.update(feedback).set({ body: body || null }).where(eq(feedback.id, id))
  await audit(me, "feedback.update", { targetId: id })
  refresh()
  return {}
}

export async function deleteFeedback(id: string): Promise<Result> {
  const me = await requireMember()
  const row = await ownFeedback(me.orgId, id)
  if (!row) return { error: "Feedback not found." }
  if (row.authorId !== me.user.id && me.role === "member") return { error: "Only the person who wrote it can delete it." }
  await db.delete(feedback).where(eq(feedback.id, id))
  await deleteImage(row.imageId)
  await audit(me, "feedback.delete", { targetId: id })
  refresh()
  return {}
}

// Adds or replaces a feedback's screenshot from `image` in the form, or removes it when the form has none.
export async function setFeedbackImage(id: string, form: FormData): Promise<Result> {
  const me = await requireMember()
  const row = await ownFeedback(me.orgId, id)
  if (!row) return { error: "Feedback not found." }
  if (row.authorId !== me.user.id && me.role === "member") return { error: "Only the person who wrote it can edit it." }
  const image = form.get("image")
  const file = isImage(image) ? image : null
  if (image && !file) return { error: "Screenshots must be images under 4 MB." }
  if (!file && !row.body) return { error: "Write a note first, or delete the feedback." }
  const imageId = file && (await saveImage(me.orgId, me.user.id, file))
  await db.update(feedback).set({ imageId }).where(eq(feedback.id, id))
  await deleteImage(row.imageId)
  await audit(me, "feedback.image", { targetId: id, data: { removed: !file } })
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
  await audit(me, "share_link.create")
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
  await audit(me, "share_link.revoke")
  refresh()
  return {}
}

// Personal API keys for Claude Code and scripts. Any member manages their own; only the hash is stored, so the
// plain key is returned once here and never again (and never logged).
export async function createAgentKey(name: string): Promise<Result & { key?: string }> {
  const me = await requireMember()
  const parsed = z.string().trim().min(1).max(60).safeParse(name)
  if (!parsed.success) return { error: "Name the key, up to 60 characters." }
  const mine = and(eq(agentKey.organizationId, me.orgId), eq(agentKey.userId, me.user.id))
  // ponytail: count-then-insert, two simultaneous creates could make a 6th key; lock the user's rows if that matters.
  const live = await db.$count(agentKey, and(mine, isNull(agentKey.revokedAt), gt(agentKey.expiresAt, new Date())))
  if (live >= AGENT_KEY_LIMIT) return { error: `You can have ${AGENT_KEY_LIMIT} live keys. Revoke one first.` }
  const key = newAgentKey()
  const [row] = await db
    .insert(agentKey)
    .values({
      organizationId: me.orgId,
      userId: me.user.id,
      name: parsed.data,
      tokenHash: hashAgentKey(key),
      expiresAt: new Date(Date.now() + AGENT_KEY_DAYS * 86_400_000),
    })
    .returning({ id: agentKey.id })
  await audit(me, "agent_key.create", { targetId: row.id, label: parsed.data })
  refresh()
  return { key }
}

export async function revokeAgentKey(id: string): Promise<Result> {
  const me = await requireMember()
  const [row] = await db
    .update(agentKey)
    .set({ revokedAt: new Date() })
    .where(
      and(eq(agentKey.id, id), eq(agentKey.organizationId, me.orgId), eq(agentKey.userId, me.user.id), isNull(agentKey.revokedAt))
    )
    .returning({ name: agentKey.name })
  if (!row) return { error: "Key not found." }
  await audit(me, "agent_key.revoke", { targetId: id, label: row.name })
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
  await audit(me, url ? "slack.connect" : "slack.disconnect")
  refresh()
  return {}
}

// ---------- Meetings ----------

const tz = () => process.env.APP_TIMEZONE ?? "Asia/Phnom_Penh"
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

const meetingInput = z.object({
  title: z.string().trim().min(1, "Give the meeting a title.").max(200, "Keep the title under 200 characters."),
  date: z.iso.date("Pick a date."),
  start: z.string().regex(HHMM, "Pick a start and end time."),
  end: z.string().regex(HHMM, "Pick a start and end time."),
  memberIds: z.array(z.string()).max(50, "Invite up to 50 people."),
  taskId: z.string().nullable(),
  description: z.string().trim().max(2000, "Keep the description under 2000 characters.").optional(),
  postToSlack: z.boolean().default(true),
})

export async function createMeeting(
  input: z.input<typeof meetingInput>
): Promise<Result & { id?: string; joinUrl?: string | null; warning?: string; needsGoogle?: true }> {
  const me = await requireMember()
  const parsed = meetingInput.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { title, date, start, end, memberIds, taskId, description, postToSlack } = parsed.data

  const zone = tz()
  const slot = meetingSlot(date, start, end, zone)
  if ("error" in slot) return slot
  if (slot.startsAt.getTime() < Date.now() - 5 * 60_000) return { error: "Pick a time in the future." }

  const ids = [...new Set(memberIds)]
  const members = ids.length
    ? await db
        .select({ id: user.id, email: user.email, name: user.name })
        .from(member)
        .innerJoin(user, eq(user.id, member.userId))
        .where(and(eq(member.organizationId, me.orgId), inArray(member.userId, ids)))
    : []
  if (members.length !== ids.length) return { error: "Someone you picked isn't in this workspace." }

  // The organizer is stored as an attendee so "meetings I'm in" matches by email.
  const myEmail = me.user.email.toLowerCase()
  const emails = [...new Set([myEmail, ...members.map((m) => m.email.toLowerCase())])]
  if (emails.length > 50) return { error: "Invite up to 50 people." }

  const t = taskId ? await ownTask(me.orgId, taskId) : undefined
  if (taskId && !t) return { error: "Task not found." }

  const token = await googleToken(me.user.id)
  if (!token) return { error: "Connect Google Calendar first.", needsGoogle: true }

  const event = await createEvent(token, {
    title,
    description: [description, t && `From WeTrack: ${process.env.BETTER_AUTH_URL}/tasks/${t.id}`].filter(Boolean).join("\n\n"),
    slot,
    // Google adds the organizer itself.
    emails: emails.filter((e) => e !== myEmail),
    tz: zone,
  })
  if ("error" in event) {
    // 401 and 403 both mean the grant is gone or too narrow: reconnecting fixes it.
    const reconnect = event.error === googleError(401) || event.error === googleError(403)
    return reconnect ? { error: event.error, needsGoogle: true } : { error: event.error }
  }

  // Google has already emailed the invites, so a failed save must take the event back out.
  let row: typeof meeting.$inferSelect
  try {
    row = await db.transaction(async (tx) => {
      const [r] = await tx
        .insert(meeting)
        .values({
          organizationId: me.orgId,
          taskId: t?.id ?? null,
          createdById: me.user.id,
          title,
          description: description || null,
          ...slot,
          attendeeEmails: emails,
          googleEventId: event.id,
          meetUrl: event.meetUrl,
          calendarUrl: event.calendarUrl,
          // Inside the reminder window the create post below already tells Slack, so the cron skips it.
          remindedAt: postToSlack && slot.startsAt.getTime() - Date.now() <= LEAD_MINUTES * 60_000 ? new Date() : null,
        })
        .returning()
      if (t)
        await tx.insert(activity).values({
          organizationId: me.orgId,
          actorId: me.user.id,
          kind: "meeting_scheduled",
          projectId: t.projectId,
          taskId: t.id,
          data: { title },
        })
      return r
    })
  } catch {
    console.error("Meeting save failed: removing the Google event")
    await deleteEvent(token, event.id)
    return { error: "Couldn't save the meeting. Try again." }
  }

  await notify({
    orgId: me.orgId,
    actor: me.user,
    kind: "meeting_invited",
    to: members.map((m) => m.id),
    subject: title,
    taskId: t?.id,
    data: { subject: title, preview: formatSlot(slot, zone) },
  })

  let warning: string | undefined
  try {
    const names = [me.user.name, ...members.map((m) => m.name)]
    if (postToSlack) await postSlack(me.orgId, slackMeetingCard(row, me.user.name, zone, [...new Set(names)]))
  } catch {
    console.error("Slack post failed: meeting created")
    warning = "Meeting created, but Slack didn't get it."
  }
  await audit(me, "meeting.create", { projectId: t?.projectId, targetId: row.id, label: title })
  refresh()
  return { id: row.id, joinUrl: joinUrl(row), warning }
}

/** Posts the meeting card again, for a meeting created without it or one people should be reminded of. */
export async function sendMeetingToSlack(id: string): Promise<Result> {
  const me = await requireMember()
  const m = await db.query.meeting.findFirst({
    where: and(eq(meeting.id, id), eq(meeting.organizationId, me.orgId), isNull(meeting.canceledAt)),
  })
  if (!m) return { error: "Meeting not found." }
  // Same rule as cancelMeeting.
  if (m.createdById !== me.user.id && me.role === "member")
    return { error: "Only the organizer or an admin can send it to Slack." }

  // Workspace members by name, guests by email; the organizer first.
  const people = await db
    .select({ id: user.id, email: user.email, name: user.name })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(eq(member.organizationId, me.orgId))
  const byEmail = new Map(people.map((p) => [p.email.toLowerCase(), p.name]))
  const organizer = people.find((p) => p.id === m.createdById)?.name ?? me.user.name
  const names = [organizer, ...m.attendeeEmails.map((e) => byEmail.get(e) ?? e)]

  try {
    const sent = await postSlack(me.orgId, slackMeetingCard(m, organizer, tz(), [...new Set(names)]))
    if (sent === "skipped") return { error: "Connect Slack on the Team page first." }
  } catch {
    console.error(`Slack post failed: meeting ${m.id} sent`)
    return { error: "Slack didn't accept the message. Try again." }
  }
  await audit(me, "meeting.slack", { targetId: m.id, label: m.title })
  return {}
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
  let warning: string | undefined
  if (!deleted || "error" in deleted) {
    if (m.createdById === me.user.id) {
      warning = "Cancelled in WeTrack. Delete it in Google Calendar too so guests are told."
    } else {
      const creator = m.createdById
        ? await db.query.user.findFirst({ columns: { name: true }, where: eq(user.id, m.createdById) })
        : undefined
      const first = creator?.name.split(" ")[0] || "the organizer"
      warning = `Cancelled in WeTrack. Ask ${first} to delete it in Google Calendar so guests are told.`
    }
  }

  const done = await db
    .update(meeting)
    .set({ canceledAt: new Date() })
    .where(and(eq(meeting.id, m.id), isNull(meeting.canceledAt)))
    .returning({ id: meeting.id })
  if (!done.length) return { error: "Meeting not found." }

  // Attendees are emails (guests may have no account): tell the ones on the team.
  const invited = await db
    .select({ id: user.id })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(and(eq(member.organizationId, me.orgId), inArray(sql`lower(${user.email})`, m.attendeeEmails)))
  await notify({
    orgId: me.orgId,
    actor: me.user,
    kind: "meeting_cancelled",
    to: [m.createdById, ...invited.map((u) => u.id)],
    subject: m.title,
    taskId: m.taskId,
    data: { subject: m.title, preview: formatSlot(m, tz()) },
  })

  try {
    await postSlack(me.orgId, slackCancelled(m, me.user.name, tz()))
  } catch {
    console.error("Slack post failed: meeting cancelled")
  }
  await audit(me, "meeting.cancel", { targetId: m.id, label: m.title })
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
  await audit(me, "client_update.send", { projectId, label: p.name, data: { items: itemCount } })
  refresh()
  return {}
}

// ---------- Notifications ----------

// Opening the inbox: everything in it counts as seen. No refresh: the inbox already shows it.
export async function markNotificationsRead(): Promise<Result> {
  const me = await requireMember()
  await db
    .update(notification)
    .set({ readAt: new Date() })
    .where(and(eq(notification.recipientId, me.user.id), isNull(notification.readAt)))
  return {}
}

const pushSub = z.object({
  endpoint: z.url().max(2000).refine(isPushEndpoint),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(200) }),
})

// This browser agreed to push. The endpoint is unique per browser, so signing in as someone else takes it over.
export async function savePushSubscription(input: unknown): Promise<Result> {
  const me = await requireMember()
  const parsed = pushSub.safeParse(input)
  if (!parsed.success) return { error: "This browser can't receive notifications." }
  const { endpoint, keys } = parsed.data
  await db
    .insert(pushSubscription)
    .values({ endpoint, userId: me.user.id, ...keys })
    .onConflictDoUpdate({ target: pushSubscription.endpoint, set: { userId: me.user.id, ...keys } })
  return {}
}

export async function removePushSubscription(endpoint: string): Promise<Result> {
  const me = await requireMember()
  await db
    .delete(pushSubscription)
    .where(and(eq(pushSubscription.endpoint, endpoint), eq(pushSubscription.userId, me.user.id)))
  return {}
}
