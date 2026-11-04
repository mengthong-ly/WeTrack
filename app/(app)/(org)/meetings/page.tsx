import type { Metadata } from "next"
import { Suspense } from "react"

import { MeetingTable } from "@/components/meeting-table"
import { Reveal } from "@/components/motion-bits"
import { meetingsKey, PAGE_SIZE, pageOffset, readMeetingParams, toSearchParams } from "@/lib/paging"
import { listMembers, meetingItems, meetingsPage } from "@/lib/queries"
import { requireMember } from "@/lib/session"

export const metadata: Metadata = { title: "Meetings" }

// Every meeting in the workspace as a data table, rendered for the URL (?tab=, ?who=, ?q=, ?page=); after that
// MeetingTable changes the URL without a navigation and fetches /api/meetings.
export default async function MeetingsPage({ searchParams }: PageProps<"/meetings">) {
  const me = await requireMember()
  const p = readMeetingParams(toSearchParams(await searchParams))
  const [page, members] = await Promise.all([
    meetingsPage(me.orgId, p, { email: me.user.email, userId: me.user.id }, pageOffset(p.page), PAGE_SIZE),
    listMembers(me.orgId),
  ])
  const rows = meetingItems(page.rows, members, { userId: me.user.id, email: me.user.email, role: me.role })

  return (
    <Reveal className="flex flex-col gap-6">
      <Suspense>
        <MeetingTable initial={{ key: meetingsKey(p), rows, total: page.total }} />
      </Suspense>
    </Reveal>
  )
}
