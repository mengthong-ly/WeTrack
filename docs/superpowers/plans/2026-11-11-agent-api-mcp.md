# Agent access (API key, REST, Claude Code skill, MCP) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A member's Claude Code can read WeTrack progress (a report, task lists) and write updates (create or edit tasks, post progress notes) through a revocable per-user key, over REST first and MCP second.

**Architecture:**
- A new `agent_key` table stores sha256-hashed keys (same pattern as `share_link`). A key acts as its owner with the owner's role.
- `asAgent(req, fn)` in `lib/agent.ts` verifies `Authorization: Bearer wt_…` and runs `fn` inside an `AsyncLocalStorage` identity. `requireMember()` in `lib/session.ts` reads that identity first, so the existing server actions (`createTask`, `updateTask`, `addComment`) run unchanged with the same validation, notifications and `audit()`. Outside `asAgent` a key authenticates nothing.
- Business logic lives once in `lib/agent-ops.ts`. The REST routes (`app/api/agent/*`) and the MCP route (`app/api/mcp`) are thin adapters over it.
- A project skill (`.claude/skills/wetrack/SKILL.md`) teaches Claude Code the calls and the report format.

**Tech Stack:** Next.js 16.4 route handlers, Drizzle 0.45 + Postgres, zod 4, `node:async_hooks`, `node --test`, `@modelcontextprotocol/sdk` (Phase C only).

**Spec:** none written. Decisions come from the 2026-11-11 design discussion, summarised in Architecture and Global Constraints. Product context: [docs/spec.md](../../spec.md).

**Why not the better-auth `apiKey` plugin** (the first suggestion in chat): in 1.7 it is a separate package (`@better-auth/api-key`), and its `enableSessionForAPIKeys` makes a key valid on every better-auth endpoint, including organization management. A leaked owner key could then remove members. The own-table design keeps keys to the agent surface only and needs no new dependency.

## Global Constraints

- No new npm dependency in Phases A and B. Phase C adds exactly `@modelcontextprotocol/sdk`.
- Key format: `wt_` + `randomBytes(32).toString("base64url")`. Stored as sha256 hex only; the plain key is shown once at creation.
- Header: `Authorization: Bearer wt_…` only. No query-string keys.
- Defaults: key lifetime 90 days (`expiresAt`), at most 5 live keys per user, `lastUsedAt` updated on use.
- Agent routes live only under `app/api/agent/` and `app/api/mcp/`. `proxy.ts` already excludes `/api`, so no proxy change.
- Errors are JSON `{ "error": string }` with 400 (validation), 401 (no, bad, revoked, expired key, or key owner no longer in the workspace), 404 (task or project not in the key's workspace). Never a redirect.
- Responses carry `Cache-Control: private, no-store`.
- Writes go through the existing server actions so zod rules, notifications and `audit()` stay the single source. `audit()` adds `via: "agent"` to `data` when the call runs inside `asAgent`.
- Never log or store the Authorization header or a plain key, including in `log.data` and `console.error`.
- Pure modules under `lib/*.ts` that tests import use relative `./x.ts` imports, `import type` only for app types, and no `@/` alias, because `node --test lib/*.test.ts` runs TS directly.
- Next.js 16: read `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` before writing a route.
- UI (Task 5): follow `CLAUDE.md` "Before any UI or UX work" and "Components: shadcn first" and `DESIGN.md`. Tokens only, run the colour scan, check desktop, 375px and dark mode.
- Package manager `pnpm`. Commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Revoked, expired, unknown or malformed key** returns 401 JSON, never a 307 to `/sign-in`. `requireMember()` would redirect, so `asAgent` must resolve membership before running the handler. Pinned by `bearerToken`/`isAgentKey` tests (Task 1) and smoke checks (Task 4).
2. **Key of someone who left the workspace** (member row gone, user deleted) returns 401. Smoke check in Task 4.
3. **A key must not authenticate outside the agent routes.** The same key sent to `/api/tasks` returns a redirect, not data. Smoke check in Task 4.
4. **Two concurrent requests with different keys** each act as their own user (`AsyncLocalStorage` isolation). Smoke check in Task 4 creates a task per user in parallel and asserts each `createdById`.
5. **Hostile or odd input:** `progress: 150`, bad date, unknown status, 5001-character note, empty body, an id from another workspace. 400 or 404 with the action's own message and no row written. Smoke check in Task 4 and zod tests in Task 2.
6. **Key leaks into history:** the plain key never appears in `log.data`, the activity feed or server logs. Checked by a grep of the smoke run's DB rows in Task 4.

---

## Phase A: Key and REST API

### Task 1: Key rules (pure)

**Files:**
- Create: `lib/agent-key.ts`
- Test: `lib/agent-key.test.ts`

**Interfaces:**
- Produces:
  - `newAgentKey(): string` returns `wt_` + 43 base64url characters.
  - `hashAgentKey(key: string): string` returns the sha256 hex.
  - `isAgentKey(s: string): boolean` is true for `^wt_[\w-]{43}$`.
  - `bearerToken(header: string | null): string | null` returns the token from `Bearer <token>` (case-insensitive scheme, single space) or null.
  - `AGENT_KEY_DAYS = 90` and `AGENT_KEY_LIMIT = 5`.

- [ ] **Step 1: Write the failing tests** in `lib/agent-key.test.ts` (`node:test`, `node:assert/strict`):
  - `newAgentKey()` passes `isAgentKey` and two calls differ.
  - `hashAgentKey("wt_x")` is 64 lowercase hex characters and is stable.
  - `isAgentKey` rejects `""`, `"wt_short"`, `"abc"`, a key with a space, and a 44-character body.
  - `bearerToken("Bearer wt_abc")` is `"wt_abc"`, `bearerToken("bearer wt_abc")` is `"wt_abc"`, `bearerToken("Basic x")`, `bearerToken("Bearer")`, `bearerToken("Bearer  a b")` and `bearerToken(null)` are `null`.
- [ ] **Step 2: Run** `pnpm test` and expect FAIL (module missing).
- [ ] **Step 3: Implement** the five exports in `lib/agent-key.ts` with `node:crypto` only.
- [ ] **Step 4: Run** `pnpm test` and expect all pass.
- [ ] **Step 5: Commit** `feat(agent): key format and bearer parsing`.

---

### Task 2: Agent task shaping (pure)

**Files:**
- Create: `lib/agent-tasks.ts`
- Test: `lib/agent-tasks.test.ts`

**Interfaces:**
- Produces:
  - `type AgentTask = { id: string; title: string; project: { id: string; name: string }; status: string; priority: string; progress: number; deadline: string | null; assignees: string[]; parentId: string | null; updatedAt: string }`
  - `compactTask(t: TaskLike): AgentTask`, where `TaskLike` is the structural subset of `TaskRow` it reads (declare it locally; read `taskWith` in `lib/queries.ts` first for the real `project` and `assignees` shape).
  - `matchTasks(rows: TaskLike[], f: { q?: string; status?: string; project?: string; assignee?: string }): TaskLike[]` ANDs the filters. `q` is a case-insensitive substring of `title`. `assignee` is a user id matched against `assignees[].userId`. Empty or absent filters are ignored.
  - `TASK_LIST_LIMIT = 50`.

- [ ] **Step 1: Write the failing tests** with three fixture tasks across two projects and two people:
  - each filter alone returns the expected ids; `q: "LOGIN"` matches "Fix login bug".
  - filters combine with AND; `q: "%"` matches nothing (literal substring, not a pattern).
  - `compactTask` returns only the `AgentTask` keys (assert `Object.keys` equals the list) and renders `updatedAt` as an ISO string.
- [ ] **Step 2: Run** `pnpm test` and expect FAIL.
- [ ] **Step 3: Implement** both functions; `import type` for any app type.
- [ ] **Step 4: Run** `pnpm test` and expect pass.
- [ ] **Step 5: Commit** `feat(agent): compact task shape and filters`.

---

### Task 3: Key table, identity and `requireMember` hook

**Files:**
- Modify: `lib/db/schema.ts` (add `agentKey` after `shareLink`)
- Create: `drizzle/0020_*.sql` (generated)
- Create: `lib/agent.ts`
- Modify: `lib/session.ts` (`requireMember` reads the agent identity first)
- Modify: `app/actions.ts` (`audit()` adds `via: "agent"`)

**Interfaces:**
- Consumes: `hashAgentKey`, `bearerToken`, `isAgentKey` (Task 1).
- Produces:
  - Table `agentKey`: `id`, `organizationId` (cascade), `userId` (cascade, indexed), `name text not null`, `tokenHash text not null unique`, `createdAt`, `lastUsedAt timestamptz null`, `expiresAt timestamptz not null`, `revokedAt timestamptz null`.
  - `asAgent(req: Request, fn: () => Promise<Response>): Promise<Response>`. It returns 401 JSON on any key failure. Otherwise it runs `fn` inside the ALS identity `{ user, orgId, role, orgName, orgLogo }`, the exact shape `requireMember()` returns today.
  - `inAgent(): boolean`.
  - `fromResult(res: { error?: string }, ok?: unknown): Response` maps `{ error }` to 404 when the message matches `/not found/i`, otherwise 400, and no error to `Response.json(ok ?? {})`.
  - `requireMember()` returns the ALS identity when present, else behaves as today (cached cookie flow, redirects).

- [ ] **Step 1: Read** `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`, and note anything on `cacheComponents` and `headers()` inside handlers that contradicts the plan.
- [ ] **Step 2: Add the `agentKey` table** to `lib/db/schema.ts` using the file's `id()`, `orgId()` and `createdAt()` helpers, with an index on `userId`. Run `pnpm db:generate`, read the generated SQL (one `CREATE TABLE`, one unique index, one index, two FKs), then `pnpm db:migrate`.
- [ ] **Step 3: Implement `asAgent`** in `lib/agent.ts` (`server-only`):
  - Parse the token with `bearerToken`. If it is null or fails `isAgentKey`, return 401 without a DB call.
  - One query joins `agentKey` to `member` (same org and user) to `user` and `organization`, where `tokenHash = hashAgentKey(token)`, `revokedAt is null` and `expiresAt > now()`. No row means 401, which covers a key whose owner left the workspace.
  - Update `lastUsedAt` fire-and-forget (`after()` from `next/server`).
  - `AsyncLocalStorage<Identity>.run(identity, fn)`.
  - Use the same 401 body for every failure so a probe can't tell unknown from revoked.
- [ ] **Step 4: Edit `requireMember`**: rename today's cached function to `cachedMember` and export `requireMember = async () => agentStore.getStore() ?? cachedMember()`, so the agent path never touches React `cache()`. Export the store accessor from `lib/agent.ts`; avoid an import cycle by keeping `lib/agent.ts` free of `lib/session.ts`.
- [ ] **Step 5: Edit `audit()`** so `data` becomes `{ ...rest.data, ...(inAgent() && { via: "agent" }) }` and is `undefined` when empty (keep today's rows unchanged).
- [ ] **Step 6: Verify** `pnpm typecheck` and `pnpm lint` are clean and `pnpm test` still passes.
- [ ] **Step 7: Commit** `feat(agent): agent_key table, asAgent identity, via-agent audit`.

---

### Task 4: Agent operations, REST routes and smoke check

**Files:**
- Create: `lib/agent-ops.ts`
- Create: `app/api/agent/report/route.ts`
- Create: `app/api/agent/tasks/route.ts`
- Create: `app/api/agent/tasks/[id]/route.ts`
- Create: `app/api/agent/tasks/[id]/notes/route.ts`
- Create: `scripts/agent-smoke.ts`

**Interfaces:**
- Consumes: `asAgent`, `fromResult` (Task 3); `compactTask`, `matchTasks`, `TASK_LIST_LIMIT` (Task 2); existing `createTask`, `updateTask`, `addComment` in `app/actions.ts`; `listTasks`, `listProjects`, `listMembers`, `recentActivity`, `unreportedCounts` in `lib/queries.ts`; `summarize`, `projectProgress`, `workload`, `needsAttention` in `lib/dashboard.ts`.
- Produces (`lib/agent-ops.ts`, all take the `requireMember()` result `me`, so MCP in Task 7 reuses them):
  - `agentReport(me, projectId?: string): Promise<AgentReport>`:
    - `{ workspace: string; today: string; you: { id: string; name: string }; totals: { open; done; doneThisWeek; overdue; dueSoon; blocked }; projects: { id; name; health; open; overdue; progress; unreportedClientChanges: number }[]; people: { id; name; open; active; blocked; overdue; dueThisWeek; doneThisWeek }[]; attention: (AgentTask & { reason: string })[]; doneThisWeek: AgentTask[]; recent: { kind; task: string | null; actor: string | null; at: string }[] }`.
    - Lists are capped at 10 (`attention`, `doneThisWeek`) and 10 (`recent`) with the same cap as `LIST_LIMIT` in `lib/digest.ts`.
    - With `projectId`, every part is scoped to that project (404 through `fromResult` when it isn't in the workspace).
    - Compose it as `app/api/cron/digest/route.ts` does. Leave that route alone. Extract a shared builder only if a third caller appears.
  - `agentTasks(me, f): Promise<{ tasks: AgentTask[]; more: boolean }>` uses `listTasks` then `matchTasks`, capped at `TASK_LIST_LIMIT`. `f.assignee === "me"` resolves to `me.user.id`.
  - Routes (all `export async function`, each wrapped in `asAgent(req, …)`, `Cache-Control: private, no-store`):
    - `GET /api/agent/report?project=` returns `AgentReport`.
    - `GET /api/agent/tasks?q=&status=&project=&assignee=` returns `{ tasks, more }`.
    - `POST /api/agent/tasks` takes the `taskFields` input of `createTask` and returns `{ id }`.
    - `PATCH /api/agent/tasks/[id]` takes the `taskPatch` input of `updateTask` and returns `{}`.
    - `POST /api/agent/tasks/[id]/notes` takes `{ body: string }`, calls `addComment`, and returns `{}`. A progress note is a comment, which keeps one primitive.
    - Invalid JSON bodies return 400 `{ error: "Invalid JSON." }`.

- [ ] **Step 1: Write `scripts/agent-smoke.ts` first** (run with `pnpm tsx --env-file=.env.local scripts/agent-smoke.ts`, refuses unless `DATABASE_URL` contains "demo" like `scripts/seed-demo.ts`). It inserts `agent_key` rows directly via `hashAgentKey` for `u-demo` (owner) and `u-dara` (member), plus one revoked, one expired, and one for a user removed from `member`, then asserts against `http://localhost:3100` using `node:assert/strict`:
  - no header, `Bearer garbage`, revoked, expired and removed-member keys return 401 with a JSON body and no `location` header (Review Focus 1, 2).
  - `GET /api/tasks` with a valid key returns a redirect or 401, not task rows (Focus 3).
  - `GET /api/agent/report` returns `workspace`, `projects`, `people`, `attention` and no key-like string (`/wt_[\w-]{43}/`) anywhere in the body.
  - Parallel `POST /api/agent/tasks` for both users: each created task's `createdById` is its own user (Focus 4).
  - `PATCH` with `{ progress: 150 }`, `{ status: "nope" }` and `{ deadline: "31-12-2026" }` each returns 400 and leaves the row unchanged; a 5001-character note and an empty note return 400; an id from a second seeded organization returns 404 (Focus 5).
  - A valid `PATCH { status: "in_progress" }` returns 200, writes an `activity` row of kind `status_changed` and a `log` row whose `data.via` is `"agent"`.
  - No `log.data` or `activity.data` row contains a `wt_` key (Focus 6).
  - It cleans up the rows it made.
- [ ] **Step 2: Run the demo seed** (`createdb wetrack_demo`; migrate; `seed-demo.ts`) and start `pnpm dev` against it. Run the smoke script and expect failure (routes missing).
- [ ] **Step 3: Implement `lib/agent-ops.ts`** as specified. Keep it free of HTTP concerns: it returns data or `{ error }`.
- [ ] **Step 4: Implement the four route files** as one-screen adapters. Parse JSON defensively, call the action or op, and answer with `fromResult`.
- [ ] **Step 5: Run the smoke script** and expect all assertions pass. Fix at the owning layer: `asAgent` for auth failures, the action for validation, the route only for HTTP mapping.
- [ ] **Step 6: Run** `pnpm typecheck && pnpm lint && pnpm test` and expect clean.
- [ ] **Step 7: Commit** `feat(agent): report, task list, create, update and note API`.

---

### Task 5: Manage your keys on the Team page

**Files:**
- Modify: `app/actions.ts` (add `createAgentKey`, `revokeAgentKey`)
- Create: `components/agent-keys-card.tsx`
- Modify: `app/(app)/(org)/team/page.tsx` (add the card for every member, after the Slack card and before the "Team" card)
- Modify: `lib/queries.ts` (add `listAgentKeys(orgId, userId)`)
- Modify: `DESIGN.md` (note any new pattern)

**Interfaces:**
- Consumes: `newAgentKey`, `hashAgentKey`, `AGENT_KEY_DAYS`, `AGENT_KEY_LIMIT` (Task 1); `CopyButton` exported from `components/share-link-card.tsx`.
- Produces:
  - `createAgentKey(name: string): Promise<{ error?: string; key?: string }>` validates `z.string().trim().min(1).max(60)`, rejects with "You can have 5 live keys. Revoke one first." at the limit, inserts with `expiresAt = now + 90 days`, calls `audit(me, "agent_key.create", { label: name })` and returns the plain key once.
  - `revokeAgentKey(id: string): Promise<{ error?: string }>` sets `revokedAt` only on a key the caller owns (404-style "Key not found." otherwise) and audits `agent_key.revoke`.
  - `listAgentKeys(orgId, userId)` returns live keys: `{ id, name, createdAt, lastUsedAt, expiresAt }[]`, newest first.

- [ ] **Step 1: Load skills and read docs** in this order: read `DESIGN.md`; load `impeccable`, `frontend-design`, `emil-design-eng`, `animate-expo` (web interpretation per `CLAUDE.md`); load `shadcn`, then `pnpm dlx shadcn@latest search @shadcn -q alert-dialog` and `-q input`, and `docs` for the matches. A destructive revoke uses `AlertDialog`, not `window.confirm` as `share-link-card.tsx` does today. If neither it nor `Input` exists in `components/ui/`, add them with `pnpm dlx shadcn@latest add`.
- [ ] **Step 2: Implement the actions** next to the CEO share link actions, using `requireMember()` and the same `Result` shape and `audit()` + `refresh()` ending.
- [ ] **Step 3: Build the card**: a name field and "Create key" button; on success show the key once in a read-only field with `CopyButton` and the line "Copy it now. It won't be shown again." plus a copy-ready snippet `export WETRACK_API_KEY=…` and `export WETRACK_URL=<origin>`; below, the live keys as rows (name, created, last used, expires) with a revoke action. Empty, pending, error and at-limit states are all designed. Copy is sentence case with no exclamation marks.
- [ ] **Step 4: Verify in the browser** (`/verify` skill or Playwright): create a key, copy it, see it listed after refresh without the key text, hit the 6th-key limit, revoke one and confirm the smoke script's 401 check now fails that key. Check desktop, 375px and dark mode.
- [ ] **Step 5: Run the colour and radius scan** from `CLAUDE.md` over the touched files and expect no output. Run `pnpm typecheck && pnpm lint`.
- [ ] **Step 6: Commit** `feat(agent): create and revoke keys on the Team page`.

---

## Phase B: Claude Code side

### Task 6: `wetrack` skill and docs

**Files:**
- Create: `.claude/skills/wetrack/SKILL.md`
- Modify: `docs/spec.md` (add an "Agent access" line to the milestone list and a note in the security section: keys hashed, per-user, 90 days, agent routes only)
- Modify: `.env.example` (comment block only: `WETRACK_URL`, `WETRACK_API_KEY` are read by the skill, not by the app)

**Interfaces:**
- Consumes: the four endpoints from Task 4 (exact paths and bodies).

- [ ] **Step 1: Write the skill** (frontmatter `name: wetrack`, a `description` that triggers on "progress report", "update my WeTrack", "mark task done", "what's overdue"). Body, kept to what an agent can't guess:
  - Setup: read `WETRACK_URL` and `WETRACK_API_KEY` from the environment; if unset, say where to create a key (Team page) and stop. Never echo, log or commit the key.
  - One `curl -sS -H "Authorization: Bearer $WETRACK_API_KEY"` example per endpoint with the exact JSON body shapes and the enum values (`not_started|in_progress|review|blocked|completed`, `urgent|normal|no_rush`, `development|design|bug_fix`).
  - Report workflow: call `/api/agent/report`, then write: done this week, needs attention (with reasons), per-project health and progress, who is overloaded. Cite task titles, not ids.
  - Update workflow: find the task with `/api/agent/tasks?q=`, confirm the match with the user when more than one candidate, then `PATCH` or post a note. After a batch of writes, re-read the changed tasks and say what changed.
  - Rules: only write what the user asked; ask before bulk changes (more than 3 tasks); a 401 means the key is expired or revoked, so tell the user to create a new one.
- [ ] **Step 2: Verify end to end** in a fresh Claude Code session pointed at the demo database: "report my progress on Kinetic Studio" returns a report that matches the Home numbers, and "mark <task> as in review and note that the API is merged" changes the task in the UI, shows `via: "agent"` in the Logs page data, and appears in the activity feed.
- [ ] **Step 3: Edit the docs** as listed.
- [ ] **Step 4: Commit** `docs(agent): wetrack skill and spec notes`.

---

## Phase C: MCP (build after Phase A and B have been used for a week)

Gate: build this only if teammates or other clients (Claude Desktop, Cursor) need typed tools. For one person the skill already does the job.

### Task 7: MCP route

**Files:**
- Modify: `package.json` (add `@modelcontextprotocol/sdk`)
- Create: `app/api/mcp/route.ts`

**Interfaces:**
- Consumes: `asAgent`, `agentReport`, `agentTasks`, `createTask`, `updateTask`, `addComment`, `requireMember`.
- Produces: a stateless Streamable HTTP MCP endpoint at `POST /api/mcp` (and `GET`/`DELETE` answering 405) with tools `wetrack_report`, `wetrack_list_tasks`, `wetrack_create_task`, `wetrack_update_task`, `wetrack_add_note`. Each tool's input schema is the zod schema of the matching REST body; each returns the same JSON as the REST route, with failures as MCP `isError` results.

- [ ] **Step 1: Look up docs** with Context7 (`resolve-library-id` "model context protocol typescript sdk", then one `query-docs` for the web-standard Streamable HTTP transport in stateless mode and one for registering tools with zod 4 schemas). Pin the exact SDK version the docs match, and note anything that contradicts this plan, especially whether the transport takes a web `Request` directly.
- [ ] **Step 2: Add the dependency** with `pnpm add @modelcontextprotocol/sdk@<pinned>` and confirm it resolves with zod 4.
- [ ] **Step 3: Implement the route**: build a fresh server per request, register the five tools as adapters over the shared ops and actions, wrap the whole handler in `asAgent(req, …)` so auth is identical to REST, and return the transport's response.
- [ ] **Step 4: Verify with curl** against the local dev server: `initialize`, `tools/list` (five tools), `tools/call` for `wetrack_report` and for `wetrack_update_task` with an invalid status (expect `isError`), and a call with a revoked key (expect HTTP 401). Then run `claude mcp add --transport http wetrack http://localhost:3100/api/mcp --header "Authorization: Bearer <key>"` and call a tool from a real session.
- [ ] **Step 5: Extend `scripts/agent-smoke.ts`** with the revoked-key and invalid-status cases against `/api/mcp`.
- [ ] **Step 6: Run** `pnpm typecheck && pnpm lint && pnpm test` and the smoke script.
- [ ] **Step 7: Commit** `feat(agent): MCP endpoint over the agent operations`.

### Task 8: Point the skill at MCP

**Files:**
- Modify: `.claude/skills/wetrack/SKILL.md`
- Modify: `docs/spec.md` (one line)

- [ ] **Step 1: Edit the skill** so it prefers the `wetrack_*` MCP tools when they are listed and falls back to the curl calls otherwise. The report and update workflows stay unchanged.
- [ ] **Step 2: Add the setup line** (`claude mcp add …`) to the skill and to the Team page key card's snippet only after Task 7 is verified.
- [ ] **Step 3: Commit** `docs(agent): prefer MCP tools when available`.

---

## Out of scope

- **Webhooks.** They push events out of WeTrack (Slack already does) and don't carry Claude's updates in. A GitHub-to-WeTrack webhook that links commits and PRs to tasks is a separate feature.
- **Read-only or per-project key scopes.** Add a `scope` column and a check in `asAgent` if keys are ever handed to someone who should not write.
- **Rate limiting.** Nothing in the app rate-limits today. Add a per-key counter in `asAgent` if a key is ever shared beyond one person.
- **Project-level notes** with no task. A note is a task comment. Add a `POST /api/agent/projects/[id]/notes` only if "update the project" without a task proves common.
- **Extracting a shared report builder** from `app/api/cron/digest/route.ts`. Do it when a third caller appears.

## Self-review

- **Coverage:** key storage (3), key UI (5), identity hook (3), read API (4), write API (4), skill (6), MCP (7, 8), docs (6, 8). Each of the six Review Focus items names its owning task.
- **Types:** `asAgent`, `fromResult`, `agentReport`, `agentTasks`, `compactTask`, `matchTasks`, `newAgentKey`, `hashAgentKey`, `bearerToken` and `isAgentKey` are named identically wherever consumed.
- **Open risk to check in Task 3, step 1:** that `AsyncLocalStorage` and `headers()` behave in a route handler under `cacheComponents: true`. The agent path never calls React `cache()` (Task 3, step 4), so the remaining question is only whether the handler runs dynamically; the existing `app/api/*` GET routes already do.
