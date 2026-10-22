"use client"

import { PauseIcon, PlayIcon, RouteIcon, XIcon } from "lucide-react"
import { useReducedMotion } from "motion/react"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"

import { PillTabs } from "@/components/pill-tabs"
import { Button } from "@/components/ui/button"
import Hub from "@/components/ui/hub"
import type { TaskStatus } from "@/lib/db/enums"
import { HEALTH, PROJECT_HEALTH, STATUS } from "@/lib/labels"
import type { SceneData } from "@/lib/scene"
import { cn } from "@/lib/utils"

/**
 * The 3D overview: the workspace drawn as an isometric hairline figure you can spin and zoom.
 * Three views of the same work:
 * - Hub: the workspace in the middle, a tile per project around it. The tile nearest the
 *   pointer rises and its link turns solid; its neighbours rise less (hairline's Hub, in 3D).
 * - Flow: a platform per status with a cube per task, and one real task walking the line.
 * - Team: a tower per person, one slab per open task.
 * Five cameras (Overview, Side, Top, Focus, Flight) and play/pause, after the Agentic Factory
 * scene. Click anything to focus it. Lines and plates read the theme tokens; status and health
 * colours come from lib/labels.ts. hairline's own Hub (components/ui/hub) is the poster while
 * the scene loads, the fallback without WebGL, and the empty state.
 */

type Mode = "hub" | "flow" | "team"
type Cam = "overview" | "side" | "top" | "focus" | "flight"
type Selection = { title: string; meta: string; href: string | null }
type SceneApi = { set: (s: { mode: Mode; cam: Cam; playing: boolean }) => void; select: (on: boolean) => void; dispose: () => void }
type Hooks = {
  onReady: () => void
  onFail: () => void
  onSelect: (s: Selection) => void
  journey: () => { step: HTMLElement | null; bar: HTMLElement | null }
}

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
const glass = "bg-card/70 ring-1 ring-foreground/5 backdrop-blur"

export function ProjectScene({
  data,
  linked = false,
  surface = "card",
  className,
}: {
  data: SceneData
  /** With `linked`, the focus card opens the project, task or person. */
  linked?: boolean
  /** The surface behind the scene, so plates hide the lines behind them. */
  surface?: "card" | "background"
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

  const total = Object.values(data.counts).reduce((a, b) => a + b, 0)
  const open = total - data.counts.completed
  const empty = !data.projects.length && !total && !data.members.length
  const following = data.tasks.find((t) => t.status === "in_progress") ?? data.tasks.find((t) => t.status !== "completed")

  useEffect(() => {
    const root = rootRef.current
    if (!root || empty) return
    api.current = mountScene(root, data, surface, {
      onReady: () => setState("ready"),
      onFail: () => setState("failed"),
      onSelect: (s) => {
        setSelected(s)
        setCam("focus")
      },
      journey: () => ({ step: stepRef.current, bar: barRef.current }),
    })
    return () => {
      api.current?.dispose()
      api.current = null
    }
  }, [data, surface, empty])
  useEffect(() => {
    api.current?.set({ mode, cam, playing })
  }, [mode, cam, playing, state])

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
          <p className="text-sm text-muted-foreground">No projects yet. Press C to add a task.</p>
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
        aria-label={`3D view of ${data.projects.length} projects, ${total} tasks and ${data.members.length} people. Drag to rotate, scroll or pinch to zoom, click something to focus it.`}
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
            <p className={cn("hidden h-11 items-center gap-2 rounded-full px-4 text-xs text-muted-foreground sm:flex", glass)}>
              <span className={cn("size-1.5 rounded-full", playing ? "bg-orange-500" : "bg-muted-foreground")} />
              {playing ? "Live" : "Paused"}
              <span className="tabular">{open} open</span>
            </p>
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
            following && (
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

          <div className="absolute inset-x-3 bottom-3 flex items-center justify-center gap-2 sm:bottom-4">
            <PillTabs
              id="scene-cam"
              className="max-w-[calc(100%-3.25rem)]"
              items={CAMS.map((c) => ({ key: c.key, label: c.label, active: cam === c.key, onSelect: () => setCam(c.key) }))}
            />
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
          <p className="pointer-events-none absolute right-4 bottom-20 hidden text-xs text-muted-foreground lg:block">
            Drag to rotate. Scroll to zoom.
          </p>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// The scene. Imperative three.js, mounted once per data set; the mode is read every frame.
// ---------------------------------------------------------------------------

type Palette = ReturnType<typeof readPalette>
type Tone = (p: Palette) => THREE.Color

type Item = {
  obj: THREE.Object3D
  y: number
  lift: number
  edge: THREE.LineBasicMaterial
  tone: Tone
  tip: [string, string]
  top: number
  href: string | null
  cell?: [number, number]
  link?: THREE.LineDashedMaterial
}

type Layer = {
  group: THREE.Group
  mats: { m: THREE.Material; base: number }[]
  items: Item[]
  labels: { el: HTMLElement; obj: THREE.Object3D; at: THREE.Vector3 }[]
  weight: number
  radius: number
}

const LANES: { status: TaskStatus; x: number; z: number }[] = [
  { status: "not_started", x: -4.2, z: 0 },
  { status: "in_progress", x: -1.4, z: 0 },
  { status: "review", x: 1.4, z: 0 },
  { status: "completed", x: 4.2, z: 0 },
  { status: "blocked", x: -1.4, z: -2.9 },
]
// Hub tiles fill the 3×3 grid around the hub, front (towards the camera) first.
const CELLS: [number, number][] = [[1, 1], [0, 1], [1, 0], [-1, 1], [1, -1], [-1, 0], [0, -1], [-1, -1]]
const PITCH = 2.7

function readPalette(root: HTMLElement, surface: "card" | "background") {
  const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!
  // The canvas resolves any CSS colour (oklch included) to sRGB.
  const toColor = (css: string) => {
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = "#000"
    ctx.fillStyle = css
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
    return new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace)
  }
  const probe = document.createElement("span")
  probe.style.display = "none"
  root.appendChild(probe)
  const text = (className: string) => {
    probe.className = className
    return toColor(getComputedStyle(probe).color)
  }
  const css = (name: string) => toColor(getComputedStyle(root).getPropertyValue(name).trim())
  const palette = {
    fg: css("--foreground"),
    muted: css("--muted-foreground"),
    plate: css(surface === "card" ? "--card" : "--background"),
    overdue: text(HEALTH.overdue.className),
    status: Object.fromEntries(Object.entries(STATUS).map(([k, v]) => [k, text(v.className)])) as Record<TaskStatus, THREE.Color>,
    health: Object.fromEntries(Object.entries(PROJECT_HEALTH).map(([k, v]) => [k, text(v.className)])) as Record<
      keyof typeof PROJECT_HEALTH,
      THREE.Color
    >,
  }
  probe.remove()
  return palette
}

function mountScene(
  root: HTMLElement,
  data: SceneData,
  surface: "card" | "background",
  hooks: Hooks
): SceneApi {
  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" })
  } catch {
    hooks.onFail()
    return { set: () => {}, select: () => {}, dispose: () => {} }
  }
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches
  let pal = readPalette(root, surface)
  const tints: [THREE.Material & { color: THREE.Color }, Tone][] = []

  let pixelRatio = Math.min(devicePixelRatio, 2)
  renderer.setPixelRatio(pixelRatio)
  renderer.setClearColor(0x000000, 0)
  renderer.domElement.className = "block size-full cursor-grab touch-none outline-none"
  root.appendChild(renderer.domElement)

  const overlay = document.createElement("div")
  overlay.className = "pointer-events-none absolute inset-0 overflow-hidden"
  root.appendChild(overlay)
  const tip = document.createElement("div")
  tip.className =
    "pointer-events-none absolute top-0 left-0 max-w-56 rounded-row bg-card/80 px-3.5 py-2.5 opacity-0 shadow-lg ring-1 ring-foreground/5 backdrop-blur transition-opacity duration-150 ease-out"
  const tipTitle = document.createElement("p")
  tipTitle.className = "truncate text-sm"
  const tipMeta = document.createElement("p")
  tipMeta.className = "tabular mt-0.5 text-xs text-muted-foreground"
  tip.append(tipTitle, tipMeta)
  root.appendChild(tip)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 200)
  camera.position.set(1, 0.85, 1.1).multiplyScalar(20)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(0, 0.4, 0)
  controls.enableDamping = true
  controls.enablePan = false
  controls.dampingFactor = 0.065
  controls.minDistance = 4
  controls.minPolarAngle = 0.05
  controls.maxPolarAngle = Math.PI * 0.475
  controls.rotateSpeed = 0.48
  controls.zoomSpeed = 0.7
  controls.autoRotateSpeed = 0.24

  // --- building blocks -------------------------------------------------------
  const layer = (): Layer => {
    const group = new THREE.Group()
    scene.add(group)
    return { group, mats: [], items: [], labels: [], weight: 0, radius: 4 }
  }
  const fade = <T extends THREE.Material>(L: Layer, m: T, base = 1) => {
    m.transparent = true
    m.opacity = 0
    L.mats.push({ m, base })
    return m
  }
  const tinted = <T extends THREE.Material & { color: THREE.Color }>(m: T, tone: Tone) => {
    m.color.copy(tone(pal))
    tints.push([m, tone])
    return m
  }
  // A plate-filled box drawn by its edges, sitting on y = 0 of its own group.
  const box = (
    L: Layer, parent: THREE.Object3D, w: number, h: number, d: number, x: number, y: number, z: number,
    tone: Tone = (q) => q.muted
  ) => {
    const g = new THREE.Group()
    g.position.set(x, y, z)
    const geo = new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0)
    const fill = new THREE.Mesh(
      geo,
      fade(L, tinted(new THREE.MeshBasicMaterial({ polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }), (p) => p.plate))
    )
    const edge = fade(L, tinted(new THREE.LineBasicMaterial(), tone))
    g.add(fill, new THREE.LineSegments(new THREE.EdgesGeometry(geo), edge))
    parent.add(g)
    return { g, fill, edge }
  }
  const line = (L: Layer, parent: THREE.Object3D, pts: THREE.Vector3[], tone: Tone, base = 1) => {
    const m = fade(L, tinted(new THREE.LineBasicMaterial(), tone), base)
    parent.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), m))
    return m
  }
  const dot = (L: Layer, parent: THREE.Object3D, r: number, x: number, y: number, z: number, tone: Tone) => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 24), fade(L, tinted(new THREE.MeshBasicMaterial(), tone)))
    m.rotation.x = -Math.PI / 2
    m.position.set(x, y, z)
    parent.add(m)
  }
  const label = (L: Layer, obj: THREE.Object3D, at: THREE.Vector3, name: string, meta: string) => {
    const el = document.createElement("div")
    el.className = "absolute top-0 left-0 flex max-w-28 items-baseline gap-1.5 text-xs whitespace-nowrap opacity-0 sm:max-w-40"
    const n = document.createElement("span")
    n.className = "truncate text-foreground"
    n.textContent = name
    const c = document.createElement("span")
    c.className = "tabular text-muted-foreground"
    c.textContent = meta
    el.append(n, c)
    overlay.appendChild(el)
    L.labels.push({ el, obj, at })
  }
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

  // --- Hub -----------------------------------------------------------------
  const hub = layer()
  box(hub, hub.group, 1.5, 0.6, 1.5, 0, 0, 0, (q) => q.fg)
  box(hub, hub.group, 0.8, 0.25, 0.8, 0, 0.6, 0)
  data.projects.slice(0, CELLS.length).forEach((p, i) => {
    const [cx, cz] = CELLS[i]
    const h = 0.16 + Math.min(p.open, 12) * 0.035
    const t = box(hub, hub.group, 1.8, h, 1.8, cx * PITCH, 0, cz * PITCH)
    const len = 1.4
    line(hub, t.g, [v(-0.7, h + 0.002, 0.6), v(0.7, h + 0.002, 0.6)], (q) => q.muted, 0.35)
    line(hub, t.g, [v(-0.7, h + 0.004, 0.6), v(-0.7 + (len * p.progress) / 100, h + 0.004, 0.6)], (q) => q.fg)
    dot(hub, t.g, 0.09, 0.6, h + 0.004, -0.6, (q) => q.health[p.health])
    const link = fade(hub, new THREE.LineDashedMaterial({ dashSize: 0.12, gapSize: 0.1 }))
    const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints([v(0, 0.3, 0), v(cx * PITCH, 0.08, cz * PITCH)]), link)
    ln.computeLineDistances()
    hub.group.add(ln)
    hub.items.push({
      obj: t.g, y: 0, lift: 0, edge: t.edge, tone: (q) => q.muted, top: h, cell: [cx, cz], link,
      tip: [p.name, `${PROJECT_HEALTH[p.health].label} · ${p.progress}% · ${p.open} open`],
      href: `/tasks?project=${p.id}`,
    })
    label(hub, t.g, v(0, 0, 1.05), p.name, String(p.open))
  })

  // --- Flow ----------------------------------------------------------------
  const flow = layer()
  const tasksBy = (s: TaskStatus) => data.tasks.filter((t) => t.status === s)
  for (const lane of LANES) {
    const plate = box(flow, flow.group, 2.3, 0.12, 2.3, lane.x, 0, lane.z)
    tasksBy(lane.status).forEach((t, i) => {
      const col = i % 3, row = Math.floor(i / 3) % 3, level = Math.floor(i / 9)
      const y = 0.12 + level * 0.56
      const c = box(flow, flow.group, 0.48, 0.48, 0.48, lane.x + (col - 1) * 0.64, y, lane.z + (row - 1) * 0.64)
      flow.items.push({
        obj: c.g, y, lift: 0, edge: c.edge, top: 0.48,
        tone: (q) => (t.status === "not_started" ? q.muted : q.status[t.status]),
        tip: [t.title, [t.project, STATUS[t.status].label].filter(Boolean).join(" · ")],
        href: `/tasks/${t.id}`,
      })
    })
    label(flow, plate.g, v(0, 0, 1.4), STATUS[lane.status].label.split(" /")[0], String(data.counts[lane.status]))
  }
  // Arrows between lanes, and a branch back to Blocked.
  for (let i = 0; i < 3; i++) line(flow, flow.group, [v(LANES[i].x + 1.2, 0.06, 0), v(LANES[i + 1].x - 1.2, 0.06, 0)], (q) => q.muted, 0.6)
  line(flow, flow.group, [v(-1.4, 0.06, -1.2), v(-1.4, 0.06, -1.7)], (q) => q.muted, 0.6)
  // One real task walks the line: the one the "Following one task" card names.
  const runner = box(flow, flow.group, 0.3, 0.3, 0.3, -5.6, 0.04, 1.6, (q) => q.fg)
  line(flow, flow.group, [v(-5.6, 0.02, 1.6), v(5.6, 0.02, 1.6)], (q) => q.muted, 0.35)

  // --- Team ----------------------------------------------------------------
  const team = layer()
  const n = data.members.length
  const perRow = n > 4 ? Math.ceil(n / 2) : n
  data.members.forEach((m, i) => {
    const row = Math.floor(i / perRow), col = i % perRow
    const inRow = row === 0 ? Math.min(perRow, n) : n - perRow
    const x = (col - (inRow - 1) / 2) * 2.5
    const z = n > 4 ? (row ? 1.4 : -1.4) : 0
    const tower = new THREE.Group()
    tower.position.set(x, 0, z)
    team.group.add(tower)
    const plate = box(team, tower, 1.6, 0.08, 1.6, 0, 0, 0)
    const slabs = Math.min(m.open, 12)
    const working = m.active - m.blocked
    for (let s = 0; s < slabs; s++) {
      const tone: Tone = s < working ? (q) => q.status.in_progress : s < m.active ? (q) => q.status.blocked : (q) => q.muted
      box(team, tower, 1.1, 0.14, 1.1, 0, 0.12 + s * 0.2, 0, tone)
    }
    if (m.overdue) dot(team, tower, 0.09, 0.6, 0.082, 0.6, (q) => q.overdue)
    const top = 0.12 + slabs * 0.2
    const meta = [`${m.open} open`, m.active && `${m.active} in progress`, m.overdue && `${m.overdue} overdue`]
    team.items.push({
      obj: tower, y: 0, lift: 0, edge: plate.edge, tone: (q) => q.muted, top,
      tip: [m.name, meta.filter(Boolean).join(" · ")],
      href: `/tasks?person=${m.id}`,
    })
    label(team, tower, v(0, 0, 1.0), m.name.split(" ")[0], String(m.open))
  })

  const layers: Record<Mode, Layer> = { hub, flow, team }
  for (const L of Object.values(layers)) {
    const sphere = new THREE.Box3().setFromObject(L.group).getBoundingSphere(new THREE.Sphere())
    L.radius = Math.max(3, sphere.radius)
  }
  const pickables = (L: Layer) => L.items.map((it) => it.obj)

  // --- pointer, camera, sizing, theme -------------------------------------
  const pointer = new THREE.Vector2()
  let mode: Mode = "hub", cam: Cam = "overview", playing = !reduce
  let inside = false, downX = 0, downY = 0, dragging = false, lastInput = performance.now()
  let hot: Item | null = null, selected: Item | null = null
  const ray = new THREE.Raycaster()
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  const hit = new THREE.Vector3()
  const setPointer = (e: PointerEvent) => {
    const r = root.getBoundingClientRect()
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
  }
  const pick = (): Item | null => {
    const L = layers[mode]
    ray.setFromCamera(pointer, camera)
    if (L === hub) {
      // Nearest tile to the pointer on the floor, like hairline's Hub: no need to land on it exactly.
      if (!ray.ray.intersectPlane(ground, hit)) return null
      let best: Item | null = null, dist = PITCH * 0.75
      for (const it of L.items) {
        const d = Math.hypot(it.obj.position.x - hit.x, it.obj.position.z - hit.z)
        if (d < dist) [best, dist] = [it, d]
      }
      return best
    }
    // Lines pick from a unit away; only the plates count.
    const o = ray.intersectObjects(pickables(L), true).find((h) => h.object.type === "Mesh")?.object
    if (!o) return null
    return L.items.find((it) => o.parent === it.obj || o.parent?.parent === it.obj) ?? null
  }

  // --- camera: a goal the camera eases to, after the factory scene -----------
  const goalPos = new THREE.Vector3()
  const goalTarget = new THREE.Vector3(0, 0.4, 0)
  const viewDir = new THREE.Vector3(1, 0.85, 1.1).normalize()
  let animating = true, flightT = 0, runT = 0
  const fit = () =>
    (layers[mode].radius * 1.2) / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.min(1, camera.aspect)
  // Focus in Flow with nothing picked rides along with the walking task.
  const followsRunner = () => cam === "focus" && !selected && mode === "flow"
  const setGoal = () => {
    const d = fit()
    controls.maxDistance = d * 1.8
    const focus = cam === "focus" ? (selected?.obj ?? (mode === "flow" ? runner.g : layers[mode].items[0]?.obj)) : null
    if (focus) {
      focus.getWorldPosition(goalTarget)
      goalTarget.y += 0.3
      goalPos.copy(goalTarget).addScaledVector(viewDir, d * 0.42)
      return
    }
    goalTarget.set(0, 0.4, 0)
    if (cam === "side") goalPos.set(13, 5, 20).normalize().multiplyScalar(d).add(goalTarget)
    else if (cam === "top") goalPos.set(0.01, d, 0.8).add(goalTarget)
    else goalPos.copy(viewDir).multiplyScalar(d).add(goalTarget)
  }

  let width = 1, height = 1, sized = false
  const resize = () => {
    if (!root.clientWidth || !root.clientHeight) return
    width = root.clientWidth
    height = root.clientHeight
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    setGoal()
    animating = true
    if (!sized) {
      // The first real size places the camera at once, without a fly-in.
      sized = true
      camera.position.copy(goalPos)
      controls.target.copy(goalTarget)
      controls.update()
      animating = false
    }
  }
  resize()
  const ro = new ResizeObserver(resize)
  ro.observe(root)

  const el = renderer.domElement
  controls.addEventListener("start", () => {
    dragging = true
    animating = false
    lastInput = performance.now()
  })
  controls.addEventListener("end", () => {
    dragging = false
    lastInput = performance.now()
  })
  const onMove = (e: PointerEvent) => {
    if (e.pointerType === "touch") return
    inside = true
    setPointer(e)
    lastInput = performance.now()
  }
  const onLeave = () => (inside = false)
  const onDown = (e: PointerEvent) => {
    downX = e.clientX
    downY = e.clientY
  }
  const onUp = (e: PointerEvent) => {
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) return
    setPointer(e)
    const it = pick()
    if (!it) return
    selected = it
    cam = "focus"
    setGoal()
    animating = true
    hooks.onSelect({ title: it.tip[0], meta: it.tip[1], href: it.href })
  }
  el.addEventListener("pointermove", onMove)
  el.addEventListener("pointerleave", onLeave)
  el.addEventListener("pointerdown", onDown)
  el.addEventListener("pointerup", onUp)

  let lost = false
  const onLost = (e: Event) => {
    e.preventDefault()
    lost = true
    hooks.onFail()
  }
  const onRestored = () => {
    lost = false
    hooks.onReady()
  }
  el.addEventListener("webglcontextlost", onLost)
  el.addEventListener("webglcontextrestored", onRestored)

  const repaint = () => {
    pal = readPalette(root, surface)
    for (const [m, tone] of tints) m.color.copy(tone(pal))
  }
  const mo = new MutationObserver(repaint)
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })

  let visible = true
  const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting))
  io.observe(root)

  // --- frame loop ----------------------------------------------------------
  const p = new THREE.Vector3()
  const mainLanes = LANES.slice(0, 4)
  let last = performance.now(), raf = 0, ready = false, step = -1, frames = 0, measured = 0
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame)
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    if (!visible || document.hidden || lost || !sized) return
    const ease = (rate: number) => (reduce ? 1 : 1 - Math.exp(-dt * rate))
    if (playing) {
      flightT += dt
      runT = (runT + dt / 9) % 1
    }

    if (inside && !dragging) hot = pick()
    else if (!inside) hot = null
    el.style.cursor = hot ? "pointer" : "grab"

    for (const [key, layerOf] of Object.entries(layers) as [Mode, Layer][]) {
      layerOf.weight += ((key === mode ? 1 : 0) - layerOf.weight) * ease(7)
      const w = layerOf.weight
      layerOf.group.visible = w > 0.01
      if (!layerOf.group.visible) {
        for (const lb of layerOf.labels) lb.el.style.opacity = "0"
        continue
      }
      if (!reduce) layerOf.group.position.y = (1 - w) * -0.5
      for (const { m, base } of layerOf.mats) m.opacity = base * w
      const lit = hot ?? selected
      for (const it of layerOf.items) {
        const on = it === hot || it === selected
        const near = !on && lit?.cell && it.cell && Math.max(Math.abs(lit.cell[0] - it.cell[0]), Math.abs(lit.cell[1] - it.cell[1])) === 1
        const target = on ? (it.cell ? 0.55 : 0.18) : near ? 0.2 : 0
        it.lift += (target - it.lift) * ease(14)
        it.obj.position.y = it.y + it.lift
        it.edge.color.copy(on ? pal.fg : it.tone(pal))
        if (it.link) {
          it.link.gapSize = on ? 0 : 0.1
          it.link.color.copy(on ? pal.fg : pal.muted)
        }
      }
      for (const lb of layerOf.labels) {
        p.copy(lb.at)
        lb.obj.localToWorld(p).project(camera)
        const x = (p.x * 0.5 + 0.5) * width, y = (-p.y * 0.5 + 0.5) * height
        lb.el.style.transform = `translate(${x}px, ${y}px) translateX(-50%)`
        lb.el.style.opacity = String(w)
      }
    }

    // The followed task walks the Flow line, hopping lane to lane, fading in and out at its ends.
    if (layers.flow.weight > 0.01) {
      runner.g.position.x = -5.6 + runT * 11.2
      runner.g.position.y = 0.04 + (reduce ? 0 : Math.abs(Math.sin(runT * Math.PI * 8)) * 0.12)
      runner.edge.opacity = layers.flow.weight * Math.min(1, runT * 8, (1 - runT) * 8)
      const { step: stepEl, bar } = hooks.journey()
      let s = 0
      for (let i = 1; i < mainLanes.length; i++) if (runner.g.position.x > mainLanes[i].x - 1.4) s = i
      if (stepEl && s !== step) {
        step = s
        stepEl.textContent = `${STATUS[mainLanes[s].status].label.split(" /")[0]} · step ${s + 1} of ${mainLanes.length}`
      }
      if (bar) bar.style.transform = `scaleX(${runT})`
    }

    // Camera: ease to the goal; Flight circles; Focus in Flow follows the task.
    if (cam === "flight" && playing && !dragging) {
      const a = flightT * 0.12, d = fit()
      goalTarget.set(0, 0.4, 0)
      goalPos.set(Math.sin(a + 0.55) * d * 0.83, d * (0.5 + Math.sin(a * 0.7) * 0.09), Math.cos(a + 0.55) * d * 0.83).add(goalTarget)
      animating = true
    } else if (followsRunner() && playing && !dragging) {
      setGoal()
      animating = true
    }
    if (animating && !dragging) {
      const k = ease(cam === "flight" ? 2.2 : 3)
      camera.position.lerp(goalPos, k)
      controls.target.lerp(goalTarget, k)
      if (cam !== "flight" && !followsRunner() && camera.position.distanceTo(goalPos) < 0.015 && controls.target.distanceTo(goalTarget) < 0.015)
        animating = false
    }
    controls.autoRotate =
      playing && !reduce && !dragging && !animating && !hot && cam === "overview" && now - lastInput > 6500
    controls.update(dt)

    if (hot && hot !== selected) {
      hot.obj.getWorldPosition(p)
      p.y += hot.top + 0.3
      p.project(camera)
      const x = Math.min(width - 236, Math.max(8, (p.x * 0.5 + 0.5) * width - 40))
      const y = Math.max(56, (-p.y * 0.5 + 0.5) * height - 64)
      tip.style.transform = `translate(${x}px, ${y}px)`
      tipTitle.textContent = hot.tip[0]
      tipMeta.textContent = hot.tip[1]
      tip.style.opacity = "1"
    } else tip.style.opacity = "0"

    renderer.render(scene, camera)
    if (!ready) {
      ready = true
      hooks.onReady()
    }
    // Sustained slow frames lower the raster resolution only; geometry and timing stay the same.
    frames++
    measured += dt
    if (measured > 4) {
      if (frames / measured < 43 && pixelRatio > 1) renderer.setPixelRatio((pixelRatio = Math.max(1, pixelRatio - 0.25)))
      frames = 0
      measured = 0
    }
  }
  raf = requestAnimationFrame(frame)

  return {
    set(next) {
      const moved = next.mode !== mode || next.cam !== cam
      if (next.mode !== mode) {
        mode = next.mode
        if (selected && !layers[mode].items.includes(selected)) selected = null
      }
      if (next.cam !== cam && next.cam === "flight") flightT = 0
      cam = next.cam
      playing = next.playing
      if (moved) {
        lastInput = performance.now()
        setGoal()
        animating = true
      }
    },
    select(on) {
      if (!on) selected = null
    },
    dispose() {
      cancelAnimationFrame(raf)
      ro.disconnect()
      mo.disconnect()
      io.disconnect()
      el.removeEventListener("pointermove", onMove)
      el.removeEventListener("pointerleave", onLeave)
      el.removeEventListener("pointerdown", onDown)
      el.removeEventListener("pointerup", onUp)
      el.removeEventListener("webglcontextlost", onLost)
      el.removeEventListener("webglcontextrestored", onRestored)
      controls.dispose()
      scene.traverse((o) => {
        const m = o as THREE.Mesh
        m.geometry?.dispose()
        ;(Array.isArray(m.material) ? m.material : m.material ? [m.material] : []).forEach((x) => x.dispose())
      })
      renderer.dispose()
      renderer.forceContextLoss()
      el.remove()
      overlay.remove()
      tip.remove()
    },
  }
}
