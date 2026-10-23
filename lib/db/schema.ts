import { relations } from "drizzle-orm"
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
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
    reportedInUpdateId: text("reported_in_update_id").references(() => clientUpdate.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (t) => [
    index("activity_org_idx").on(t.organizationId, t.createdAt),
    index("activity_project_idx").on(t.projectId),
  ]
)

// A message sent to a client; the activity rows it covered point back here.
export const clientUpdate = pgTable(
  "client_update",
  {
    id: id(),
    organizationId: orgId(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    sentById: text("sent_by_id").references(() => user.id, { onDelete: "set null" }),
    message: text("message").notNull(),
    itemCount: integer("item_count").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("client_update_project_idx").on(t.projectId, t.createdAt)]
)

// Read-only dashboard link for people without an account (the CEO). Only the sha256 of the
// token is stored, so a leaked backup can't be turned into a working link.
export const shareLink = pgTable("share_link", {
  id: id(),
  organizationId: orgId(),
  label: text("label").notNull().default("CEO"),
  tokenHash: text("token_hash").notNull().unique(),
  createdById: text("created_by_id").references(() => user.id, { onDelete: "set null" }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  lastViewedAt: timestamp("last_viewed_at", { withTimezone: true }),
  createdAt: createdAt(),
})

// The code teammates type on /onboarding to join. One live code per workspace: making a new one
// replaces the row, turning it off deletes it. Unlike the share link it is stored as-is so owners
// can read it again to pass on; it expires and only ever lets someone in as a member.
export const joinCode = pgTable("join_code", {
  organizationId: text("organization_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  code: text("code").notNull().unique(),
  createdById: text("created_by_id").references(() => user.id, { onDelete: "set null" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
})

// One row per workspace per digest day. The cron claims the row before sending, so a duplicate
// delivery of the same run finds it taken and sends nothing.
export const digestSent = pgTable(
  "digest_sent",
  { organizationId: orgId(), sentOn: date("sent_on").notNull(), createdAt: createdAt() },
  (t) => [primaryKey({ columns: [t.organizationId, t.sentOn] })]
)

// A scheduled Google Meet. Attendees are emails because guests (for example the CEO) may have no
// account. `remindedAt` is claimed by the cron before the 1-hour Slack reminder is sent.
export const meeting = pgTable(
  "meeting",
  {
    id: id(),
    organizationId: orgId(),
    taskId: text("task_id").references(() => task.id, { onDelete: "set null" }),
    createdById: text("created_by_id").references(() => user.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    attendeeEmails: text("attendee_emails").array().notNull(),
    googleEventId: text("google_event_id").notNull(),
    meetUrl: text("meet_url"),
    calendarUrl: text("calendar_url"),
    remindedAt: timestamp("reminded_at", { withTimezone: true }),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("meeting_org_start_idx").on(t.organizationId, t.startsAt)]
)

// Per-workspace integrations. The Slack webhook URL is a secret and never reaches the client.
export const workspaceIntegration = pgTable("workspace_integration", {
  organizationId: text("organization_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  slackWebhookUrl: text("slack_webhook_url"),
})

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

export const meetingRelations = relations(meeting, ({ one }) => ({
  task: one(task, { fields: [meeting.taskId], references: [task.id] }),
  createdBy: one(user, { fields: [meeting.createdById], references: [user.id] }),
}))

export type Task = typeof task.$inferSelect
export type Meeting = typeof meeting.$inferSelect
export type Member = typeof member.$inferSelect
