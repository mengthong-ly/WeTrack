---
name: wetrack
description: Read and update the user's WeTrack workspace through its MCP tools or agent API. Use for a WeTrack "progress report", "what's overdue in WeTrack", "what needs attention", "update my WeTrack", "mark a WeTrack task done", "move a WeTrack task to review", "post a note on WeTrack task X", or "create a WeTrack task".
---

# WeTrack

## Setup

Two surfaces run the same operations with the same key, which acts as its owner: same workspace, same permissions. When the `wetrack_*` tools are listed in the session, use them. Otherwise use `wt.sh`.

### MCP tools

Connecting is the user's step, in their own terminal (the key must stay off your command lines):

```sh
claude mcp add --transport http wetrack <WETRACK_URL>/api/mcp --header "Authorization: Bearer <key>"
```

The Team page shows this line with the real URL and key when a key is created. Restart the session after adding so the tools are listed.

- Claude Code stores the header value as written, so the key then lives in its config file. `--scope` is `local` (the default: this project, only for the user), `user` (every project) or `project` (a `.mcp.json` in the repo). Use `local` or `user`.
- Never put a literal key in a project-scope `.mcp.json` that is committed. To share the config, write the header as `"Authorization": "Bearer ${WETRACK_API_KEY}"`: Claude Code expands `${VAR}` in `headers` and `url` from each person's environment.

| Tool | What it does | `wt.sh` equivalent |
| --- | --- | --- |
| `wetrack_report` | Workspace report; `project` scopes it | `GET /api/agent/report` |
| `wetrack_list_tasks` | Tasks; `q`, `status`, `project`, `assignee` | `GET /api/agent/tasks` |
| `wetrack_create_task` | Create a task; returns `{ id }` | `POST /api/agent/tasks` |
| `wetrack_update_task` | Change fields of task `id` | `PATCH /api/agent/tasks/<id>` |
| `wetrack_add_note` | Note `body` on task `id` | `POST /api/agent/tasks/<id>/notes` |

Inputs, values, filters and responses match the REST sections below: the tool inputs are the same JSON keys, with `id` in the arguments instead of the path.

### wt.sh

Every call goes through `.claude/skills/wetrack/wt.sh METHOD /api/agent/... ['<json body>']`, run by that path from the repo root. It reads `WETRACK_URL` and `WETRACK_API_KEY` from the environment, sends the key only to `$WETRACK_URL/api/agent/*`, and prints the body followed by `HTTP <status>`. A body must be a JSON object.

Never read, echo, print, log or write the key or `WETRACK_URL`, and never put the key on a command line. The first `wt.sh` call is the setup check: if it prints `missing <NAME>`, tell the user to create a key on the Team page of WeTrack, export both variables, and stop.

To run these calls without a prompt each, the user adds the permission rule `Bash(.claude/skills/wetrack/wt.sh:*)` to their Claude Code permissions (tested in a headless `claude -p` run only, not in an interactive session).

## Endpoints (REST, for `wt.sh`)

```sh
# Report: the whole workspace, or one project with ?project=<project id>
.claude/skills/wetrack/wt.sh GET /api/agent/report

# Tasks: filters AND together; assignee is a user id or "me"; q is a case-insensitive title substring
.claude/skills/wetrack/wt.sh GET "/api/agent/tasks?q=checkout&status=in_progress&project=<project id>&assignee=me"

# Create: every key except assigneeIds and parentId is required (a missing key is a 400); unused ones take null;
# dates are "YYYY-MM-DD"; progress is 0-100; parentId makes a sub-task in the parent's project
.claude/skills/wetrack/wt.sh POST /api/agent/tasks '{"title":"Fix login redirect","description":null,"projectId":"<project id>","assigneeId":null,"assigneeIds":["<user id>"],"type":"bug_fix","priority":"normal","status":"not_started","progress":0,"startDate":null,"deadline":"2026-11-20"}'
# -> {"id":"<new task id>"}

# Update: send only the keys that change (same fields as create, minus parentId)
.claude/skills/wetrack/wt.sh PATCH /api/agent/tasks/<task id> '{"status":"review","progress":90}'
# -> {}

# Note: a progress note, 1-5000 characters
.claude/skills/wetrack/wt.sh POST /api/agent/tasks/<task id>/notes '{"body":"API is merged."}'
# -> {}
```

Values: `status` is `not_started | in_progress | review | blocked | completed`; `priority` is `urgent | normal | no_rush`; `type` is `development | design | bug_fix`.

## Reading responses

- Report: `totals`, `projects[]` (`health` is the display label: "Behind", "At risk", "On track" or "All done"; `progress`; `overdue`), `people[]` (every member with `id` and `name`, idle ones included; the workload counts follow `project` when it is given), `attention[]` (tasks with a `reason`), `doneThisWeek[]`, `recent[]`. `attention`, `doneThisWeek` and `recent` hold at most 10 entries, so `totals` has the true counts.
- Task list: `{ tasks, more }`, at most 50 per call; `more: true` means narrow the filters.
- `assignees` on a task holds member names. Writes that assign people take user ids: get them from `report.people[].id`, send `assigneeIds` (everyone, first is the lead) or `assigneeId` (one person, or null for nobody).
- An unknown `status`, `assignee` id or `project` id (or one outside the workspace) returns an empty list, not an error. When a list comes back unexpectedly empty, recheck the filter values before telling the user there are no tasks.

## Report workflow

1. Call the report (`wetrack_report` or `GET /api/agent/report`).
2. Write: done this week; needs attention, each with its reason; per-project health and progress; who is overloaded (many open or overdue tasks per `people[]`).
3. Name tasks by title, never by id.

## Update workflow

1. Find the task with `wetrack_list_tasks` or `/api/agent/tasks?q=<words from the title>`. With more than one candidate, show the titles and projects and confirm which one with the user.
2. Update the fields the user asked for (`wetrack_update_task` or PATCH), or post a note. Use the exact field names: unknown keys are dropped, and an update with no known field (an empty body, or a typo such as `progres`) is rejected with "Nothing to change.".
3. After a batch of writes, re-read each changed task and tell the user what changed (old value to new value).

A note is a task comment: it notifies the assignee, the creator and everyone already in the thread. Agent writes appear in the Logs with `via: "agent"`.

## Rules

- Write only what the user asked for.
- Ask before changing more than 3 tasks in one go.
- `HTTP 401` (REST, or the MCP endpoint) means the key is expired, revoked or removed: tell the user to create a new one on the Team page.
- Errors the app returns (`400`, `404`) read the same on both surfaces: REST bodies are `{"error": "..."}`, MCP results are `isError` with that same JSON. They are written for people: show the message as is.
- MCP inputs that fail schema validation come back as an MCP error from the SDK ("Input validation error: ..."), not as `{"error": ...}`. Fix the arguments from the message and retry.
- Protocol-level problems (wrong `Accept` or `Content-Type`, malformed JSON-RPC) return JSON-RPC errors. They point at the client setup, not the task.
