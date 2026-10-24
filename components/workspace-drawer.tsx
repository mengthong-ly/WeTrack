"use client"

import { ChevronRightIcon, XIcon, type LucideIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useLayoutEffect, useState, useSyncExternalStore } from "react"

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { cn } from "@/lib/utils"

/**
 * The workspace's drawers: a right-hand card from sm, a bottom sheet on phones. A drawer opened from
 * inside another nests (Base UI): the one behind shrinks and peeks out. Routed drawers (a task, New
 * task, Client updates) live in the @panel slot, outside the workspace's React tree, so a workspace
 * drawer under one is told it's `behind` and stacks the same way.
 */

const SM = "(min-width: 40rem)"
const subscribe = (cb: () => void) => {
  const q = matchMedia(SM)
  q.addEventListener("change", cb)
  return () => q.removeEventListener("change", cb)
}
function useSide() {
  return useSyncExternalStore(subscribe, () => (matchMedia(SM).matches ? "right" : "down"), () => "right") as "right" | "down"
}

// One width for every drawer, so the one behind always peeks out past the one in front.
const surface =
  "border-0 bg-card text-foreground shadow-xl [--drawer-bleed-background:var(--color-card)] data-[swipe-direction=down]:rounded-t-tile data-[swipe-direction=right]:rounded-l-tile data-[swipe-direction=down]:border-t-0 data-[swipe-direction=right]:border-l-0 data-[swipe-axis=x]:[--drawer-content-width:100%] data-[swipe-axis=x]:sm:[--drawer-content-width:32rem] data-[swipe-axis=y]:[--drawer-content-max-height:calc(100dvh-4rem)]"

export function Layer({
  trigger,
  open,
  onOpenChange,
  onOpenChangeComplete,
  behind = false,
  children,
}: {
  /** Opens the drawer on click (uncontrolled). Leave out and pass `open` to control it. */
  trigger?: React.ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onOpenChangeComplete?: (open: boolean) => void
  /** A routed drawer is open on top: stack like a nested drawer and stay open. */
  behind?: boolean
  children: React.ReactNode
}) {
  const side = useSide()
  return (
    <Drawer
      swipeDirection={side}
      showSwipeHandle={side === "down"}
      open={open}
      onOpenChange={(o) => (o || !behind) && onOpenChange?.(o)}
      onOpenChangeComplete={onOpenChangeComplete}
      disablePointerDismissal={behind}
    >
      {trigger && <DrawerTrigger render={trigger} />}
      <DrawerContent
        className={surface}
        data-nested-drawer-open={behind ? "" : undefined}
        style={behind ? ({ "--nested-drawers": 1 } as React.CSSProperties) : undefined}
      >
        {children}
      </DrawerContent>
    </Drawer>
  )
}

// Title row of a drawer: an optional mark, the title and a quiet line under it, and Close.
export function LayerHead({
  title,
  description,
  mark,
  titleClassName,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  mark?: React.ReactNode
  titleClassName?: string
}) {
  return (
    <header className="flex shrink-0 items-start gap-3 px-6 pt-6 pb-4 max-sm:pt-3">
      {mark}
      <div className="min-w-0 flex-1">
        <DrawerTitle className={cn("truncate text-2xl font-light tracking-tight", titleClassName)}>{title}</DrawerTitle>
        {description && (
          <DrawerDescription render={<div />} className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {description}
          </DrawerDescription>
        )}
      </div>
      <DrawerClose
        aria-label="Close"
        className="-mt-1 -mr-2 grid size-10 shrink-0 place-items-center rounded-full text-muted-foreground transition-[background-color,scale] hover:bg-muted hover:text-foreground active:scale-95"
      >
        <XIcon className="size-4" />
      </DrawerClose>
    </header>
  )
}

export function LayerBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6", className)} {...props} />
}

// A group of rows that each open something: the settings-list look (rounded-panel bg-muted/60 p-1).
export function Rows({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-col rounded-panel bg-muted/60 p-1", className)}>{children}</div>
}

export const rowClass =
  "flex h-12 w-full min-w-0 items-center gap-3 rounded-row px-3 text-left text-sm outline-none transition-[background-color,scale] hover:bg-card focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-97"

// One row: muted icon, label, meta on the right, then a chevron (it opens a drawer) unless `plain`.
export function Row({
  icon: Icon,
  meta,
  destructive,
  plain,
  children,
  className,
  ...props
}: { icon: LucideIcon; meta?: React.ReactNode; destructive?: boolean; plain?: boolean } & React.ComponentProps<"button">) {
  return (
    <button type="button" {...props} className={cn(rowClass, destructive && "text-destructive", className)}>
      <Icon className={cn("size-4 shrink-0", !destructive && "text-muted-foreground")} />
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {meta && <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">{meta}</span>}
      {!plain && <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />}
    </button>
  )
}

// A routed drawer (a task, New task, Client updates): open on arrival, and going back on close.
export function RouteDrawer({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [open, setOpen] = useState(true)
  // Next keeps a closed drawer's page alive (hidden): reset it as it hides, so coming back to the
  // same task opens it again.
  useLayoutEffect(() => () => setOpen(true), [])
  return (
    <Layer open={open} onOpenChange={setOpen} onOpenChangeComplete={(o) => !o && router.back()}>
      {children}
    </Layer>
  )
}
