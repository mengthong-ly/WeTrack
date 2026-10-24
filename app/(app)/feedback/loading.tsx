import { PageTransition } from "@/components/motion-bits"
import { PageSkeleton } from "@/components/page-skeleton"

export default function Loading() {
  return (
    <PageTransition enter="none">
      <PageSkeleton tiles={false} />
    </PageTransition>
  )
}
