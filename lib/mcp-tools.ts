import "server-only"

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import { z } from "zod"

import { addComment, createTask, updateTask } from "@/app/actions"
import { agentReport, agentTasks } from "@/lib/agent-ops"
import { requireMember } from "@/lib/session"
import { taskFields, taskPatch } from "@/lib/task-schema"

// The REST twin's body: { error } as an isError result, else the success JSON (lib/agent.ts fromResult).
function reply(r: { error?: string }, ok: Record<string, unknown> = {}): CallToolResult {
  const body = r.error ? { error: r.error } : ok
  return { content: [{ type: "text", text: JSON.stringify(body) }], structuredContent: body, ...(r.error && { isError: true }) }
}

const id = z.string().min(1).describe("Task id")
const filter = (d: string) => z.string().optional().describe(d)

// The agent API (app/api/agent/*) as MCP tools. Run inside asAgent(), so every action acts as the key's owner.
export function mcpServer() {
  const server = new McpServer({ name: "wetrack", version: "1.0.0" })

  server.registerTool(
    "wetrack_report",
    {
      description: "The workspace at a glance: totals, project health, people's load, what needs attention, done this week, recent activity. Pass project to scope it to one project.",
      inputSchema: { project: filter("Project id") },
      annotations: { readOnlyHint: true },
    },
    async ({ project }) => {
      const r = await agentReport(await requireMember(), project || undefined)
      return "error" in r ? reply(r) : reply({}, r)
    }
  )

  server.registerTool(
    "wetrack_list_tasks",
    {
      description: "Tasks in live projects, newest change first. Filters: q (title contains), status, project (id), assignee (a user id, or \"me\").",
      inputSchema: { q: filter("Title contains"), status: filter("Task status"), project: filter("Project id"), assignee: filter("User id, or \"me\"") },
      annotations: { readOnlyHint: true },
    },
    async (f) => {
      const get = (v?: string) => v || undefined
      const filters = { q: get(f.q), status: get(f.status), project: get(f.project), assignee: get(f.assignee) }
      return reply({}, await agentTasks(await requireMember(), filters))
    }
  )

  server.registerTool(
    "wetrack_create_task",
    { description: "Create a task, with the same fields and checks as the New task form. Returns { id }.", inputSchema: taskFields },
    async (fields) => {
      const r = await createTask(fields)
      return reply(r, { id: r.id })
    }
  )

  server.registerTool(
    "wetrack_update_task",
    {
      description: "Change some of a task's fields (status, progress, deadline, assignees, ...). Send at least one field besides id.",
      inputSchema: taskPatch.extend({ id }),
      annotations: { idempotentHint: true },
    },
    async ({ id, ...patch }) => reply(await updateTask(id, patch))
  )

  server.registerTool(
    "wetrack_add_note",
    { description: "Post a progress note on a task. It is a comment, so it notifies like one.", inputSchema: { id, body: z.string().describe("The note") } },
    async ({ id, body }) => reply(await addComment(id, body))
  )

  return server
}
