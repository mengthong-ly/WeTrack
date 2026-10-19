import { relations } from "drizzle-orm"
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core"

import { member, organization, user } from "./auth-schema"
import { TASK_PRIORITIES, TASK_STATUSES, TASK_TYPES } from "./enums"

export * from "./auth-schema"
export * from "./enums"

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID())
const createdAt = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
const orgId = () =>
  text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" })


export const taskStatus = pgEnum("task_status", TASK_STATUSES)
export const taskPriority = pgEnum("task_priority", TASK_PRIORITIES)
export const taskType = pgEnum("task_type", TASK_TYPES)

export const project = pgTable(
  "project",
  {
    id: id(),
    organizationId: orgId(),
    name: text("name").notNull(),
    color: text("color").notNull().default("#737373"),
    archived: boolean("archived").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("project_org_idx").on(t.organizationId)]
)

// One row per version; covers both environments so release dates live in one place.
export const release = pgTable(
  "release",
  {
    id: id(),
    organizationId: orgId(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    version: text("version").notNull(),
    stagingPlanned: date("staging_planned"),
    stagingActual: date("staging_actual"),
    prodPlanned: date("prod_planned"),
    prodActual: date("prod_actual"),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [index("release_project_idx").on(t.projectId)]
)

export const task = pgTable(
  "task",
  {
    id: id(),
    organizationId: orgId(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    releaseId: text("release_id").references(() => release.id, { onDelete: "set null" }),
    assigneeId: text("assignee_id").references(() => user.id, { onDelete: "set null" }),
    createdById: text("created_by_id").references(() => user.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description"),
    type: taskType("type").notNull().default("development"),
    priority: taskPriority("priority").notNull().default("normal"),
    status: taskStatus("status").notNull().default("not_started"),
    progress: integer("progress").notNull().default(0),
    startDate: date("start_date"),
    deadline: date("deadline"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index("task_org_idx").on(t.organizationId),
    index("task_project_idx").on(t.projectId),
    index("task_assignee_idx").on(t.assigneeId),
  ]
)

export const subtask = pgTable(
  "subtask",
  {
    id: id(),
    taskId: text("task_id")
      .notNull()
      .references(() => task.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    done: boolean("done").notNull().default(false),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("subtask_task_idx").on(t.taskId)]
)

export const comment = pgTable(
  "comment",
  {
    id: id(),
    taskId: text("task_id")
      .notNull()
      .references(() => task.id, { onDelete: "cascade" }),
    authorId: text("author_id").references(() => user.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("comment_task_idx").on(t.taskId)]
)

// Append-only log. Feeds recent activity now, and the client-update list in milestone 2
// (reported_in_update_id null = not yet told to the client).
export const activity = pgTable(
  "activity",
  {
    id: id(),
    organizationId: orgId(),
    projectId: text("project_id").references(() => project.id, { onDelete: "cascade" }),
    taskId: text("task_id").references(() => task.id, { onDelete: "cascade" }),
    releaseId: text("release_id").references(() => release.id, { onDelete: "cascade" }),
    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
    kind: text("kind").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>(),
    reportedInUpdateId: text("reported_in_update_id"),
    createdAt: createdAt(),
  },
  (t) => [
    index("activity_org_idx").on(t.organizationId, t.createdAt),
    index("activity_project_idx").on(t.projectId),
  ]
)

export const projectRelations = relations(project, ({ many }) => ({
  tasks: many(task),
  releases: many(release),
}))

export const releaseRelations = relations(release, ({ one, many }) => ({
  project: one(project, { fields: [release.projectId], references: [project.id] }),
  tasks: many(task),
}))

export const taskRelations = relations(task, ({ one, many }) => ({
  project: one(project, { fields: [task.projectId], references: [project.id] }),
  release: one(release, { fields: [task.releaseId], references: [release.id] }),
  assignee: one(user, { fields: [task.assigneeId], references: [user.id] }),
  subtasks: many(subtask),
  comments: many(comment),
}))

export const subtaskRelations = relations(subtask, ({ one }) => ({
  task: one(task, { fields: [subtask.taskId], references: [task.id] }),
}))

export const commentRelations = relations(comment, ({ one }) => ({
  task: one(task, { fields: [comment.taskId], references: [task.id] }),
  author: one(user, { fields: [comment.authorId], references: [user.id] }),
}))

export type Task = typeof task.$inferSelect
export type Member = typeof member.$inferSelect
