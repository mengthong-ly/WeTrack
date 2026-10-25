import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

const bone = "bg-card/70 motion-reduce:animate-none"

// GetStarted's shape on the auth page: the centred heading, the two tabs, the code field and its button.
export default function Loading() {
  return (
    <div className="flex flex-col gap-8" role="status" aria-label="Loading">
      <div className="flex flex-col items-center gap-3">
        <Skeleton className={cn("h-7 w-36 rounded-full", bone)} />
        <Skeleton className={cn("h-4 w-64 max-w-full rounded-full", bone)} />
      </div>
      <Skeleton className={cn("h-11 rounded-full", bone)} />
      <div className="flex flex-col gap-3">
        <Skeleton className={cn("h-12 rounded-full", bone)} />
        <Skeleton className={cn("h-11 rounded-full", bone)} />
      </div>
    </div>
  )
}
