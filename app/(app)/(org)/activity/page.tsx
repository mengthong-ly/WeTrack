import { ActivityIcon } from "lucide-react"
import type { Metadata } from "next"

import { ActivityPager } from "@/components/activity-pager"
import { ActivityRow } from "@/components/activity-row"
import { DataEmpty, DataFrame, PageHead } from "@/components/data-table"
import { Reveal } from "@/components/motion-bits"
import { activityCount, recentActivity } from "@/lib/queries"
import {
  PAGE_SIZE,
  pageCount,
  pageOffset,
  readPage,
  toSearchParams,
} from "@/lib/paging"
import { requireMember } from "@/lib/session"

export const metadata: Metadata = { title: "Activity" }

// Everything the team has done on tasks, newest first, in pages.
export default async function ActivityPage({
  searchParams,
}: PageProps<"/activity">) {
  const me = await requireMember()
  const total = await activityCount(me.orgId)
  const page = Math.min(
    readPage(toSearchParams(await searchParams)),
    pageCount(total)
  )
  const rows = await recentActivity(
    me.orgId,
    PAGE_SIZE,
    undefined,
    pageOffset(page)
  )
  const now = new Date()

  return (
    <Reveal className="flex flex-col gap-6">
      <PageHead
        icon={<ActivityIcon />}
        tone="success"
        title="Activity"
        count={total}
        description="Who did what on tasks across the team, newest first."
      />
      <DataFrame
        id="activity"
        title="Activity log"
        total={total}
        footer={<ActivityPager page={page} total={total} size={PAGE_SIZE} />}
      >
        {rows.length ? (
          <ol className="flex flex-col gap-4 p-5">
            {rows.map((a) => (
              <ActivityRow key={a.id} a={a} now={now} />
            ))}
          </ol>
        ) : (
          <DataEmpty
            icon={<ActivityIcon />}
            title="Nothing yet"
            description="Work on tasks and it shows up here."
          />
        )}
      </DataFrame>
    </Reveal>
  )
}
