import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

// Loading placeholders. They fade in after a beat, so a fast navigation never flashes them,
// and pulse only without reduced motion. Shapes follow the page they stand in for (§3).
const appear = "animate-in fade-in fill-mode-both delay-150 duration-300 ease-out-expo"
const bone = "motion-reduce:animate-none"

/** A page: title, subtitle, a row of tiles and a sheet. */
export function PageSkeleton({ tiles = true }: { tiles?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-8", appear)} role="status" aria-label="Loading">
      <div className="flex flex-col gap-3">
        <Skeleton className={cn("h-9 w-56 max-w-full rounded-full bg-card/70 sm:h-10", bone)} />
        <Skeleton className={cn("h-4 w-36 rounded-full bg-card/70", bone)} />
      </div>
      {tiles && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className={cn("h-40 rounded-tile bg-card/60 sm:h-44", bone)} />
          ))}
        </div>
      )}
      <div className="flex flex-col gap-2.5 rounded-sheet bg-card p-3 shadow-sm sm:p-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className={cn("h-20 rounded-card bg-muted/60", bone)} />
        ))}
      </div>
    </div>
  )
}

/** A focus page (task, New task, Give feedback): the breadcrumb, the document and the side panel. `data-focus` hides the
 *  app header and rail as the page itself does, so moving between tasks never brings them back for a moment.
 *  `contents` adds the task family outline's column (wide screens), there when you move between sub-tasks. */
export function FocusSkeleton({ contents = false }: { contents?: boolean }) {
  return (
    <div data-focus="" className={cn("flex flex-col gap-6", appear)} role="status" aria-label="Loading">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className={cn("h-11 w-64 max-w-full rounded-full bg-card/70", bone)} />
        <Skeleton className={cn("size-11 rounded-full bg-card/70", bone)} />
      </div>
      <div className="@container">
        <div className="flex flex-col gap-6 @4xl:flex-row @4xl:items-start">
          {contents && (
            <div className="hidden w-56 shrink-0 flex-col gap-1 @6xl:flex">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className={cn("h-9 rounded-row bg-card/60", bone)} />
              ))}
            </div>
          )}
          <div className="flex min-w-0 flex-1 flex-col rounded-tile bg-card px-5 py-6 shadow-sm sm:px-10 sm:py-9">
            <Skeleton className={cn("h-11 w-2/3 rounded-full sm:h-12", bone)} />
            <Skeleton className={cn("mt-4 h-4 w-1/2 rounded-full", bone)} />
            <div className="my-6 h-px bg-foreground/5" />
            <div className="flex flex-col gap-2.5">
              <Skeleton className={cn("h-4 w-full rounded-full", bone)} />
              <Skeleton className={cn("h-4 w-5/6 rounded-full", bone)} />
              <Skeleton className={cn("h-4 w-2/3 rounded-full", bone)} />
            </div>
          </div>
          <div className="flex flex-col gap-2 rounded-panel bg-card p-2 shadow-sm @4xl:w-72 @4xl:shrink-0">
            <Skeleton className={cn("h-9 rounded-full bg-muted/60", bone)} />
            <Skeleton className={cn("h-72 rounded-row bg-muted/60", bone)} />
          </div>
        </div>
      </div>
    </div>
  )
}

/** A task's detail (the workspace's task sheet): title, a properties panel, the description. */
export function DetailSkeleton() {
  return (
    <div className={cn("flex flex-col gap-6", appear)} role="status" aria-label="Loading">
      <Skeleton className={cn("h-11 w-3/4 rounded-full", bone)} />
      <Skeleton className={cn("h-44 rounded-panel bg-muted/60", bone)} />
      <div className="flex flex-col gap-2.5">
        <Skeleton className={cn("h-4 w-full rounded-full", bone)} />
        <Skeleton className={cn("h-4 w-5/6 rounded-full", bone)} />
        <Skeleton className={cn("h-4 w-2/3 rounded-full", bone)} />
      </div>
    </div>
  )
}

/** The header's search and account buttons, before the signed-in data arrives. */
export function HeaderToolsSkeleton() {
  return (
    <div className="flex items-center gap-2" aria-hidden>
      <span className="h-11 w-11 rounded-full bg-card/70 ring-1 ring-foreground/5 sm:w-56" />
      <span className="size-11 rounded-full bg-card/70 ring-1 ring-foreground/5" />
    </div>
  )
}
