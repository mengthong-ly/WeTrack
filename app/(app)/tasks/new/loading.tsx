import { PageTransition } from "@/components/motion-bits"
import { FocusSkeleton } from "@/components/page-skeleton"

// A document page (New task, Give feedback): the breadcrumb, the title and body, the side panel.
export default function Loading() {
  return (
    <PageTransition enter="none">
      <FocusSkeleton />
    </PageTransition>
  )
}
