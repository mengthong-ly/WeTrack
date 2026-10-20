# WeTrack: competitive analysis

_2026-10-20 · Sources are official product pages, help centres, docs and changelogs, linked inline.
Some help centres (ClickUp, parts of Asana and Monday) block direct fetching, so those claims are
cited from the vendor's own help-centre URLs as indexed by search. Check them in the live product
before building on an exact key or plan detail._

**Scope.** WeTrack is an internal tracker for a team of about 10 people, replacing a Google Sheet
([spec](../spec.md)). It already has: a `C` shortcut to create a task and `Cmd+Enter` to submit
(`components/app-dock.tsx`, `components/new-task-dialog.tsx`), list views (Open, Mine, In progress,
Completed, All) grouped Overdue / This week / Later / No deadline, a project filter, dashboard tiles,
"Working on now", project progress, a recent-activity feed, a read-only CEO link with a per-person
filter, and per-project client-update drafts. Releases, the timeline and quick capture are planned
(M3, M4). The app has **no** command palette, board view, bulk edit, notifications or @mentions,
scheduled email (email is only used for auth today), project health updates, recurring tasks or
templates.

**Dropped:** Height shut down on 24 Sep 2025, so it is not compared
([AlternativeTo news](https://alternativeto.net/news/2025/3/height-project-management-tool-to-shut-down-by-september-2025/)).

---

## 1. Comparison at a glance

| Capability | Best reference pattern (source) | Others doing it | WeTrack today |
|---|---|---|---|
| Single-key create | Linear: `C` opens the create modal, `Alt+C` creates from a template ([docs](https://linear.app/docs/creating-issues)) | Huly `C` ([docs](https://docs.huly.io/task-tracking/viewing-issues/)); ClickUp `T` ([help](https://help.clickup.com/hc/en-us/articles/6309030550167-Use-keyboard-shortcuts)); Trello `N` ([help](https://support.atlassian.com/trello/docs/keyboard-shortcuts-in-trello/)) | ✅ `C` |
| Command palette | Linear `Cmd/Ctrl+K`, with actions for the current or selected issue ([docs](https://linear.app/docs/select-issues)) | ClickUp `Cmd+K` AI Command Bar ([help](https://help.clickup.com/hc/en-us/articles/6533695640343-What-is-the-AI-Command-Bar)); Plane Power K, contextual actions plus `G`/`O`/`N` sequences ([blog](https://plane.so/blog/introducing-power-k-keyboard-first-navigation-and-actions)) | ❌ |
| One-key property edits | Plane: `S` state, `A` assign, `I` assign to me, `P` priority ([docs](https://docs.plane.so/support/keyboard-shortcuts)) | Trello `Space` assigns yourself, `Q` shows "my cards" ([help](https://support.atlassian.com/trello/docs/keyboard-shortcuts-in-trello/)); Asana `Tab+M` assigns to me ([Asana](https://asana.com/resources/time-saving-features)) | ❌ |
| Natural-language quick add | Todoist Quick Add: `#Project`, `+person`, `p1`, `tomorrow 4pm`, `{deadline}`, `every …` ([help](https://www.todoist.com/help/articles/use-task-quick-add-in-todoist-va4Lhpzz)) | Things NL "When" field ([support](https://culturedcode.com/things/support/articles/9780167/)); Superlist NLP dates ([update](https://www.superlist.com/updates/natural-language-processing)); Trello Butler can read dates from a card name ([Butler](https://trello.com/butler-automation)) | 🟡 planned M4 |
| My tasks / My work | monday My Work: past dates / today / this week / next week / later / no date, with counts ([help](https://support.monday.com/hc/en-us/articles/360019300579-My-Work)) | Linear My Issues in focus order: urgent, blockers, active… ([docs](https://linear.app/docs/my-issues)); Asana Recently assigned / Today / Upcoming / Later ([Asana](https://asana.com/features/project-management/my-tasks)) | ✅ "Mine" view, grouped by deadline |
| Board (kanban) with drag to change status | Trello and Jira boards ([Jira](https://support.atlassian.com/jira-software-cloud/docs/get-started-with-team-managed-projects/)); Basecamp Card Tables ([features](https://basecamp.com/features)) | Asana My Tasks board ([Asana](https://asana.com/features/project-management/my-tasks)); Huly kanban ([docs](https://docs.huly.io/task-tracking/viewing-issues/)) | ❌ list only |
| Bulk edit | Linear: `X` selects, `Shift`+arrows selects a range, `Cmd+A` selects all, then press the property key ([docs](https://linear.app/docs/select-issues)) | Asana multi-select ([Asana](https://asana.com/resources/time-saving-features)) | ❌ |
| Saved / shared views | Linear custom views, saved with `Alt+V`, personal or workspace ([docs](https://linear.app/docs/custom-views)) | Plane saved views ([docs](https://docs.plane.so/core-concepts/views)) | 🟡 filters live in the URL |
| Notifications inbox and mentions | Linear Inbox: auto-subscribed on create, assign or @mention; `J`/`K` to move, `U` read, `H` snooze ([docs](https://linear.app/docs/inbox)) | Asana Inbox plus email: Daily summaries, Mentions only, Weekly reports ([help](https://help.asana.com/s/article/notification-settings)) | ❌ |
| Due-date reminders | monday "When date arrives, notify someone", plus a daily overdue nag while status ≠ Done ([help](https://support.monday.com/hc/en-us/articles/360000227739-Alerts-and-Reminders-with-Automations)) | Trello Butler due-date commands ([Butler](https://trello.com/butler-automation)) | ❌ |
| Recurring tasks | Todoist `every` / `every!` (from the completion date) ([help](https://www.todoist.com/help/articles/introduction-to-recurring-dates-YUYVJJAV)) | ClickUp daily, weekly, or N days after close ([help](https://help.clickup.com/hc/en-us/articles/6309885016471-Use-recurring-tasks)) | ❌ |
| Task templates | ClickUp: save a task as a template, apply with `/temp` ([help](https://help.clickup.com/hc/en-us/articles/6309918176535-Use-task-templates)) | Linear `Alt+C` ([docs](https://linear.app/docs/creating-issues)) | ❌ |
| Check-ins | Basecamp Automatic Check-ins: weekdays 4:30pm "What have you worked on?", Mondays 9am plans ([help](https://5.basecamp-help.com/article/1067-replacing-the-status-meeting)) | none | ❌ |
| Project health updates | Linear: On track / At risk / Off track, scheduled reminders to the lead, "Update missing" ([docs](https://linear.app/docs/initiative-and-project-updates)) | Asana status updates with live charts, sent to members ([Asana](https://asana.com/features/project-management/status-updates)); Teamwork Clients view shows the health of all projects ([Teamwork](https://www.teamwork.com/product/client-management/)) | 🟡 derived progress only |
| Workload per person | Asana Workload: per-person bars against weekly capacity, red when over, counts tasks by default ([Asana](https://asana.com/features/resource-management/workload)) | ClickUp ([help](https://help.clickup.com/hc/en-us/articles/30799838221335-Measure-availability-or-capacity-in-Workload-view)); monday blue/red bubbles ([help](https://support.monday.com/hc/en-us/articles/360010166559-Resource-management-with-Workload)); Teamwork ([support](https://support.teamwork.com/projects/workload/workload-planner-overview)) | 🟡 the CEO link groups "working on now" by person |
| Stuck / at-risk detection | Jira "Work items for attention": stuck items are those past the 85th percentile of time in their current status ([help](https://support.atlassian.com/jira-software-cloud/docs/understand-insights-on-the-board-in-a-team-managed-project/)) | none | 🟡 overdue and due-soon only |
| Digest for the manager | Linear Pulse: daily or weekly summaries in the Inbox around 6am, workspace default "weekly on Mondays" ([docs](https://linear.app/docs/pulse)) | Asana Weekly reports email ([help](https://help.asana.com/s/article/notification-settings)) | ❌ |
| Portfolio / overview | Asana Portfolios: on track / at risk / off track counts across projects ([Asana](https://asana.com/features/goals-reporting/portfolios)) | Jira summary: status, priority, workload ([help](https://support.atlassian.com/jira-software-cloud/docs/what-is-the-summary-view/)); Teamwork Clients view ([Teamwork](https://www.teamwork.com/product/client-management/)) | ✅ dashboard and project list |
| Timeline / Gantt | Basecamp Lineup, all projects on one timeline ([features](https://basecamp.com/features)) | Trello timeline, drag to change dates ([views](https://trello.com/views)); Jira timeline ([help](https://support.atlassian.com/jira-software-cloud/docs/enable-and-disable-the-timeline/)) | 🟡 planned M3 |
| Progress charts | Linear project graph: scope, started and completed lines plus a predicted finish ([docs](https://linear.app/docs/project-graph)) | Jira sprint burndown ([help](https://support.atlassian.com/jira-software-cloud/docs/understand-insights-on-the-board-in-a-team-managed-project/)); Notion chart views ([help](https://www.notion.com/help/charts)) | ❌ |
| Read-only share link | ClickUp public views: view-only, no account needed ([help](https://help.clickup.com/hc/en-us/articles/6309298874775-Share-locations-and-items-with-a-public-link)) | Plane published views and dashboards ([docs](https://docs.plane.so/core-concepts/deploy)); monday shareable view ([help](https://support.monday.com/hc/en-us/articles/360009695080-How-to-share-a-board-view-publicly)) | ✅ CEO link |

---

## 2. Audience 1: the team (daily users)

What makes updating fast in these tools:

- **Keyboard first, mouse optional.**
  - Linear creates with `C` and opens a context-aware command bar with `Cmd/Ctrl+K`. A list
    supports `J`/`K` to move, `X` to select, and a property key to change every selected issue at
    once ([create](https://linear.app/docs/creating-issues), [select](https://linear.app/docs/select-issues)).
  - Plane uses the same grammar: `S` state, `A` assign, `I` assign to me, `P` priority
    ([docs](https://docs.plane.so/support/keyboard-shortcuts)). Its Power K adds `G`+x "go to",
    `O`+x "open" and `N`+x "new" sequences
    ([blog](https://plane.so/blog/introducing-power-k-keyboard-first-navigation-and-actions)).
  - Trello's `Space` (assign or unassign me) and `Q` ("cards assigned to me" filter) are the
    smallest useful set ([help](https://support.atlassian.com/trello/docs/keyboard-shortcuts-in-trello/)).
  - ClickUp ships shortcuts **off by default**, so users must opt in
    ([help](https://help.clickup.com/hc/en-us/articles/6309030550167-Use-keyboard-shortcuts)).
    WeTrack should leave them on and show them in tooltips.
- **Capture now, organise later.**
  - Todoist's Quick Add is the reference grammar: `#Project`, `+Assignee`, `p1–p3`, natural dates,
    `{deadline}`, `!reminder` ([help](https://www.todoist.com/help/articles/use-task-quick-add-in-todoist-va4Lhpzz)).
    When smart date recognition misreads a word, clicking it turns it back into plain text (same
    page). That undo matters when a client name looks like a date.
  - Trello Inbox captures from email, Slack and Teams, then you drag items into boards later
    ([Trello](https://trello.com/inbox)).
- **A "mine" page with a fixed focus order.**
  - Linear My Issues groups by urgency (urgent, blockers, active, backlog…) and sorts by priority
    within each group ([docs](https://linear.app/docs/my-issues)).
  - monday My Work buckets by date and shows a count per bucket
    ([help](https://support.monday.com/hc/en-us/articles/360019300579-My-Work)).
  - WeTrack's "Mine" view already uses date buckets. It lacks a **blocked first** group and an
    **unread/changed** marker.
- **Board plus list over the same data.** Every competitor offers both. Trello and Jira treat the
  board as the tactical "what's happening now" view
  ([Jira](https://support.atlassian.com/jira-software-cloud/docs/get-started-with-team-managed-projects/)),
  and Asana offers list, board and week views even inside My Tasks
  ([Asana](https://asana.com/features/project-management/my-tasks)). Dragging a card between
  status columns is the fastest status update that exists.
- **Notifications scoped by subscription, not by firehose.** Linear subscribes you automatically
  when you create, are assigned, or are @mentioned, and gives the inbox triage keys (`U` read,
  `H` snooze) ([docs](https://linear.app/docs/inbox)). Asana offers email modes from "Mentions only"
  to "Daily summaries" ([help](https://help.asana.com/s/article/notification-settings)).
- **Repeating work.**
  - Recurring tasks: Todoist `every` / `every!`
    ([help](https://www.todoist.com/help/articles/introduction-to-recurring-dates-YUYVJJAV)) and
    ClickUp's "N days after close" ([help](https://help.clickup.com/hc/en-us/articles/6309885016471-Use-recurring-tasks)).
  - Templates: ClickUp's "save task as template" applied with `/temp`
    ([help](https://help.clickup.com/hc/en-us/articles/6309918176535-Use-task-templates)).
  - For an agency these map to "monthly SEO report for client X" and "new landing page = 6 standard
    subtasks".
- **Check-ins instead of standups.** Basecamp asks everyone "What have you worked on?" at 4:30pm on
  weekdays and posts the answers to the whole company
  ([help](https://5.basecamp-help.com/article/1067-replacing-the-status-meeting)). This is low effort
  for the team, but it overlaps with an activity log WeTrack already has.

## 3. Audience 2: the manager / CEO

What gives an at-a-glance read in these tools:

- **One human judgment per project, on a schedule.**
  - Linear project updates: a health value (On track / At risk / Off track) plus rich text.
    Reminders go to the lead on a set day and time, with nudges 1 and 2 working days later, and a
    project shows **"Update missing"** when it goes stale
    ([docs](https://linear.app/docs/initiative-and-project-updates)).
  - Linear now drafts the update from changes since the last one ("Write with Agent")
    ([changelog](https://linear.app/changelog/2026-06-18-agent-assisted-project-updates)).
  - Asana status updates add On hold / Complete, embed live progress charts, and go to every project
    member ([Asana](https://asana.com/features/project-management/status-updates)).
  - Basecamp Hill Charts: someone drags a dot uphill while unknowns remain, then downhill once the
    work is just execution. The position is a person's call, not a computed number, and each move
    is kept in history ([Basecamp](https://basecamp.com/hill-charts)).
  - **Takeaway:** derived numbers (WeTrack's progress and overdue counts) plus one short weekly
    human sentence per client beats either alone.
- **Workload by person.**
  - Asana Workload shows per-person bars against a weekly capacity, turns them red when over, and
    counts tasks by default. Hours or points are optional
    ([Asana](https://asana.com/features/resource-management/workload)). ClickUp and monday use the
    same pattern ([ClickUp](https://help.clickup.com/hc/en-us/articles/30799838221335-Measure-availability-or-capacity-in-Workload-view),
    [monday](https://support.monday.com/hc/en-us/articles/360010166559-Resource-management-with-Workload)).
  - All of these sit on paid tiers (Asana Advanced and above, monday Pro and above). For a team of
    10, **task count per person per week** is enough and needs no new data.
- **"Needs attention" lists, computed.**
  - Jira's board insight lists stuck, blocked and flagged work. "Stuck" means longer in the current
    status than 85% of past items
    ([help](https://support.atlassian.com/jira-software-cloud/docs/understand-insights-on-the-board-in-a-team-managed-project/)).
  - Basecamp's "Unassigned work" report lists to-dos with no owner, and you can assign them inline
    ([37signals](https://updates.37signals.com/post/new-in-basecamp-unassigned)).
  - WeTrack has the activity log needed for both.
- **Digest instead of logging in.**
  - Linear Pulse sends daily or weekly summaries around 6am, with the workspace default set to
    Mondays ([docs](https://linear.app/docs/pulse)).
  - Asana offers Daily summaries and Weekly reports by email
    ([help](https://help.asana.com/s/article/notification-settings)).
  - monday nags daily about overdue items until their status changes
    ([help](https://support.monday.com/hc/en-us/articles/360000227739-Alerts-and-Reminders-with-Automations)).
  - For a CEO who uses a share link rather than an account, a **Monday-morning email** is the
    highest-reach surface.
- **Portfolio and timeline.**
  - Asana Portfolios count projects by on track, at risk and off track
    ([Asana](https://asana.com/features/goals-reporting/portfolios)).
  - Teamwork's Clients view rolls project totals and health up per client
    ([Teamwork](https://www.teamwork.com/product/client-management/)). That is the closest analogue
    to WeTrack, where a project *is* a client.
  - Basecamp Lineup puts every project on one timeline
    ([features](https://basecamp.com/features)).
- **Charts.** Linear's project graph (scope vs completed, predicted finish)
  ([docs](https://linear.app/docs/project-graph)) and Jira burndowns are built for sprint teams.
  For an agency with deadline-driven client work, a timeline with release markers (WeTrack M3)
  answers "when does it ship" better than a burnup does.
- **Read-only sharing.** ClickUp public views (view-only, no account, filters kept)
  ([help](https://help.clickup.com/hc/en-us/articles/6309298874775-Share-locations-and-items-with-a-public-link))
  and Plane published views and dashboards
  ([docs](https://docs.plane.so/core-concepts/deploy)) confirm the pattern WeTrack already ships. The
  gap is *what* the link shows: health per client and workload, not just task lists.

---

## 4. Ranked recommendations

Score = value to a team of about 10 plus the CEO, divided by effort in this codebase (Next.js
Server Actions, Drizzle/Postgres, existing `activity` table, nodemailer, shadcn/Base UI).
**Quick win** is under a day, **Medium** is 2–5 days, **Large** is more than a week.

| # | Feature | Size | Who benefits | Pattern to copy | Notes for WeTrack |
|---|---|---|---|---|---|
| 1 | **Single-key edits on a focused task**: `S` status, `A` assign, `I` assign to me, `P` priority, `Shift+D` deadline, `J`/`K` to move through the list | Quick win | Team | Plane `S/A/I/P` ([docs](https://docs.plane.so/support/keyboard-shortcuts)); Linear `J/K` ([docs](https://linear.app/docs/select-issues)) | Reuses the existing `isTyping` guard in `app-dock.tsx`. Opens the same `Pick` menus already in the task detail. |
| 2 | **Workload strip on the dashboard and CEO link**: open, due-this-week and overdue counts per person, flagged when above N | Quick win | CEO | Asana Workload, counting tasks by default ([Asana](https://asana.com/features/resource-management/workload)) | Pure derivation in `lib/dashboard.ts` from tasks already loaded. Skip hours and capacity settings. |
| 3 | **"Needs attention" list**: blocked, stuck (no activity in ≥ N days while in progress or review), unassigned, overdue | Quick win | CEO and team | Jira "Work items for attention" ([help](https://support.atlassian.com/jira-software-cloud/docs/understand-insights-on-the-board-in-a-team-managed-project/)); Basecamp Unassigned work ([37signals](https://updates.37signals.com/post/new-in-basecamp-unassigned)) | One query on `activity` (latest per task). A fixed N is fine; skip the percentile logic. |
| 4 | **Cmd+K command palette**: jump to a task or project, create, and run 1's actions on the current task | Quick win → Medium | Team | Linear `Cmd+K` ([docs](https://linear.app/docs/select-issues)); Plane Power K ([blog](https://plane.so/blog/introducing-power-k-keyboard-first-navigation-and-actions)) | Tasks are already loaded client-side in the task browser. Use the shadcn Command component (add it to DESIGN.md). |
| 5 | **Weekly digest email to the CEO** (Monday about 8am) plus an opt-in daily "your day" email per person | Medium | CEO, then team | Linear Pulse, weekly on Mondays ([docs](https://linear.app/docs/pulse)); Asana Daily summaries / Weekly reports ([help](https://help.asana.com/s/article/notification-settings)) | Vercel Cron, an API route, then `lib/email.ts`. Reuse the share-page and dashboard summaries, and link to the share link. Content: completed last week, overdue, due this week, per-client health. |
| 6 | **Project health update**: On track / At risk / Off track plus one line, with a weekly reminder and an "Update missing" badge | Medium | CEO | Linear project updates ([docs](https://linear.app/docs/initiative-and-project-updates)); Asana status updates ([Asana](https://asana.com/features/project-management/status-updates)) | New `project_update` table. Pre-select a health from the derived schedule health (any overdue means At risk). Show it on the dashboard, the CEO link and the digest. Pairs with the client-update drafts. |
| 7 | **Board view by status** with drag to change status | Medium | Team | Trello, Jira, Basecamp Card Tables ([features](https://basecamp.com/features)) | A `?layout=board` toggle in the task browser. Native HTML drag and drop plus `Motion` layout; no new dependency. Also offer `S` from 1 as the keyboard path. |
| 8 | **Quick capture with NL parsing (M4)** | Medium | Team | Todoist Quick Add tokens and click-to-unparse ([help](https://www.todoist.com/help/articles/use-task-quick-add-in-todoist-va4Lhpzz)) | Grammar: `#client` (fuzzy match on project), `@person` or `+person`, `!urgent`/`!low`, dates such as `today`, `tomorrow`, `fri`, `next week`, `12 Nov`. Highlight each match as a chip that can be removed. Pure-function parser with a `node --test` file next to it. |
| 9 | **Multi-select and bulk edit**: `X` or Shift-click, then a status, assignee or deadline bar | Medium | Team (weekly triage) | Linear select-issues ([docs](https://linear.app/docs/select-issues)) | One server action that takes `ids[]`. Writes one activity row per task. |
| 10 | **@mentions plus an in-app inbox**: assigned to you, @mentioned, comment on your task, deadline changed on your task | Medium → Large | Team | Linear Inbox auto-subscribe ([docs](https://linear.app/docs/inbox)) | Derive the inbox from the `activity` table plus a per-user `last_seen_at`; no separate notifications table at first. Mentions need a Tiptap mention extension. |
| 11 | **Due-date reminder in the daily email**: due tomorrow, and overdue until status changes | Quick win once 5 exists | Team | monday date reminders ([help](https://support.monday.com/hc/en-us/articles/360000227739-Alerts-and-Reminders-with-Automations)) | The same cron as item 5. No per-rule automation builder. |
| 12 | **Task templates**: "save as template" keeps the subtasks | Medium | Team | ClickUp task templates ([help](https://help.clickup.com/hc/en-us/articles/6309918176535-Use-task-templates)); Linear `Alt+C` ([docs](https://linear.app/docs/creating-issues)) | Worth it only if the same subtask list repeats across clients. Ask the team first. |
| 13 | **Timeline with S/P release markers (M3)** | Large | CEO | Basecamp Lineup ([features](https://basecamp.com/features)); Trello timeline ([views](https://trello.com/views)) | Already planned. Do it after 2, 5 and 6, which answer the CEO's question more cheaply. |
| 14 | **Recurring tasks** | Medium | Team | Todoist `every` / `every!` ([help](https://www.todoist.com/help/articles/introduction-to-recurring-dates-YUYVJJAV)) | Create the next instance on completion (`every!` semantics). Low value unless there are retainer chores. |
| 15 | **Automatic check-ins** | Medium | CEO | Basecamp ([help](https://5.basecamp-help.com/article/1067-replacing-the-status-meeting)) | Skip for now. The activity feed plus the digest covers it. |
| 16 | **Burnup / velocity charts** | Large | CEO | Linear project graph ([docs](https://linear.app/docs/project-graph)) | Skip. These are sprint-team tools, and WeTrack has no estimates. |

### Suggested order

1. **Quick wins (items 1–4):** a keyboard pass, the workload strip, the "needs attention" list and
   Cmd+K. These make daily updates faster and give the CEO two new answers ("who's overloaded",
   "what's stuck") using data that already exists.
2. **Item 5, the digest:** it reaches the CEO without them opening anything and sets up the cron for
   item 11.
3. **Item 6, health updates:** they turn derived numbers into a weekly human signal, and feed the
   digest and the share link.
4. **Items 7–9, board view, quick capture (M4) and bulk edit:** the remaining work to make daily
   updates fast.
5. **Item 13, timeline (M3):** then items 10, 12 and 14 if the team asks for them.
