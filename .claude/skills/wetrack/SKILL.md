---
name: wetrack
description: Read and update the user's WeTrack workspace through its agent API. Use for a WeTrack "progress report", "what's overdue in WeTrack", "what needs attention", "update my WeTrack", "mark a WeTrack task done", "move a WeTrack task to review", "post a note on WeTrack task X", or "create a WeTrack task".
---

# WeTrack

## Setup

Every call goes through `.claude/skills/wetrack/wt.sh METHOD /api/agent/... ['<json body>']`, run by that path from the repo root. It reads `WETRACK_URL` and `WETRACK_API_KEY` from the environment, sends the key only to `$WETRACK_URL/api/agent/*`, and prints the body followed by `HTTP <status>`. A body must be a JSON object. The key acts as its owner: same workspace, same permissions.

Never read, echo, print, log or write the key or `WETRACK_URL`, and never put the key on a command line. The first `wt.sh` call is the setup check: if it prints `missing <NAME>`, tell the user to create a key on the Team page of WeTrack, export both variables, and stop.

The permission rule `Bash(.claude/skills/wetrack/wt.sh:*)` lets these calls run without a prompt each.

## Endpoints

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

- Report: `totals`, `projects[]` (`health` is the display label: "Behind", "At risk", "On track" or "All done"; `progress`; `overdue`), `people[]` (workload, with `id` and `name`), `attention[]` (tasks with a `reason`), `doneThisWeek[]`, `recent[]`. `attention`, `doneThisWeek` and `recent` hold at most 10 entries, so `totals` has the true counts.
- Task list: `{ tasks, more }`, at most 50 per call; `more: true` means narrow the filters.
- `assignees` on a task holds member names. Writes that assign people take user ids: get them from `report.people[].id`, send `assigneeIds` (everyone, first is the lead) or `assigneeId` (one person, or null for nobody).
- An unknown `status`, `assignee` id or `project` id (or one outside the workspace) returns an empty list, not an error. When a list comes back unexpectedly empty, recheck the filter values before telling the user there are no tasks.

## Report workflow

1. Call the report.
2. Write: done this week; needs attention, each with its reason; per-project health and progress; who is overloaded (many open or overdue tasks per `people[]`).
3. Name tasks by title, never by id.

## Update workflow

1. Find the task with `/api/agent/tasks?q=<words from the title>`. With more than one candidate, show the titles and projects and confirm which one with the user.
2. PATCH the fields the user asked for, or post a note. Send at least one known field in every PATCH: an empty body still bumps `updated_at` and writes an audit row.
3. After a batch of writes, re-read each changed task and tell the user what changed (old value to new value).

A note is a task comment: it notifies the assignee, the creator and everyone already in the thread. Agent writes appear in the Logs with `via: "agent"`.

## Rules

- Write only what the user asked for.
- Ask before changing more than 3 tasks in one go.
- `HTTP 401` means the key is expired, revoked or removed: tell the user to create a new one on the Team page.
- `HTTP 400` and `HTTP 404` bodies are `{"error": "..."}` written for people: show the message as is.
