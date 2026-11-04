import { TableSkeleton } from "@/components/page-skeleton"

// A data table page: prefetched with every link, so a click paints this at once while the rows stream.
export default function Loading() {
  return <TableSkeleton />
}
