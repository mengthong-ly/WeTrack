// The task fields a write accepts. Shared by the server actions (app/actions.ts) and the MCP tools (lib/mcp-tools.ts);
// it lives here because a "use server" file can only export async functions.
import { z } from "zod"

import { TASK_PRIORITIES, TASK_STATUSES, TASK_TYPES } from "@/lib/db/enums"

const isoDate = z.iso.date().nullable()
const optionalText = z
  .string()
  .trim()
  .max(5000)
  .transform((s) => s || null)
  .nullable()

export const taskFields = z.object({
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

export const taskPatch = taskFields.omit({ parentId: true }).partial() // a task stays where it was made
