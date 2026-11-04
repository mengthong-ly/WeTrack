"use client"

import { BlocksIcon, SearchXIcon, SendIcon } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

import { ProjectDot } from "@/components/bits"
import { Button } from "@/components/coss/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/coss/table"
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
import { NewProject } from "@/components/new-project"
import { ProjectMenu } from "@/components/project-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { HEALTH, PROJECT_HEALTH } from "@/lib/labels"
import { PAGE_SIZE, pageOffset, readPage, readSort, sortRows } from "@/lib/paging"
import { projectHref, updatesHref } from "@/lib/routes"
import type { ProjectHealth } from "@/lib/schedule"
import { cn } from "@/lib/utils"

export type ProjectRow = {
  id: string
  name: string
  color: string
  logo: string | null
  health: ProjectHealth | null // null: no tasks yet
  progress: number
  open: number
  done: number
  yours: number
  overdue: number
  nextDue: string | null // already formatted
  nextDueOn: string | null // "YYYY-MM-DD", for sorting
  toTell: number
}

type Filter = "all" | "yours" | "overdue"
const FILTERS: Record<Filter, (p: ProjectRow) => boolean> = {
  all: () => true,
  yours: (p) => p.yours > 0,
  overdue: (p) => p.overdue > 0,
}
const FRAME = "projects-table"
const SORTS = ["name", "health", "progress", "open", "overdue", "due"] as const
const HEALTH_RANK = Object.keys(PROJECT_HEALTH) // worst first: Behind, At risk, On track, All done
const SORT_BY: Record<(typeof SORTS)[number], (p: ProjectRow) => string | number | null> = {
  name: (p) => p.name,
  health: (p) => (p.health ? HEALTH_RANK.indexOf(p.health) : null),
  progress: (p) => p.progress,
  open: (p) => p.open,
  overdue: (p) => p.overdue,
  due: (p) => p.nextDueOn,
}

// The picker: every project as a data table that steps into it. Search (?q=), the filter (?show=yours|overdue), the
// sort (?sort=, ?dir=) and the page (?page=) live in the URL; every project is already here, so filtering and paging never wait.
export function ProjectTable({ projects, greeting }: { projects: ProjectRow[]; greeting: React.ReactNode }) {
  const search = useSearchParams()
  const q = search.get("q")?.trim() ?? ""
  const filter = (search.get("show") as Filter) in FILTERS ? (search.get("show") as Filter) : "all"
  const page = readPage(search)
  const sort = readSort(search, SORTS)
  const matching = sortRows(
    projects.filter((p) => FILTERS[filter](p) && p.name.toLowerCase().includes(q.toLowerCase())),
    sort,
    SORT_BY
  )
  const rows = matching.slice(pageOffset(page), pageOffset(page) + PAGE_SIZE)
  useClampPage(page, matching.length, rows.length, false)

  const filtered = q || filter !== "all"
  return (
    <>
      <PageHead tone="warning" icon={<BlocksIcon />} title="Projects" count={projects.length} description={greeting} actions={<NewProject variant="outline" />} />
      <Toolbar>
        <FilterTabs
          label="Show"
          value={filter}
          onChange={(f) => setSearchParams({ show: f === "all" ? null : f })}
          items={[
            { value: "all", label: "All" },
            { value: "yours", label: <>With your work <TabCount n={projects.filter(FILTERS.yours).length} /></> },
            { value: "overdue", label: <>Overdue <TabCount n={projects.filter(FILTERS.overdue).length} /></> },
          ]}
        />
        <ToolbarEnd>
          <SearchField value={q} onChange={(v) => setSearchParams({ q: v || null }, { replace: true })} placeholder="Search projects" />
        </ToolbarEnd>
      </Toolbar>
      <DataFrame
        id={FRAME}
        title={filter === "all" ? "All projects" : filter === "yours" ? "With your work" : "Overdue"}
        total={matching.length}
        footer={
          matching.length > 0 && (
            <DataPagination frameId={FRAME} page={page} total={matching.length} onPage={(p) => setSearchParams({ page: p > 1 ? String(p) : null })} />
          )
        }
      >
        {rows.length ? (
          <Table className="min-w-3xl table-fixed">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <SortHead column="name" label="Project" sort={sort} className="ps-5" />
                <SortHead column="health" label="Health" sort={sort} className="w-28" />
                <SortHead column="progress" label="Progress" sort={sort} className="w-48" />
                <SortHead column="open" label="Open" sort={sort} className="w-20 text-right" />
                <SortHead column="overdue" label="Overdue" sort={sort} className="w-24 text-right" />
                <SortHead column="due" label="Next due" sort={sort} className="w-28" />
                <TableHead className="w-16">
                  <span className="sr-only">Client updates</span>
                </TableHead>
                <TableHead className="w-14 pe-3">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <Row key={p.id} project={p} />
              ))}
            </TableBody>
          </Table>
        ) : filtered ? (
          <DataEmpty
            icon={<SearchXIcon />}
            title="No projects match"
            description="Nothing here fits this search and filter."
            action={
              <Button variant="outline" onClick={() => setSearchParams({ q: null, show: null })}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <DataEmpty icon={<BlocksIcon />} title="No projects yet" description="Start one for each client or piece of work; tasks live inside it." action={<NewProject variant="outline" />} />
        )}
      </DataFrame>
    </>
  )
}

function Row({ project: p }: { project: ProjectRow }) {
  const h = p.health && PROJECT_HEALTH[p.health]
  return (
    <TableRow>
      <TableCell className="h-14 ps-5">
        <span className="flex min-w-0 items-center gap-3">
          <Mark project={p} />
          <span className="flex min-w-0 flex-col gap-1">
            {/* The name's link covers the row; the Client updates link sits above it (z-10). */}
            <Link
              href={projectHref(p.id)}
              className="truncate font-heading font-medium outline-none after:absolute after:inset-0 focus-visible:after:ring-3 focus-visible:after:ring-ring/50 focus-visible:after:ring-inset"
            >
              {p.name}
            </Link>
            <span className="truncate text-xs text-muted-foreground">
              {p.done} done{p.yours > 0 && <span className="text-foreground"> · {p.yours} yours</span>}
            </span>
          </span>
        </span>
      </TableCell>
      <TableCell>
        <span className="flex items-center gap-2 text-muted-foreground">
          <span className={cn("size-2 rounded-full", h?.dot ?? "bg-muted-foreground/40")} />
          {h?.label ?? "No tasks"}
        </span>
      </TableCell>
      <TableCell>
        <span className="flex items-center gap-3">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <span className="block h-full rounded-full bg-foreground" style={{ width: `${p.progress}%` }} />
          </span>
          <span className="tabular w-9 text-right text-muted-foreground">{p.progress}%</span>
        </span>
      </TableCell>
      <TableCell className="tabular text-right">{p.open}</TableCell>
      <TableCell className={cn("tabular text-right", p.overdue > 0 ? HEALTH.overdue.className : "text-muted-foreground")}>{p.overdue}</TableCell>
      <TableCell className="tabular text-muted-foreground">{p.nextDue ?? "—"}</TableCell>
      <TableCell className="relative z-10">
        <Tooltip>
          <TooltipTrigger
            delay={400}
            render={
              <Link
                href={updatesHref(p.id)}
                aria-label={p.toTell ? `Client updates, ${p.toTell} to tell` : "Client updates"}
                className="relative grid size-8 place-items-center rounded-lg text-muted-foreground transition-[background-color,color,scale] hover:bg-muted hover:text-foreground active:scale-95"
              />
            }
          >
            <SendIcon className="size-4" />
            {p.toTell > 0 && <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-foreground" />}
          </TooltipTrigger>
          <TooltipContent className="rounded-full px-3 py-1.5">{p.toTell ? `${p.toTell} to tell the client` : "Client updates"}</TooltipContent>
        </Tooltip>
      </TableCell>
      <TableCell className="relative z-10 pe-3 text-right">
        <ProjectMenu project={p} />
      </TableCell>
    </TableRow>
  )
}

// The project's logo, or its initial on a quiet circle, with its colour as a dot on the edge.
function Mark({ project: p }: { project: ProjectRow }) {
  return (
    <span aria-hidden className="relative shrink-0">
      {p.logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- private, cookie-guarded image; next/image can't fetch it
        <img src={p.logo} alt="" className="size-9 rounded-full bg-background object-contain ring-1 ring-foreground/10" />
      ) : (
        <span className="grid size-9 place-items-center rounded-full bg-muted font-heading text-sm font-medium ring-1 ring-foreground/10">
          {p.name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <ProjectDot color={p.color} className="absolute right-0 bottom-0 size-2.5 ring-2 ring-card" />
    </span>
  )
}
