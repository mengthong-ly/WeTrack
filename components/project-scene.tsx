"use client"

import { PauseIcon, PlayIcon, RotateCcwIcon, RotateCwIcon, RouteIcon, XIcon } from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"

import { PillTabs } from "@/components/pill-tabs"
import type { Cam, Mode, SceneApi, ScenePick, SceneMove, Selection, View } from "@/components/project-scene-engine"
import { Button } from "@/components/ui/button"
import Hub from "@/components/ui/hub"
import type { SceneData } from "@/lib/scene"
import { cn } from "@/lib/utils"

export type { ScenePick, SceneMove }

/**
 * The 3D overview: the workspace as hairline tokens on a paper floor you can spin and zoom.
 * A token is a rounded square seen in perspective with its mark engraved on top (a logo or avatar
 * as a duotone, initials until there is one, a status glyph), its name in a badge under the mark
 * and fine hairlines down its sides.
 * Three views of the same work:
 * - Hub: the workspace token at the core, a token per project around it on hairlines. The token
 *   under the pointer rises and its line darkens.
 * - Flow: a tray per status with a block per task, and one real task riding a line.
 * - Team: a token per person raised on a stack of their open work.
 * Five cameras (Overview, Side, Top, Focus, Flight) and play/pause. Click anything to focus it.
 * Status and health colours come from lib/labels.ts. hairline's own Hub (components/ui/hub) is
 * the poster while the scene loads, the fallback without WebGL, and the empty state.
 * The three.js engine is components/project-scene-engine.ts, loaded on demand.
 */

const MODES: { key: Mode; label: string }[] = [
  { key: "hub", label: "Hub" },
  { key: "flow", label: "Flow" },
  { key: "team", label: "Team" },
]
const CAMS: { key: Cam; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "side", label: "Side" },
  { key: "top", label: "Top" },
  { key: "focus", label: "Focus" },
  { key: "flight", label: "Flight" },
]
// Where work is managed, only the views that help find and move things.
const WORK_CAMS = CAMS.filter((c) => c.key === "overview" || c.key === "top" || c.key === "focus")

const glass = "bg-card/70 ring-1 ring-foreground/5 backdrop-blur"

// Not motion's useReducedMotion: that would pull motion into the sign-in pages for one media query.
const REDUCE = "(prefers-reduced-motion: reduce)"
const useReducedMotion = () =>
  useSyncExternalStore(
    (on) => {
      const q = matchMedia(REDUCE)
      q.addEventListener("change", on)
      return () => q.removeEventListener("change", on)
    },
    () => matchMedia(REDUCE).matches,
    () => false
  )

export function ProjectScene({
  data,
  linked = false,
  surface = "card",
  chrome = "inline",
  onPick,
  onMove,
  focusOn,
  highlight = null,
  calm = false,
  toolbar,
  empty: emptyState,
  className,
}: {
  data: SceneData
  /** With `linked`, the focus card opens the project, task or person. */
  linked?: boolean
  /** The surface behind the scene; the hairline poster's plates match it. */
  surface?: "card" | "background"
  /** "page" is the full-screen workspace: the bottom controls sit clear of the dock. */
  chrome?: "inline" | "page"
  /** The workspace: a click hands the pick to the page (which opens a panel) instead of the focus card. */
  onPick?: (pick: ScenePick) => void
  /** The workspace: drag a block onto another status station, or unassigned work onto a person. */
  onMove?: (taskId: string, patch: SceneMove) => void
  /** Fly to and pick this (a new `n` asks again, even for the same thing). */
  focusOn?: { pick: ScenePick; n: number } | null
  /** `kind:id` keys to keep lit (search, filters); other tasks, projects and people dim. */
  highlight?: ReadonlySet<string> | null
  /** Where work is managed: the motion stops at the first touch, fewer cameras, no showpiece cards. */
  calm?: boolean
  /** Shown top right instead of the Live pill. */
  toolbar?: React.ReactNode
  /** Replaces the empty-workspace line. */
  empty?: React.ReactNode
  className?: string
}) {
  const reduce = useReducedMotion()
  const [mode, setMode] = useState<Mode>("hub")
  const [cam, setCam] = useState<Cam>("overview")
  const [paused, setPaused] = useState<boolean | null>(null) // null: follow reduced motion
  const [selected, setSelected] = useState<Selection | null>(null)
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading")
  const playing = paused === null ? !reduce : !paused
  const rootRef = useRef<HTMLDivElement>(null)
  const api = useRef<SceneApi | null>(null)
  const stepRef = useRef<HTMLSpanElement>(null)
  const barRef = useRef<HTMLSpanElement>(null)
  const viewRef = useRef<View | null>(null)
  // The latest callbacks, read when the scene calls out (the scene itself mounts once per data set).
  const calls = useRef({ onPick, onMove, calm })
  const lit = useRef(highlight)
  useEffect(() => {
    calls.current = { onPick, onMove, calm }
    lit.current = highlight
  }, [onPick, onMove, calm, highlight])
  const workspace = !!onPick
  // Calm: motion plays until the first touch, then stays still unless Play is pressed.
  const still = useCallback(() => {
    if (calls.current.calm) setPaused((p) => p ?? true)
  }, [])

  const total = Object.values(data.counts).reduce((a, b) => a + b, 0)
  const open = total - data.counts.completed
  const empty = !data.projects.length && !total && !data.members.length
  const following = data.tasks.find((t) => t.status === "in_progress") ?? data.tasks.find((t) => t.status !== "completed")

  useEffect(() => {
    const root = rootRef.current
    if (!root || empty) return
    let gone = false
    import("@/components/project-scene-engine").then(
      ({ mountScene }) => {
        if (gone) return
        api.current = mountScene(
          root,
          data,
          {
            onReady: () => setState("ready"),
            onFail: () => setState("failed"),
            onSelect: (s, pick) => {
              setCam("focus")
              if (calls.current.onPick) calls.current.onPick(pick)
              else setSelected(s)
            },
            onMove: workspace ? (id, patch) => calls.current.onMove?.(id, patch) : undefined,
            onInput: () => still(),
            highlight: () => lit.current,
            journey: () => ({ step: stepRef.current, bar: barRef.current }),
          },
          viewRef.current
        )
      },
      // The chunk didn't load (offline, a deploy replaced it): the poster's Reload covers it.
      () => !gone && setState("failed")
    )
    return () => {
      gone = true
      if (api.current) viewRef.current = api.current.view()
      api.current?.dispose()
      api.current = null
    }
  }, [data, empty, workspace, still])
  useEffect(() => {
    api.current?.set({ mode, cam, playing })
  }, [mode, cam, playing, state])
  // A pick from outside the canvas: switch to its view and fly there.
  useEffect(() => {
    if (!focusOn || state !== "ready") return
    const m = api.current?.focus(focusOn.pick)
    if (!m) return
    setMode(m)
    setCam("focus")
    setSelected(null)
    still()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a new request (n) should fly
  }, [focusOn?.n, state])

  const pickMode = (m: Mode) => {
    setMode(m)
    setSelected(null)
    if (cam === "focus") setCam("overview")
  }
  const closeCard = () => {
    setSelected(null)
    api.current?.select(false)
    setCam("overview")
  }
  const poster = { "--hairline-plate": surface === "card" ? "var(--card)" : "var(--background)" } as React.CSSProperties

  if (empty) {
    return (
      <div className={cn("relative grid place-items-center gap-2 p-6 text-center", className)}>
        <div className="w-full max-w-64">
          <Hub play style={poster} aria-label="An empty workspace" />
          {emptyState ?? <p className="text-sm text-muted-foreground">No projects yet. Press C to add a task.</p>}
        </div>
      </div>
    )
  }

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div
        ref={rootRef}
        className="absolute inset-0"
        role="img"
        aria-label={`3D view of ${data.projects.length} projects, ${total} tasks and ${data.members.length} people. Drag to move around, Shift-drag or right-drag to turn, scroll or pinch to zoom, click something to focus it.`}
      />

      {/* hairline's Hub holds the place while the scene loads, and stays if WebGL is missing. */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 grid place-items-center transition-opacity duration-300 ease-out",
          state === "ready" && "opacity-0"
        )}
      >
        <div className="w-full max-w-64 px-6 text-center">
          <Hub play={state === "loading"} style={poster} aria-hidden />
          {state === "loading" && <p className="text-sm text-muted-foreground">Setting up your workspace</p>}
          {state === "failed" && (
            <div className="pointer-events-auto flex flex-col items-center gap-3">
              <p className="text-sm text-muted-foreground">
                The 3D view needs WebGL. Turn on hardware acceleration in your browser, then reload.
              </p>
              <Button variant="outline" className="rounded-full" onClick={() => location.reload()}>
                Reload
              </Button>
            </div>
          )}
        </div>
      </div>

      {state === "ready" && (
        <>
          <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2 sm:inset-x-4 sm:top-4">
            <PillTabs
              id="scene-mode"
              className="max-w-full"
              items={MODES.map((m) => ({ key: m.key, label: m.label, active: mode === m.key, onSelect: () => pickMode(m.key) }))}
            />
            {toolbar ?? (
              <p className={cn("hidden h-11 items-center gap-2 rounded-full px-4 text-xs text-muted-foreground sm:flex", glass)}>
                <span className={cn("size-1.5 rounded-full", playing ? "bg-orange-500" : "bg-muted-foreground")} />
                {playing ? "Live" : "Paused"}
                <span className="tabular">{open} open</span>
              </p>
            )}
          </div>

          {selected ? (
            <div className={cn("absolute top-16 left-3 w-64 max-w-[calc(100%-1.5rem)] rounded-panel p-4 shadow-lg sm:left-4", glass)}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm leading-snug">{selected.title}</p>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={closeCard}
                  className="-mt-1 -mr-1 grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground transition-[background-color,scale] hover:bg-muted active:scale-95"
                >
                  <XIcon className="size-3.5" />
                </button>
              </div>
              <p className="tabular mt-1 text-xs text-muted-foreground">{selected.meta}</p>
              {linked && selected.href && (
                <Link href={selected.href} className="mt-3 inline-flex h-8 items-center rounded-full bg-foreground px-3.5 text-xs text-background transition-[scale] active:scale-95">
                  Open
                </Link>
              )}
            </div>
          ) : (
            mode === "flow" &&
            following &&
            !calm && (
              <div className={cn("absolute top-16 left-3 w-64 max-w-[calc(100%-1.5rem)] rounded-panel p-4 shadow-lg sm:left-4", glass)}>
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <RouteIcon className="size-3.5" /> Following one task
                </p>
                <p className="mt-1 truncate text-sm">{following.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  <span ref={stepRef}>Not started</span>
                </p>
                <span className="mt-3 block h-0.5 overflow-hidden rounded-full bg-foreground/10">
                  <span ref={barRef} className="block h-full origin-left scale-x-0 rounded-full bg-foreground" />
                </span>
              </div>
            )
          )}

          <div
            className={cn(
              "absolute inset-x-3 flex items-center justify-center gap-2",
              chrome === "page" ? "bottom-24 sm:bottom-28" : "bottom-3 sm:bottom-4"
            )}
          >
            <PillTabs
              id="scene-cam"
              className="max-w-[calc(100%-3.25rem)]"
              items={(calm ? WORK_CAMS : CAMS).map((c) => ({ key: c.key, label: c.label, active: cam === c.key, onSelect: () => (c.key === cam ? api.current?.home() : setCam(c.key)) }))}
            />
            {/* Turning is also Shift-drag, right-drag or two fingers; these make it findable. */}
            {([[-1, RotateCcwIcon, "Turn left"], [1, RotateCwIcon, "Turn right"]] as const).map(([dir, Icon, name]) => (
              <button
                key={dir}
                type="button"
                onClick={() => {
                  api.current?.turn(dir)
                  still()
                }}
                aria-label={name}
                className={cn("hidden size-11 shrink-0 place-items-center rounded-full transition-[background-color,scale] hover:bg-card active:scale-95 sm:grid", glass)}
              >
                <Icon className="size-4" />
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPaused(playing)}
              aria-label={playing ? "Pause the animation" : "Play the animation"}
              aria-pressed={!playing}
              className={cn("grid size-11 shrink-0 place-items-center rounded-full transition-[background-color,scale] hover:bg-card active:scale-95", glass)}
            >
              {playing ? <PauseIcon className="size-4" /> : <PlayIcon className="size-4" />}
            </button>
          </div>
          {/* The workspace explains its gestures in the legend instead. */}
          {chrome === "inline" && (
            <p className="pointer-events-none absolute right-4 bottom-20 hidden text-xs text-muted-foreground lg:block">
              Drag to move. Shift-drag to turn. Scroll to zoom.
            </p>
          )}
        </>
      )}
    </div>
  )
}
