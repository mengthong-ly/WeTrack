# Using WeTrack from Claude Code

Connect Claude Code to your WeTrack workspace so you can ask for a progress report and update tasks in plain language:

> "Give me a WeTrack progress report."
> "Move the checkout task to review and note that the API is merged."

A key you create in WeTrack acts as you: your workspace, your role. Everything Claude does shows in the Logs with `via: "agent"`.

## Quick start

1. **Create a key.** Open **Team** in WeTrack, find the **API keys** card, name the key (for example "Laptop"), and choose **Create key**. Copy the setup lines right away: the key is shown once and WeTrack keeps only a hash of it.
2. **Connect Claude Code** with one of the two ways below. MCP is the one to use unless you only work inside the WeTrack repo.
3. **Ask.** Start a new Claude Code session and try one of the [example requests](#what-to-ask).

## Connect

### Option A: MCP (works in any project)

Run this once in your own terminal (not through Claude), using the line the Team page gave you:

```sh
claude mcp add --transport http wetrack https://<your-wetrack-host>/api/mcp --header "Authorization: Bearer <your key>"
```

Restart Claude Code. Five tools appear: `wetrack_report`, `wetrack_list_tasks`, `wetrack_create_task`, `wetrack_update_task` and `wetrack_add_note`. Claude uses them when you ask about WeTrack.

- Claude Code stores the header as written, so the key lives in its config file. The default scope is `local` (this project, only you); `--scope user` makes it available in every project. Avoid `--scope project` with a literal key: that writes a `.mcp.json` you might commit.
- To share a config with a team without a key in it, commit a `.mcp.json` whose header reads `"Authorization": "Bearer ${WETRACK_API_KEY}"`. Claude Code fills in `${WETRACK_API_KEY}` from each person's own environment.

### Option B: the `wetrack` skill (inside the WeTrack repo)

The repo ships a project skill, `.claude/skills/wetrack/`. It calls the REST API through a small script, `wt.sh`, which reads two environment variables:

```sh
export WETRACK_URL=https://<your-wetrack-host>
export WETRACK_API_KEY=<your key>
```

Start Claude Code from the repo root and ask as usual. The skill's paths are relative to the repo root, so it does not work from another directory; use Option A there.

To stop Claude Code asking permission on every call, add this rule to your Claude Code permissions:

```text
Bash(.claude/skills/wetrack/wt.sh:*)
```

`wt.sh` sends the key only to `$WETRACK_URL/api/agent/*` and never prints it. That rule was tested in a headless `claude -p` run, not in an interactive session, so check that it behaves the way you expect.

If both options are set up, Claude uses the MCP tools when they are listed and falls back to `wt.sh` otherwise.

## What to ask

| You want | Ask something like | What happens |
| --- | --- | --- |
| A status summary | "WeTrack progress report" or "what's overdue in WeTrack?" | Reads the workspace report: done this week, what needs attention and why, per-project health and progress, who has the most work. |
| One project | "Report on the Asia project" | Same report scoped to that project. |
| Find tasks | "Show my in-progress WeTrack tasks" | Lists tasks, filtered by text, status, project or person (up to 50 at a time). |
| Update a task | "Mark the login redirect task done" | Finds the task, confirms if several match, updates it, then reads it back and tells you the old and new values. |
| Post a progress note | "Post a note on the checkout task: API is merged" | Adds a comment. It notifies the assignee, the creator and everyone already in the thread. |
| Create a task | "Create a WeTrack task: fix login redirect, bug, due 20 Nov, assign Dara" | Creates it in the project you name and tells you what it made. |

Claude names tasks by title, asks which one when several match, and asks before changing more than three tasks at once.

## Reference

### Fields and values

| Field | Values |
| --- | --- |
| `status` | `not_started`, `in_progress`, `review`, `blocked`, `completed` |
| `priority` | `urgent`, `normal`, `no_rush` |
| `type` | `development`, `design`, `bug_fix` |
| dates | `YYYY-MM-DD` |
| `progress` | whole number 0-100 |
| note `body` | 1-5000 characters |

Creating a task needs every field except `assigneeIds` and `parentId` (use `null` for the ones you do not set). Updating takes only the fields that change; a request with no known field is rejected with "Nothing to change."

### MCP tools and REST endpoints

Both run the same operations. Tool inputs use the same JSON keys as the REST bodies, with `id` as an argument instead of in the path.

| MCP tool | REST endpoint | Notes |
| --- | --- | --- |
| `wetrack_report` | `GET /api/agent/report?project=<id>` | `project` is optional. Lists in the report hold at most 10 entries; `totals` has the full counts. |
| `wetrack_list_tasks` | `GET /api/agent/tasks?q=&status=&project=&assignee=` | Filters combine. `assignee` is a user id or `me`. Returns `{ tasks, more }`; `more: true` means narrow the filters. An unknown filter value returns an empty list, not an error. |
| `wetrack_create_task` | `POST /api/agent/tasks` | Returns `{ "id": "..." }`. |
| `wetrack_update_task` | `PATCH /api/agent/tasks/<id>` | Returns `{}`. |
| `wetrack_add_note` | `POST /api/agent/tasks/<id>/notes` | Body `{ "body": "..." }`. |

REST calls need the header `Authorization: Bearer <key>`. Errors are `{ "error": "..." }` with status 400 (bad input), 401 (bad, expired or revoked key) or 404 (not in your workspace). Over MCP the same app errors come back as error results with that JSON; inputs that fail schema validation return the MCP SDK's own "Input validation error" message.

To assign people, use user ids. The report's `people` list has every member's `id` and `name`, including people with no tasks.

### Using it without Claude Code

Any script can call the REST endpoints:

```sh
curl -sS -H "Authorization: Bearer $WETRACK_API_KEY" "$WETRACK_URL/api/agent/report"
```

## Keys

- Each key belongs to you and has your role in your workspace. A key cannot do more than you can.
- Up to 5 live keys per person, each valid for 90 days. Make one per machine so you can revoke a single laptop.
- The API keys card lists your keys with when each was created, last used and expires. **Revoke** stops a key at once.
- Only you see and revoke your keys. If you leave the workspace or are removed, your keys stop working immediately.
- A key works only on `/api/agent/*` and `/api/mcp`. It cannot open WeTrack's pages or run its other actions (roles, members, renaming the team).
- Treat a key like a password. Do not paste it into a chat, a ticket or a committed file. If one leaks, revoke it and make a new one.

## Troubleshooting

| What you see | What it means | What to do |
| --- | --- | --- |
| `HTTP 401` or "Invalid or expired API key" | The key is wrong, expired, revoked, or its owner left the workspace. | Create a new key on the Team page. |
| `missing WETRACK_API_KEY` or `missing WETRACK_URL` (from `wt.sh`) | The environment variable is not set in the shell that started Claude Code. | Export both variables, then start Claude Code again. |
| The `wetrack_*` tools are not listed | MCP is not added, or the session started before you added it. | Run `claude mcp list` to check, then restart Claude Code. |
| A task list comes back empty | A filter value is unknown, or the project is outside your workspace. | Check the status spelling and project; ask Claude to list without filters. |
| "Nothing to change." | The update had no recognised field, for example a typo like `progres`. | Ask again with the field named correctly. |
| 400 when creating a task | A required field is missing. | Give the project, title and the other fields the task needs; unset ones are `null`. |
| "You can have 5 live keys. Revoke one first." | You reached the limit. | Revoke one you no longer use. |

## For maintainers

| Piece | Where |
| --- | --- |
| Key format, hashing, header parsing | `lib/agent-key.ts` |
| Key check and request identity (`asAgent`) | `lib/agent.ts`, used by `requireMember()` in `lib/session.ts` |
| Report and task operations (shared by REST and MCP) | `lib/agent-ops.ts`, `lib/agent-tasks.ts` |
| REST routes / MCP endpoint | `app/api/agent/`, `app/api/mcp/route.ts`, `lib/mcp-tools.ts` |
| Task input schemas (shared with the UI actions) | `lib/task-schema.ts` |
| Key table and migration | `agent_key` in `lib/db/schema.ts`, `drizzle/0020_*.sql` |
| Key management | API keys card on Team: `components/agent-keys-card.tsx`, `createAgentKey` / `revokeAgentKey` in `app/actions.ts` |
| Claude Code skill | `.claude/skills/wetrack/SKILL.md`, `wt.sh` |

Writes run through the same server actions as the UI (`createTask`, `updateTask`, `addComment`), so validation, notifications and the audit log stay in one place. Inside `asAgent`, `requireMember()` returns the key's owner; outside it a key authenticates nothing.

Run the end-to-end check against a throwaway database (the script refuses any database whose name does not contain `smoke`, builds its own data and deletes it):

```sh
createdb wetrack_agent_smoke
DATABASE_URL=postgres://localhost:5432/wetrack_agent_smoke pnpm exec drizzle-kit migrate
DATABASE_URL=postgres://localhost:5432/wetrack_agent_smoke pnpm exec next dev -p 3101
# in a second terminal:
DATABASE_URL=postgres://localhost:5432/wetrack_agent_smoke pnpm exec tsx scripts/agent-smoke.ts
```

Design and decisions: `docs/superpowers/plans/2026-11-11-agent-api-mcp.md`. Product notes: "Agent access" in `docs/spec.md`.
