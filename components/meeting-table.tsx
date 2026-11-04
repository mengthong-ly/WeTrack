"use client"

import { CalendarClockIcon, MoreHorizontalIcon, PlusIcon, SearchXIcon, SendIcon, VideoIcon, XCircleIcon } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useOptimistic, useTransition } from "react"
import { toast } from "sonner"

import { cancelMeeting, sendMeetingToSlack } from "@/app/actions"
import { UserAvatar } from "@/components/bits"
import { Button } from "@/components/coss/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/coss/table"
import {
  DataEmpty,
  DataFrame,
  DataPagination,
  FilterPick,
  FilterTabs,
  PageHead,
  SearchField,
  setSearchParams,
  SortHead,
  Toolbar,
  ToolbarEnd,
  useClampPage,
} from "@/components/data-table"
import { openNewMeeting } from "@/components/new-meeting-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { meetingsKey, type MeetingTab, readMeetingParams } from "@/lib/paging"
import type { MeetingItem } from "@/lib/queries"
import { taskHref } from "@/lib/routes"
import { type ListPage, useServerList } from "@/lib/use-server-list"

const TABS: { value: MeetingTab; label: string }[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
  { value: "cancelled", label: "Cancelled" },
]
const EMPTY: Record<MeetingTab, { title: string; description: string }> = {
  upcoming: { title: "No meetings coming up", description: "Schedule a Google Meet and invite the team; it shows up here." },
  past: { title: "No past meetings", description: "Meetings move here once they've ended." },
  cancelled: { title: "Nothing cancelled", description: "Cancelled meetings are kept here for the record." },
}
const FRAME = "meetings-table"

// Every meeting in the workspace (yours by default) as a data table: when, what, the task it's about, who's in it,
// and Join / Send to Slack / Cancel for the ones still to come. Tab, Mine / Everyone, search and page live in the URL.
export function MeetingTable({ initial }: { initial: ListPage<MeetingItem> }) {
  const params = readMeetingParams(useSearchParams())
  const { tab, mine, page } = params
  const { rows, total, pending } = useServerList(initial, meetingsKey(params), "/api/meetings")
  useClampPage(page, total, rows.length, pending)
  const [items, remove] = useOptimistic(rows, (list, id: string) => list.filter((m) => m.id !== id))
  const [, start] = useTransition()

  const cancel = (m: MeetingItem) => {
    if (!confirm("Cancel this meeting?")) return
    start(async () => {
      remove(m.id)
      const res = await cancelMeeting(m.id)
      if (res.error) toast.error(res.error)
      else if (res.warning) toast.warning(res.warning)
      else toast.success("Meeting cancelled")
    })
  }
  const send = (m: MeetingItem) =>
    start(async () => {
      const res = await sendMeetingToSlack(m.id)
      if (res.error) toast.error(res.error)
      else toast.success("Sent to Slack")
    })

  const schedule = (
    <Button onClick={() => openNewMeeting()}>
      <PlusIcon />
      New meeting
    </Button>
  )
  const filtered = !!params.q
  const empty = filtered ? (
    <DataEmpty
      icon={<SearchXIcon />}
      title="No meetings match"
      description={`Nothing called “${params.q}” here.`}
      action={
        <Button variant="outline" onClick={() => setSearchParams({ q: null })}>
          Clear search
        </Button>
      }
    />
  ) : (
    <DataEmpty
      icon={<CalendarClockIcon />}
      title={EMPTY[tab].title}
      description={EMPTY[tab].description}
      action={tab === "upcoming" ? schedule : undefined}
    />
  )

  return (
    <>
      <PageHead tone="success"
        icon={<CalendarClockIcon />}
        title="Meetings"
        description="Google Meet calls across the team, with the task each one is about."
        actions={schedule}
      />
      <Toolbar>
        <FilterTabs label="When" value={tab} onChange={(t) => setSearchParams({ tab: t === "upcoming" ? null : t })} items={TABS} />
        <ToolbarEnd>
          <SearchField value={params.q} onChange={(q) => setSearchParams({ q: q || null }, { replace: true })} placeholder="Search meetings" />
          <FilterPick
            aria-label="Whose meetings"
            value={mine ? "mine" : "all"}
            onChange={(v) => setSearchParams({ who: v === "all" ? "all" : null })}
            options={[
              { value: "mine", label: "Mine" },
              { value: "all", label: "Everyone" },
            ]}
          />
        </ToolbarEnd>
      </Toolbar>
      <DataFrame
        id={FRAME}
        title={TABS.find((t) => t.value === tab)!.label}
        total={total}
        pending={pending}
        footer={
          total > 0 && <DataPagination frameId={FRAME} page={page} total={total} onPage={(p) => setSearchParams({ page: p > 1 ? String(p) : null })} />
        }
      >
        {items.length ? (
          <Table className="min-w-3xl table-fixed">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <SortHead column="when" label="When" sort={params} className="w-52 ps-5" />
                <SortHead column="title" label="Meeting" sort={params} />
                <TableHead className="w-48">Task</TableHead>
                <TableHead className="w-36">People</TableHead>
                <TableHead className="w-32 pe-3">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="tabular h-12 ps-5 text-muted-foreground">{m.slot}</TableCell>
                  <TableCell>
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="truncate">{m.title}</span>
                      {m.organizer && <span className="truncate text-xs text-muted-foreground">by {m.organizer.name}</span>}
                    </span>
                  </TableCell>
                  <TableCell>
                    {m.task ? (
                      <Link href={taskHref(m.task.projectId, m.task.id)} className="block truncate hover:underline">
                        {m.task.title}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center -space-x-1.5">
                      {m.people.slice(0, 4).map((p) => (
                        <UserAvatar key={p.id} user={p} className="size-6 ring-2 ring-card" />
                      ))}
                      {m.people.length > 4 && <span className="tabular pl-3 text-xs text-muted-foreground">+{m.people.length - 4}</span>}
                    </span>
                  </TableCell>
                  <TableCell className="pe-3">
                    <span className="flex items-center justify-end gap-1">
                      {m.joinUrl && (
                        <Button variant="outline" size="sm" render={<a href={m.joinUrl} target="_blank" rel="noreferrer" />}>
                          <VideoIcon />
                          Join
                        </Button>
                      )}
                      {m.canCancel && (
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            aria-label={`Actions for ${m.title}`}
                            className="grid size-8 place-items-center rounded-lg text-muted-foreground outline-none transition-[background-color,color,scale] hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95"
                          >
                            <MoreHorizontalIcon className="size-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => send(m)}>
                              <SendIcon />
                              Send to Slack
                            </DropdownMenuItem>
                            <DropdownMenuItem variant="destructive" onClick={() => cancel(m)}>
                              <XCircleIcon />
                              Cancel meeting
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          empty
        )}
      </DataFrame>
    </>
  )
}
