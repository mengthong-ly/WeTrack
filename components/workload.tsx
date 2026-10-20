import Link from "next/link"

import { UserAvatar } from "@/components/bits"
import type { workload } from "@/lib/dashboard"
import { HEALTH } from "@/lib/labels"
import { cn } from "@/lib/utils"

type Person = { id: string; name: string; image: string | null }
type Row<M extends Person> = ReturnType<typeof workload<M>>[number]

const COLS = [
  { key: "active", label: "In progress" },
  { key: "dueThisWeek", label: "Due in 7 days" },
  { key: "overdue", label: "Overdue" },
  { key: "doneThisWeek", label: "Done this week" },
] as const

// One row per person: what they hold now, what's coming, what slipped, what they finished.
export function Workload<M extends Person>({
  rows,
  href,
  sub,
  trailing,
}: {
  rows: Row<M>[]
  href?: (id: string) => string
  sub?: (m: M) => React.ReactNode
  trailing?: (m: M) => React.ReactNode
}) {
  // Rows are separate grids, so every column needs a fixed width to line up across rows.
  const grid = cn(
    "grid items-center gap-x-4",
    trailing
      ? "grid-cols-[auto_minmax(0,1fr)_5rem] sm:grid-cols-[auto_minmax(0,1fr)_repeat(4,6rem)_5rem]"
      : "grid-cols-[auto_minmax(0,1fr)] sm:grid-cols-[auto_minmax(0,1fr)_repeat(4,6rem)]"
  )
  return (
    <div className="flex flex-col">
      <div className={cn(grid, "hidden px-3 pb-2 text-xs text-muted-foreground sm:grid")} aria-hidden>
        <span className="col-span-2" />
        {COLS.map((c) => (
          <span key={c.key} className="text-right">{c.label}</span>
        ))}
        {trailing && <span />}
      </div>
      <ul className="flex flex-col">
        {rows.map((r) => {
          const m = r.member
          const name = href ? (
            <Link href={href(m.id)} className="after:absolute after:inset-0 after:rounded-panel hover:underline">
              {m.name}
            </Link>
          ) : (
            m.name
          )
          return (
            <li key={m.id} className={cn(grid, "relative gap-y-3 rounded-panel px-3 py-3 transition-colors", href && "hover:bg-muted/60")}>
              <UserAvatar user={m} className="size-11 ring-0" />
              <div className="min-w-0">
                <p className="truncate">{name}</p>
                {sub && <p className="truncate text-sm text-muted-foreground">{sub(m)}</p>}
              </div>
              {COLS.map((c) => (
                <span
                  key={c.key}
                  className="col-span-1 hidden text-right text-2xl font-light tracking-tight sm:block"
                >
                  <Figure value={r[c.key]} warn={c.key === "overdue"} />
                </span>
              ))}
              {trailing && <span className="justify-self-end">{trailing(m)}</span>}
              {/* Phones: the four figures sit under the name instead of in columns. */}
              <dl className="col-span-full grid grid-cols-2 gap-1.5 sm:hidden">
                {COLS.map((c) => (
                  <div key={c.key} className="flex items-baseline justify-between gap-2 rounded-row bg-muted/60 px-3.5 py-2">
                    <dt className="text-xs text-muted-foreground">{c.label}</dt>
                    <dd className="text-lg font-light">
                      <Figure value={r[c.key]} warn={c.key === "overdue"} />
                    </dd>
                  </div>
                ))}
              </dl>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Figure({ value, warn }: { value: number; warn?: boolean }) {
  return (
    <span className={cn("tabular", value === 0 ? "text-muted-foreground/60" : warn && HEALTH.overdue.className)}>
      {value}
    </span>
  )
}
