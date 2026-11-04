"use client"

import { SearchXIcon, UsersIcon } from "lucide-react"
import { useSearchParams } from "next/navigation"

import { UserAvatar } from "@/components/bits"
import { Button } from "@/components/coss/button"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/coss/table"
import {
  DataEmpty,
  DataFrame,
  DataPagination,
  FilterTabs,
  PageHead,
  SearchField,
  setSearchParams,
  SortHead,
  TabCount,
  Toolbar,
  ToolbarEnd,
  useClampPage,
} from "@/components/data-table"
import { RoleMenu } from "@/components/role-menu"
import { HEALTH } from "@/lib/labels"
import { PAGE_SIZE, pageOffset, readPage, readSort, sortRows } from "@/lib/paging"
import { cn } from "@/lib/utils"

export type TeamRow = {
  member: { id: string; name: string; email: string; image: string | null; role: string }
  open: number
  active: number
  overdue: number
  dueThisWeek: number
  doneThisWeek: number
}

type Filter = "all" | "admins" | "overdue"
const FILTERS: Record<Filter, (r: TeamRow) => boolean> = {
  all: () => true,
  admins: (r) => r.member.role !== "member",
  overdue: (r) => r.overdue > 0,
}
const SORTS = ["name", "role", "open", "active", "due", "overdue", "done"] as const
const ROLE_RANK = ["owner", "admin", "member"]
const SORT_BY: Record<(typeof SORTS)[number], (r: TeamRow) => string | number | null> = {
  name: (r) => r.member.name,
  role: (r) => ROLE_RANK.indexOf(r.member.role),
  open: (r) => r.open,
  active: (r) => r.active,
  due: (r) => r.dueThisWeek,
  overdue: (r) => r.overdue,
  done: (r) => r.doneThisWeek,
}
const FRAME = "team-table"

// Everyone in the workspace with their load, as a data table: search by name or email (?q=), filter (?show=),
// sort (?sort=, ?dir=) and page (?page=) in the URL, all on the client since every member is already here. The
// owner changes roles from the Role cell.
export function TeamTable({ rows, team, meId, canEditRoles }: { rows: TeamRow[]; team: string; meId: string; canEditRoles: boolean }) {
  const search = useSearchParams()
  const q = search.get("q")?.trim().toLowerCase() ?? ""
  const filter = (search.get("show") as Filter) in FILTERS ? (search.get("show") as Filter) : "all"
  const page = readPage(search)
  const sort = readSort(search, SORTS)
  const matching = sortRows(
    rows.filter((r) => FILTERS[filter](r) && `${r.member.name} ${r.member.email}`.toLowerCase().includes(q)),
    sort,
    SORT_BY
  )
  const shown = matching.slice(pageOffset(page), pageOffset(page) + PAGE_SIZE)
  useClampPage(page, matching.length, shown.length, false)
  const num = (n: number, className?: string) => (
    <TableCell className={cn("tabular text-right", n === 0 ? "text-muted-foreground" : className)}>{n}</TableCell>
  )

  return (
    <>
      <PageHead tone="info" icon={<UsersIcon />} title="Team" count={rows.length} description={`Everyone in ${team} and what's on their plate this week.`} />
      <Toolbar>
        <FilterTabs
          label="Show"
          value={filter}
          onChange={(f) => setSearchParams({ show: f === "all" ? null : f })}
          items={[
            { value: "all", label: "Everyone" },
            { value: "admins", label: "Owners and admins" },
            { value: "overdue", label: <>With overdue work <TabCount n={rows.filter(FILTERS.overdue).length} /></> },
          ]}
        />
        <ToolbarEnd>
          <SearchField value={q} onChange={(v) => setSearchParams({ q: v || null }, { replace: true })} placeholder="Search people" />
        </ToolbarEnd>
      </Toolbar>
      <DataFrame
        id={FRAME}
        title="Members"
        total={matching.length}
        footer={
          matching.length > 0 && (
            <DataPagination frameId={FRAME} page={page} total={matching.length} onPage={(p) => setSearchParams({ page: p > 1 ? String(p) : null })} />
          )
        }
      >
        {shown.length ? (
          <Table className="min-w-3xl table-fixed">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <SortHead column="name" label="Person" sort={sort} className="ps-5" />
                <SortHead column="role" label="Role" sort={sort} className="w-32" />
                <SortHead column="open" label="Open" sort={sort} className="w-20 text-right" />
                <SortHead column="active" label="In progress" sort={sort} className="w-28 text-right" />
                <SortHead column="due" label="Due in 7 days" sort={sort} className="w-32 text-right" />
                <SortHead column="overdue" label="Overdue" sort={sort} className="w-24 text-right" />
                <SortHead column="done" label="Done this week" sort={sort} className="w-36 pe-5 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((r) => (
                <TableRow key={r.member.id}>
                  <TableCell className="h-14 ps-5">
                    <span className="flex min-w-0 items-center gap-3">
                      <UserAvatar user={r.member} className="size-8 ring-0" />
                      <span className="flex min-w-0 flex-col gap-1">
                        <span className="truncate">{r.member.name}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {r.member.email}
                          {r.member.id === meId && " · you"}
                        </span>
                      </span>
                    </span>
                  </TableCell>
                  <TableCell>
                    <RoleMenu person={r.member} editable={canEditRoles} />
                  </TableCell>
                  {num(r.open)}
                  {num(r.active)}
                  {num(r.dueThisWeek)}
                  {num(r.overdue, HEALTH.overdue.className)}
                  <TableCell className={cn("tabular pe-5 text-right", r.doneThisWeek === 0 && "text-muted-foreground")}>{r.doneThisWeek}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <DataEmpty
            icon={<SearchXIcon />}
            title="Nobody matches"
            description="No one here fits this search and filter."
            action={
              <Button variant="outline" onClick={() => setSearchParams({ q: null, show: null })}>
                Clear filters
              </Button>
            }
          />
        )}
      </DataFrame>
    </>
  )
}
