// Builds the Monday digest email from numbers the dashboard already computed.
// No app imports, so node --test can load it.

export type DigestTask = { title: string; project: string; assignee: string | null }

export type Digest = {
  orgName: string
  today: string // "YYYY-MM-DD"
  appUrl: string
  done: DigestTask[]
  attention: (DigestTask & { reason: string })[]
  projects: { name: string; health: string; open: number; overdue: number; progress: number }[]
  people: { name: string; active: number; dueThisWeek: number; overdue: number; doneThisWeek: number }[]
}

export const LIST_LIMIT = 10

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`
const firstName = (name: string) => name.split(" ")[0]
const who = (t: DigestTask) => [t.project, t.assignee && firstName(t.assignee)].filter(Boolean).join(" · ")
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)

type Section = { heading: string; lines: string[]; empty: string; more: number }

function sections(d: Digest): Section[] {
  const list = <T>(items: T[], line: (x: T) => string) => ({
    lines: items.slice(0, LIST_LIMIT).map(line),
    more: Math.max(0, items.length - LIST_LIMIT),
  })
  return [
    {
      heading: `Done this week (${d.done.length})`,
      empty: "Nothing was finished this week.",
      ...list(d.done, (t) => `${t.title} — ${who(t)}`),
    },
    {
      heading: `Needs attention (${d.attention.length})`,
      empty: "Nothing stuck. Every open task is moving and has an owner.",
      ...list(d.attention, (t) => `${t.reason}: ${t.title} — ${who(t)}`),
    },
    {
      heading: "Projects",
      empty: "No projects with tasks yet.",
      lines: d.projects.map(
        (p) =>
          `${p.name}: ${p.health}, ${p.progress}% done, ${plural(p.open, "open task")}` +
          (p.overdue ? `, ${p.overdue} overdue` : "")
      ),
      more: 0,
    },
    {
      heading: "Team",
      empty: "Nobody has work assigned.",
      lines: d.people.map(
        (p) =>
          `${p.name}: ${p.active} in progress, ${p.dueThisWeek} due in 7 days, ${p.overdue} overdue, ${p.doneThisWeek} done`
      ),
      more: 0,
    },
  ]
}

export function buildDigest(d: Digest) {
  const overdue = d.attention.filter((t) => t.reason === "Overdue").length
  const subject =
    `${d.orgName} this week: ${plural(d.done.length, "task")} done` + (overdue ? `, ${overdue} overdue` : "")
  const intro = `Here's how ${d.orgName} did in the 7 days up to ${d.today}.`
  const s = sections(d)

  const text = [
    intro,
    ...s.map((x) =>
      [
        x.heading,
        ...(x.lines.length ? x.lines.map((l) => `- ${l}`) : [x.empty]),
        ...(x.more ? [`and ${x.more} more`] : []),
      ].join("\n")
    ),
    `Open WeTrack: ${d.appUrl}`,
  ].join("\n\n")

  const html = `<div style="font-family:system-ui,sans-serif;line-height:1.5;max-width:560px">
<p>${esc(intro)}</p>
${s
  .map(
    (x) =>
      `<h3 style="margin:24px 0 8px">${esc(x.heading)}</h3>` +
      (x.lines.length
        ? `<ul style="padding-left:20px;margin:0">${x.lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`
        : `<p style="margin:0">${esc(x.empty)}</p>`) +
      (x.more ? `<p style="margin:4px 0 0">and ${x.more} more</p>` : "")
  )
  .join("\n")}
<p style="margin-top:24px"><a href="${esc(d.appUrl)}">Open WeTrack</a></p>
</div>`

  return { subject, text, html }
}
