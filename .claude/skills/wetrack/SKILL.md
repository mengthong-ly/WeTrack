---
name: wetrack
description: Read and update the user's WeTrack workspace through its agent API. Use for "progress report", "what's overdue", "what needs attention", "update my WeTrack", "mark task done", "move task to review", "post a note on task X", or "create a task".
---

# WeTrack

## Setup

Read `WETRACK_URL` (no trailing slash) and `WETRACK_API_KEY` from the environment. If either is unset, tell the user to create a key on the Team page of WeTrack, export both, and stop. Keep the key inside the `Authorization` header: never echo, log, print or commit it, and never write it to a file.

Every call is `curl -sS -H "Authorization: Bearer $WETRACK_API_KEY"` plus the URL. Writes add `-H "Content-Type: application/json" -d '<body>'`. The key acts as its owner: same workspace, same permissions.

## Endpoints

```sh
# Report: the whole workspace, or one project with ?project=<project id>
curl -sS -H "Authorization: Bearer $WETRACK_API_KEY" "$WETRACK_URL/api/agent/report"

# Tasks: filters AND together; assignee is a user id or "me"; q is a case-insensitive title substring
curl -sS -H "Authorization: Bearer $WETRACK_API_KEY" "$WETRACK_URL/api/agent/tasks?q=checkout&status=in_progress&project=<project id>&assignee=me"

# Create: every key but assigneeIds is required (a missing key is a 400); unused ones take null; dates are "YYYY-MM-DD"; progress is 0-100
curl -sS -X POST -H "Authorization: Bearer $WETRACK_API_KEY" -H "Content-Type: application/json" \
  -d '{"title":"Fix login redirect","description":null,"projectId":"<project id>","assigneeId":null,"assigneeIds":["<user id>"],"type":"bug_fix","priority":"normal","status":"not_started","progress":0,"startDate":null,"deadline":"2026-11-20"}' \
  "$WETRACK_URL/api/agent/tasks"                      # -> {"id":"<new task id>"}

# Update: send only the keys that change (same fields as create, minus parentId)
curl -sS -X PATCH -H "Authorization: Bearer $WETRACK_API_KEY" -H "Content-Type: application/json" \
  -d '{"status":"review","progress":90}' "$WETRACK_URL/api/agent/tasks/<task id>"   # -> {}

# Note: a progress note, 1-5000 characters
curl -sS -X POST -H "Authorization: Bearer $WETRACK_API_KEY" -H "Content-Type: application/json" \
  -d '{"body":"API is merged."}' "$WETRACK_URL/api/agent/tasks/<task id>/notes"      # -> {}
```

Values: `status` is `not_started | in_progress | review | blocked | completed`; `priority` is `urgent | normal | no_rush`; `type` is `development | design | bug_fix`.

## Reading responses

- Report: `totals`, `projects[]` (`health` is the display label, e.g. "Off track"; `progress`; `overdue`), `people[]` (workload, with `id` and `name`), `attention[]` (tasks with a `reason`), `doneThisWeek[]`, `recent[]`. Lists hold at most 10 entries.
- Task list: `{ tasks, more }`, at most 50 per call; `more: true` means narrow the filters.
- `assignees` on a task holds member names. Writes that assign people take user ids: get them from `report.people[].id`, send `assigneeIds` (everyone, first is the lead) or `assigneeId` (one person, or null for nobody).
- An unknown `status` or a project id outside the workspace returns an empty list, not an error. When a list comes back unexpectedly empty, recheck the filter values before telling the user there are no tasks.

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
- A 401 means the key is expired, revoked or removed: tell the user to create a new one on the Team page.
- 400 and 404 bodies are `{"error": "..."}` written for people: show the message as is.
