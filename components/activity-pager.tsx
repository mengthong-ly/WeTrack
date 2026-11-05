"use client"

import { useRouter } from "next/navigation"

import { DataPagination } from "@/components/data-table"

// Page buttons for /activity: the page is rendered on the server, so paging is a navigation.
export function ActivityPager({
  page,
  total,
  size,
}: {
  page: number
  total: number
  size: number
}) {
  const router = useRouter()
  return (
    <DataPagination
      frameId="activity"
      page={page}
      total={total}
      size={size}
      onPage={(p) => router.push(p > 1 ? `/activity?page=${p}` : "/activity")}
    />
  )
}
