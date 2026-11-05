import { relations } from "drizzle-orm"
import {
  type AnyPgColumn,
  boolean,
  customType,
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
    description: text("description"),
    color: text("color").notNull().default("#737373"),
    logoId: text("logo_id").references((): AnyPgColumn => attachment.id, { onDelete: "set null" }),
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
    // Sub-tasks are tasks with a parent, nested to any depth; deleting a task deletes everything under it.
    parentId: text("parent_id").references((): AnyPgColumn => task.id, { onDelete: "cascade" }),
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
    index("task_parent_idx").on(t.parentId),
  ]
)

// Every person a task is assigned to. `task.assignee_id` stays as the lead (the first one) so the 3D workspace, feedback
// and the CEO page keep one owner per task; setTaskAssignees() in app/actions.ts writes both together.
export const taskAssignee = pgTable(
  "task_assignee",
  {
    taskId: text("task_id")
      .notNull()
      .references(() => task.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.userId] }), index("task_assignee_user_idx").on(t.userId)]
)

// When someone last opened a task. A task is unseen for them when it changed after this (or they never opened it).
export const taskView = pgTable(
  "task_view",
  {
    taskId: text("task_id")
      .notNull()
      .references(() => task.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    viewedAt: timestamp("viewed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.userId] })]
)

// Named URLs on a project: where it runs (staging, production, landing page) and where it was designed (Figma …).
export const PROJECT_LINK_KINDS = ["site", "design"] as const
export type ProjectLinkKind = (typeof PROJECT_LINK_KINDS)[number]
export const projectLink = pgTable(
  "project_link",
  {
    id: id(),
    organizationId: orgId(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: PROJECT_LINK_KINDS }).notNull(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("project_link_project_idx").on(t.projectId)]
)

// Sign-in times for the Home page: `lastAt` is this visit's sign-in, `previousAt` the one before it.
export const userLogin = pgTable("user_login", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  lastAt: timestamp("last_at", { withTimezone: true }).defaultNow().notNull(),
  previousAt: timestamp("previous_at", { withTimezone: true }),
})

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

// Who did what, newest first: one row per action that changes data (written by audit() in app/actions.ts).
// Unlike `activity` it covers everything people do, not just task events, and it outlives what it points at:
// `label` keeps the name, and `target_id` / `project_id` are plain text so deleting a project leaves its history.
// Secrets (the Slack URL, share tokens) never go in `data`.
export const logEntry = pgTable(
  "log",
  {
    id: id(),
    organizationId: orgId(),
    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
    action: text("action").notNull(), // "project.create", "task.update", "member.role" …
    targetId: text("target_id"),
    projectId: text("project_id"),
    label: text("label"),
    data: jsonb("data").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("log_org_idx").on(t.organizationId, t.createdAt), index("log_actor_idx").on(t.actorId)]
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
    description: text("description"),
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

const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" })

// One piece of feedback for a teammate: a note (screenshots inline), or an older row's single screenshot. It may name a task, and then it goes to
// whoever the task was assigned to when it was written. The screenshot is an attachment (lib/storage.ts).
export const feedback = pgTable(
  "feedback",
  {
    id: id(),
    organizationId: orgId(),
    // The project it's about: the task's project, or the one it was given in when it names no task. Null only for
    // points given before feedback moved into projects without a task.
    projectId: text("project_id").references(() => project.id, { onDelete: "cascade" }),
    taskId: text("task_id").references(() => task.id, { onDelete: "set null" }),
    authorId: text("author_id").references(() => user.id, { onDelete: "set null" }),
    recipientId: text("recipient_id").references(() => user.id, { onDelete: "set null" }),
    body: text("body"),
    imageId: text("image_id").references(() => attachment.id, { onDelete: "set null" }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("feedback_org_idx").on(t.organizationId, t.createdAt),
    index("feedback_task_idx").on(t.taskId),
    index("feedback_project_idx").on(t.projectId, t.createdAt),
  ]
)

// Every stored image: pasted into a task description or comment (linked from the Markdown as
// /api/attachments/<id>), a feedback screenshot, or a project logo. `key` is its R2 object; `data` holds the
// bytes instead when R2 isn't configured, and for images stored before R2.
// ponytail: no orphan cleanup for Markdown images (one removed from the text stays); sweep unreferenced rows if the bucket grows.
export const attachment = pgTable(
  "attachment",
  {
    id: id(),
    organizationId: orgId(),
    uploaderId: text("uploader_id").references(() => user.id, { onDelete: "set null" }),
    key: text("key"),
    data: bytea("data"),
    type: text("type").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("attachment_org_idx").on(t.organizationId)]
)

// One thing someone should hear about: assigned to them, a comment or change on their task, feedback for them.
// Written by notify() (lib/notify.ts), which also pushes it to their browsers. Opening the inbox sets `read_at`
// on everything unread, so the count is "since you last looked".
export const notification = pgTable(
  "notification",
  {
    id: id(),
    organizationId: orgId(),
    recipientId: text("recipient_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
    kind: text("kind").notNull(),
    taskId: text("task_id").references(() => task.id, { onDelete: "cascade" }),
    feedbackId: text("feedback_id").references(() => feedback.id, { onDelete: "cascade" }),
    data: jsonb("data").$type<Record<string, unknown>>(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("notification_recipient_idx").on(t.recipientId, t.createdAt)]
)

// A browser that agreed to push notifications. The endpoint is the push service's URL for that browser;
// a 404/410 from it means the subscription is gone, and the row is deleted.
export const pushSubscription = pgTable(
  "push_subscription",
  {
    endpoint: text("endpoint").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("push_subscription_user_idx").on(t.userId)]
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
  assignees: many(taskAssignee),
  parent: one(task, { fields: [task.parentId], references: [task.id], relationName: "subtasks" }),
  subtasks: many(task, { relationName: "subtasks" }),
  comments: many(comment),
}))

export const taskAssigneeRelations = relations(taskAssignee, ({ one }) => ({
  task: one(task, { fields: [taskAssignee.taskId], references: [task.id] }),
  user: one(user, { fields: [taskAssignee.userId], references: [user.id] }),
}))

export const commentRelations = relations(comment, ({ one }) => ({
  task: one(task, { fields: [comment.taskId], references: [task.id] }),
  author: one(user, { fields: [comment.authorId], references: [user.id] }),
}))

export const meetingRelations = relations(meeting, ({ one }) => ({
  task: one(task, { fields: [meeting.taskId], references: [task.id] }),
  createdBy: one(user, { fields: [meeting.createdById], references: [user.id] }),
}))

export const feedbackRelations = relations(feedback, ({ one }) => ({
  task: one(task, { fields: [feedback.taskId], references: [task.id] }),
  author: one(user, { fields: [feedback.authorId], references: [user.id] }),
  recipient: one(user, { fields: [feedback.recipientId], references: [user.id] }),
}))

export type LogEntry = typeof logEntry.$inferSelect
export type Task = typeof task.$inferSelect
export type Meeting = typeof meeting.$inferSelect
export type Member = typeof member.$inferSelect
