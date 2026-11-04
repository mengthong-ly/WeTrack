"use client"

import { ArrowDownIcon, ArrowUpIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsUpDownIcon, SearchIcon, XIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/coss/button"
import { CardFrame, CardFrameFooter, CardFrameHeader, CardFrameTitle } from "@/components/coss/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/coss/empty"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/coss/input-group"
import { Kbd } from "@/components/coss/kbd"
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem } from "@/components/coss/pagination"
import { TableHead } from "@/components/coss/table"
import { Tabs, TabsList, TabsTab } from "@/components/coss/tabs"
import { Pick, type Option } from "@/components/pick"
import { nextSort, PAGE_SIZE, pageCount, pageWindow, type Sort, sortParams } from "@/lib/paging"
import { cn, isTyping } from "@/lib/utils"

// The one template every list page uses (Tasks, Feedback, Meetings, Projects): PageHead, a toolbar of
// FilterTabs / SearchField / FilterPick, then a DataFrame holding a coss Table (or DataEmpty) with DataPagination
// in its footer. Checklist: DESIGN.md §4 "Data table page".

// Filters, search and the page live in the URL and change through the History API (no navigation, nothing
// remounts; useServerList fetches the rows). Changing anything but the page starts again from page 1.
export function setSearchParams(updates: Record<string, string | null>, { replace = false } = {}) {
  const q = new URLSearchParams(window.location.search)
  for (const [k, v] of Object.entries(updates)) {
    if (v) q.set(k, v)
    else q.delete(k)
  }
  if (!("page" in updates)) q.delete("page")
  const s = q.toString()
  window.history[replace ? "replaceState" : "pushState"](null, "", s ? `?${s}` : window.location.pathname)
}

// A page that emptied under you (the last row on it was fixed, deleted or filtered away) steps back to the last one.
export function useClampPage(page: number, total: number, rows: number, pending: boolean) {
  useEffect(() => {
    if (!pending && rows === 0 && page > 1) setSearchParams({ page: total ? String(pageCount(total)) : null }, { replace: true })
  }, [page, total, rows, pending])
}

// An icon tile's tint (coss.com's product tiles): the hue at 10% behind, 25% on the edge, the icon in its foreground.
const TONE = {
  info: "border-info/25 bg-info/10 text-info-foreground",
  success: "border-success/25 bg-success/10 text-success-foreground",
  warning: "border-warning/25 bg-warning/10 text-warning-foreground",
  destructive: "border-destructive/25 bg-destructive/10 text-destructive-foreground",
} as const

// The page's title block: a tinted icon tile, the title (with its count) and one line on what lives here; the
// primary action sits at the right, level with the description.
export function PageHead({
  icon,
  tone,
  title,
  count,
  description,
  actions,
}: {
  icon: React.ReactNode
  tone: keyof typeof TONE
  title: string
  count?: number
  description: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className={cn("grid size-10 shrink-0 place-items-center rounded-lg border shadow-xs/5 [&_svg]:size-5", TONE[tone])}
          >
            {icon}
          </span>
          <h1 className="flex items-baseline gap-3 text-3xl font-light tracking-tight sm:text-4xl">
            {title}
            {count !== undefined && <span className="tabular text-base text-muted-foreground">{count}</span>}
          </h1>
        </div>
        <p className="max-w-2xl text-pretty text-muted-foreground">{description}</p>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

// The row above the table: segmented filters on the left, search and pickers on the right; wraps on phones.
export function Toolbar({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>
}

// The toolbar's right side (search, pickers): its own full row on phones, the space left beside the tabs from sm.
export function ToolbarEnd({ children }: { children: React.ReactNode }) {
  return <div className="flex min-w-0 grow basis-full flex-wrap items-center justify-end gap-2 sm:basis-0">{children}</div>
}

export function FilterTabs<T extends string>({
  label,
  value,
  onChange,
  items,
}: {
  label: string
  value: T
  onChange: (v: T) => void
  items: { value: T; label: React.ReactNode }[]
}) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as T)} className="max-w-full">
      <TabsList aria-label={label} className="max-w-full overflow-x-auto [scrollbar-width:none]">
        {items.map((i) => (
          <TabsTab key={i.value} value={i.value} className="gap-1.5 font-normal">
            {i.label}
          </TabsTab>
        ))}
      </TabsList>
    </Tabs>
  )
}

// A count inside a filter tab.
export const TabCount = ({ n }: { n: number }) => (n > 0 ? <span className="tabular text-xs opacity-60">{n}</span> : null)

// Search that writes to the URL a beat after typing stops. "/" focuses it, Esc clears it, and Back / Forward bring
// their own text back into the field.
export function SearchField({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string
  onChange: (q: string) => void
  placeholder: string
  className?: string
}) {
  const [query, setQuery] = useState(value)
  const sent = useRef(value)
  const input = useRef<HTMLInputElement>(null)
  const change = useRef(onChange)
  useEffect(() => {
    change.current = onChange
  })

  useEffect(() => {
    if (value === sent.current) return
    sent.current = value
    setQuery(value)
  }, [value])
  useEffect(() => {
    const q = query.trim()
    if (q === sent.current) return
    const id = setTimeout(() => {
      sent.current = q
      change.current(q)
    }, 250)
    return () => clearTimeout(id)
  }, [query])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !isTyping(e.target)) {
        e.preventDefault()
        input.current?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return (
    <InputGroup className={cn("min-w-0 flex-1 basis-40 sm:max-w-72", className)}>
      <InputGroupAddon>
        <SearchIcon />
      </InputGroupAddon>
      <InputGroupInput
        ref={input}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setQuery("")
            e.currentTarget.blur()
          }
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className="[&::-webkit-search-cancel-button]:hidden"
      />
      <InputGroupAddon align="inline-end">
        {query ? (
          <Button variant="ghost" size="icon-xs" aria-label="Clear search" onClick={() => setQuery("")}>
            <XIcon />
          </Button>
        ) : (
          <Kbd className="max-sm:hidden">/</Kbd>
        )}
      </InputGroupAddon>
    </InputGroup>
  )
}

// A select in the toolbar, dressed as a coss outline control so it sits level with the search field.
export function FilterPick(props: { value: string; onChange: (v: string) => void; options: Option[]; "aria-label": string; className?: string }) {
  return (
    <Pick
      {...props}
      className={cn("h-9 min-w-36 rounded-lg border-input bg-background shadow-xs/5 sm:h-8 dark:bg-input/32", props.className)}
    />
  )
}

// A sortable column header: click for ascending, again for descending, a third time for the table's own order. The
// arrow shows the current direction; idle columns show a faint up/down on hover. The sort lives in the URL (?sort=,
// ?dir=), and changing it goes back to page 1.
export function SortHead<K extends string>({
  column,
  label,
  sort,
  className,
}: {
  column: K
  label: string
  sort: Sort<K>
  className?: string
}) {
  const active = sort.sort === column
  const Icon = !active ? ChevronsUpDownIcon : sort.dir === "asc" ? ArrowUpIcon : ArrowDownIcon
  return (
    <TableHead className={className} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}>
      <button
        type="button"
        data-active={active}
        onClick={() => setSearchParams(sortParams(nextSort(sort, column)))}
        className="group/sort -mx-1.5 inline-flex h-7 items-center gap-1 rounded-md px-1.5 font-medium outline-none transition-[background-color,color] hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[active=true]:text-foreground"
      >
        {label}
        <Icon
          aria-hidden
          className={cn("size-3.5", !active && "opacity-0 group-hover/sort:opacity-60 group-focus-visible/sort:opacity-60")}
        />
      </button>
    </TableHead>
  )
}

// The table's frame (coss CardFrame): a header band with the table's name and how many rows match, the white card
// with the rows, and the pagination footer. While the next rows load the current ones stay, dimmed.
export function DataFrame({
  id,
  title,
  total,
  pending,
  action,
  footer,
  children,
}: {
  id: string
  title: string
  total?: number
  pending?: boolean
  action?: React.ReactNode
  footer?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <CardFrame id={id} aria-busy={pending} className="scroll-mt-20">
      <CardFrameHeader className="flex-row items-center px-5 py-3">
        <CardFrameTitle className="flex items-baseline gap-2 font-medium">
          {title}
          {total !== undefined && <span className="tabular font-normal text-muted-foreground">{total}</span>}
        </CardFrameTitle>
        {action && <div className="ml-auto">{action}</div>}
      </CardFrameHeader>
      <div
        data-slot="card"
        className={cn(
          "relative overflow-hidden rounded-xl border bg-card transition-opacity duration-200",
          pending && "opacity-60"
        )}
      >
        {children}
      </div>
      {footer && <CardFrameFooter className="px-5 py-3">{footer}</CardFrameFooter>}
    </CardFrame>
  )
}

// Nothing to show: a dotted field with a stacked icon tile, what's missing and the one thing to do next. `filtered`
// pages say so and offer to clear, rather than suggesting to create something that may already exist.
export function DataEmpty({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode
  title: string
  description: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <Empty className="bg-dots">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon}</EmptyMedia>
        <EmptyTitle className="font-normal text-lg">{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  )
}

// "Showing 26–50 of 132" and the page buttons (7 slots at most, so they never change width). Paging up from
// the foot of a long page brings the table's top back into view.
export function DataPagination({
  frameId,
  page,
  total,
  onPage,
  size = PAGE_SIZE,
}: {
  frameId: string
  page: number
  total: number
  onPage: (page: number) => void
  size?: number
}) {
  if (total === 0) return null
  const pages = Math.max(1, Math.ceil(total / size))
  const go = (p: number) => {
    onPage(p)
    const frame = document.getElementById(frameId)
    if (frame && frame.getBoundingClientRect().top < 0) frame.scrollIntoView({ block: "start" })
  }
  const from = (page - 1) * size + 1
  const to = Math.min(page * size, total)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="tabular text-sm text-muted-foreground">
        {pages === 1 ? (
          <>
            {total} {total === 1 ? "row" : "rows"}
          </>
        ) : (
          <>
            Showing <span className="text-foreground">{from}–{to}</span> of {total}
          </>
        )}
      </p>
      {pages > 1 && (
        <Pagination className="mx-0 w-auto">
          <PaginationContent>
            <PaginationItem>
              <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => go(page - 1)} aria-label="Previous page">
                <ChevronLeftIcon />
                <span className="max-sm:hidden">Previous</span>
              </Button>
            </PaginationItem>
            {pageWindow(page, pages).map((p, i) =>
              p === null ? (
                <PaginationItem key={`gap-${i}`} className="max-sm:hidden">
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={p} className={cn(p !== page && "max-sm:hidden")}>
                  <Button
                    variant={p === page ? "outline" : "ghost"}
                    size="icon-sm"
                    aria-label={`Page ${p}`}
                    aria-current={p === page ? "page" : undefined}
                    onClick={() => p !== page && go(p)}
                    className="tabular"
                  >
                    {p}
                  </Button>
                </PaginationItem>
              )
            )}
            <PaginationItem>
              <Button variant="ghost" size="sm" disabled={page >= pages} onClick={() => go(page + 1)} aria-label="Next page">
                <span className="max-sm:hidden">Next</span>
                <ChevronRightIcon />
              </Button>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  )
}
