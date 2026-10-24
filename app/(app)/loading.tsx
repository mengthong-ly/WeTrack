import { PageTransition } from "@/components/motion-bits"
import { PageSkeleton } from "@/components/page-skeleton"

// Prefetched with every link (Partial Prefetching), so a click paints this at once while the page streams.
// In a PageTransition, so it fades out as the page fades in.
export default function Loading() {
  return (
    <PageTransition enter="none">
      <PageSkeleton />
    </PageTransition>
  )
}
