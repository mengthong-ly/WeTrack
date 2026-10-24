"use client"

import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react"
import { useEffect, ViewTransition } from "react"

import { cn } from "@/lib/utils"

export const spring = { type: "spring", stiffness: 380, damping: 32 } as const

export function CountUp({ value, suffix = "" }: { value: number; suffix?: string }) {
  const reduce = useReducedMotion()
  const mv = useMotionValue(reduce ? value : 0)
  const text = useTransform(mv, (v) => `${Math.round(v)}${suffix}`)
  useEffect(() => {
    const controls = animate(mv, value, { duration: reduce ? 0 : 0.9, ease: [0.16, 1, 0.3, 1] })
    return () => controls.stop()
  }, [mv, value, reduce])
  return <motion.span className="tabular">{text}</motion.span>
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div
      className={cn("h-1.5 overflow-hidden rounded-full bg-foreground/10", className)}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <motion.div
        className="h-full rounded-full bg-foreground"
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  )
}

// Fade-and-rise for page sections, staggered by index.
export function Reveal({
  children,
  index = 0,
  className,
}: {
  children: React.ReactNode
  index?: number
  className?: string
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}

// While a page transition starts, Chrome hit-tests everything to <html>, so the link under the pointer gets a
// mouseleave. Base UI answers hover changes with flushSync (to close its tooltip), and a flushSync then makes React
// skip the transition. Holds those events inside `ref` (the rail, the dock) until it's over.
export function useHoldHoverInTransitions(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current
    if (!el || !CSS.supports("selector(:active-view-transition)")) return
    const hold = (e: Event) => {
      if (document.documentElement.matches(":active-view-transition")) e.stopPropagation()
    }
    const events = ["pointerout", "pointerleave", "mouseout", "mouseleave"]
    for (const type of events) el.addEventListener(type, hold, true)
    return () => {
      for (const type of events) el.removeEventListener(type, hold, true)
    }
  }, [ref])
}

// Route change: the page you leave fades out and lifts away, the next one fades in (its <Reveal>s rise as usual).
// Wrap each page and its loading.tsx so the skeleton hands over the same way. Also plays when a link shows a page
// Next kept hidden. Back/Forward swap instantly: React commits history moves synchronously (scroll restoration).
// Updates inside a page (refreshes, optimistic edits) don't animate.
// `enter="none"` for skeletons, which fade in on their own after a beat: React holds the page's reveal until
// the running transition ends, so a short one lets fast pages land sooner. CSS: `.page-in` / `.page-out` in globals.css.
export function PageTransition({ children, enter = "page-in" }: { children: React.ReactNode; enter?: "page-in" | "none" }) {
  return (
    <ViewTransition enter={enter} exit="page-out" default="none">
      {children}
    </ViewTransition>
  )
}
