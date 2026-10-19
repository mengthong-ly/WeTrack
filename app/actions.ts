"use server"

import { and, eq, max } from "drizzle-orm"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import {
  activity,
  comment,
  member,
  project,
  subtask,
  task,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TYPES,
} from "@/lib/db/schema"
import { getSession, requireMember } from "@/lib/session"

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
