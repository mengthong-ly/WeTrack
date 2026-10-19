import "server-only"

import { and, asc, desc, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { activity, comment, member, project, subtask, task, user } from "@/lib/db/schema"

export function listProjects(orgId: string) {
  return db.query.project.findMany({
    where: and(eq(project.organizationId, orgId), eq(project.archived, false)),
    orderBy: asc(project.name),
  })
}

export function listMembers(orgId: string) {
  return db
    .select({ id: user.id, name: user.name, email: user.email, image: user.image, role: member.role })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(eq(member.organizationId, orgId))
    .orderBy(asc(user.name))
}

export function listTasks(orgId: string) {
  return db.query.task.findMany({
    where: eq(task.organizationId, orgId),
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

export function getTask(orgId: string, id: string) {
  return db.query.task.findFirst({
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
}

export function recentActivity(orgId: string, limit = 8) {
  return db
    .select({
      id: activity.id,
      kind: activity.kind,
      data: activity.data,
      createdAt: activity.createdAt,
      taskId: activity.taskId,
      taskTitle: task.title,
      actor: user.name,
    })
    .from(activity)
    .leftJoin(task, eq(task.id, activity.taskId))
    .leftJoin(user, eq(user.id, activity.actorId))
    .where(eq(activity.organizationId, orgId))
    .orderBy(desc(activity.createdAt))
    .limit(limit)
}
