import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

const bone = "motion-reduce:animate-none"

// GetStarted's shape inside the auth card: heading, the two tabs, the code field and its button.
export default function Loading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Loading">
      <div className="flex flex-col gap-2">
        <Skeleton className={cn("h-6 w-32 rounded-full", bone)} />
        <Skeleton className={cn("h-4 w-full rounded-full", bone)} />
      </div>
      <Skeleton className={cn("h-10 rounded-full", bone)} />
      <div className="flex flex-col gap-3">
        <Skeleton className={cn("h-12 rounded-full", bone)} />
        <Skeleton className={cn("h-10 rounded-full", bone)} />
      </div>
    </div>
  )
}
