import { PageSkeleton } from "@/components/page-skeleton"

// Prefetched with every link (Partial Prefetching), so a click paints this at once while the page streams.
export default function Loading() {
  return <PageSkeleton />
}
