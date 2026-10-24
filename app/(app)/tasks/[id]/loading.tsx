import { PageTransition } from "@/components/motion-bits"
import { FocusSkeleton } from "@/components/page-skeleton"

// The task page's own shape, so opening a task (or moving to a sub-task) never shows the Tasks list skeleton or
// brings back the app header and rail for a moment.
export default function Loading() {
  return (
    <PageTransition enter="none">
      <FocusSkeleton contents />
    </PageTransition>
  )
}
