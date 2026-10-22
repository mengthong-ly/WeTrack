"use client"

import { PauseIcon, PlayIcon, RouteIcon, XIcon } from "lucide-react"
import { useReducedMotion } from "motion/react"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js"
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js"

import { PillTabs } from "@/components/pill-tabs"
import { Button } from "@/components/ui/button"
import Hub from "@/components/ui/hub"
import type { TaskStatus } from "@/lib/db/enums"
import { HEALTH, PROJECT_HEALTH, STATUS } from "@/lib/labels"
import type { SceneData } from "@/lib/scene"
import { cn } from "@/lib/utils"

/**
 * The 3D overview: the workspace built as a machine you can spin and zoom, in the Agentic
 * Factory scene's finishes (steel, ivory, copper, amber glow, real lights and shadows).
 * Three views of the same work:
 * - Hub: the workspace core, a station per project around it on copper lines. The station
 *   nearest the pointer rises and its line glows; its neighbours rise less (hairline's Hub, in 3D).
 * - Flow: a station per status with a block per task, and one real task riding a belt.
 * - Team: a station per person, one block per open task.
 * Five cameras (Overview, Side, Top, Focus, Flight) and play/pause. Click anything to focus it.
 * Status and health colours come from lib/labels.ts. hairline's own Hub (components/ui/hub) is
 * the poster while the scene loads, the fallback without WebGL, and the empty state.
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
  /** The surface behind the scene; the hairline poster's plates match it. */
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
    api.current = mountScene(root, data, {
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
  }, [data, empty])
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
type Std = THREE.MeshStandardMaterial

type Item = {
  obj: THREE.Object3D
  y: number
  lift: number
  glow: Std // lit on hover and focus, like the factory's station strips
  rest: number
  tip: [string, string]
  top: number
  href: string | null
  cell?: [number, number]
  link?: Std
}

type Layer = {
  group: THREE.Group
  mats: THREE.Material[]
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
const TAU = Math.PI * 2
const DECK = 0.235 // top of the deck every view stands on
const BELT_Z = 1.8
const CENTER_Y = 0.7

// The Agentic Factory's finishes, [colour, metalness, roughness]. A fixed material palette, like a
// brand mark (see DESIGN.md); meaning (status, health) still comes from lib/labels.ts.
const FINISH = {
  body: [0x30363f, 0.75, 0.29],
  base: [0x292f37, 0.85, 0.32],
  edge: [0x707986, 0.85, 0.24],
  chrome: [0xc3cad0, 0.92, 0.18],
  dark: [0x12171d, 0.45, 0.38],
  rubber: [0x0b1015, 0.1, 0.6],
  amber: [0xff7a1a, 0.52, 0.28],
  ivory: [0xe0ded4, 0.48, 0.26],
  copper: [0xc57e45, 0.85, 0.3],
} as const
const AMBER = 0xff7a1a
const WARM_WHITE = 0xfff3d7

function readPalette(root: HTMLElement) {
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
  const palette = {
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

function mountScene(root: HTMLElement, data: SceneData, hooks: Hooks): SceneApi {
  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" })
  } catch {
    hooks.onFail()
    return { set: () => {}, select: () => {}, dispose: () => {} }
  }
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches
  let pal = readPalette(root)
  const tints: ((p: Palette) => void)[] = []

  let pixelRatio = Math.min(devicePixelRatio, 2)
  renderer.setPixelRatio(pixelRatio)
  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.12
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
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
  controls.target.set(0, CENTER_Y, 0)
  controls.enableDamping = true
  controls.enablePan = false
  controls.dampingFactor = 0.065
  controls.minDistance = 4
  controls.minPolarAngle = 0.05
  controls.maxPolarAngle = Math.PI * 0.475
  controls.rotateSpeed = 0.48
  controls.zoomSpeed = 0.7
  controls.autoRotateSpeed = 0.24

  // --- light, as the factory sets it: a room for reflections, a warm key with shadows, a cool rim.
  const pmrem = new THREE.PMREMGenerator(renderer)
  const room = new RoomEnvironment()
  const env = pmrem.fromScene(room, 0.04)
  scene.environment = env.texture
  scene.environmentIntensity = 0.62
  room.dispose()
  pmrem.dispose()
  scene.add(new THREE.HemisphereLight(0xdbe5f4, 0x29211a, 2))
  const key = new THREE.DirectionalLight(0xfff1d8, 4.2)
  key.position.set(-4, 12, 7)
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  Object.assign(key.shadow.camera, { left: -10, right: 10, top: 9, bottom: -9, near: 0.5, far: 35 })
  key.shadow.normalBias = 0.035
  key.shadow.bias = -0.0002
  key.shadow.radius = 4
  scene.add(key)
  const rim = new THREE.DirectionalLight(0xc4d4ed, 3.1)
  rim.position.set(3, 7, -8)
  scene.add(rim)
  const warm = new THREE.PointLight(0xffbd42, 28, 20, 2)
  warm.position.set(-4, 5, 3)
  scene.add(warm)
  const front = new THREE.DirectionalLight(0xffffff, 1)
  front.position.set(5, 3, 10)
  scene.add(front)

  // The floor only catches shadows, plus a soft contact shadow under the deck.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), new THREE.ShadowMaterial({ opacity: 0.23 }))
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -0.43
  floor.receiveShadow = true
  scene.add(floor)
  const blob = document.createElement("canvas")
  blob.width = blob.height = 128
  const bctx = blob.getContext("2d")!
  const grad = bctx.createRadialGradient(64, 64, 12, 64, 64, 64)
  grad.addColorStop(0, "rgba(0,0,0,.8)")
  grad.addColorStop(0.55, "rgba(0,0,0,.45)")
  grad.addColorStop(1, "rgba(0,0,0,0)")
  bctx.fillStyle = grad
  bctx.fillRect(0, 0, 128, 128)
  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 13),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(blob), transparent: true, depthWrite: false, opacity: 0.55 })
  )
  contact.rotation.x = -Math.PI / 2
  contact.position.y = -0.415
  scene.add(contact)

  // --- building blocks -------------------------------------------------------
  const layer = (): Layer => {
    const group = new THREE.Group()
    scene.add(group)
    return { group, mats: [], items: [], labels: [], weight: 0, radius: 4 }
  }
  const own = <T extends THREE.Material>(L: Layer, m: T, base = 1) => {
    m.userData.base = base
    L.mats.push(m)
    return m
  }
  // Each view owns its materials, so it can fade on its own.
  const kit = (L: Layer) =>
    Object.fromEntries(
      Object.entries(FINISH).map(([k, [color, metalness, roughness]]) => [
        k,
        own(L, new THREE.MeshStandardMaterial({ color, metalness, roughness })),
      ])
    ) as Record<keyof typeof FINISH, Std>
  // A coloured part that can glow: amber, warm white, or a status / health colour from lib/labels.ts.
  const lit = (L: Layer, tone: Tone | number, glow: number, metalness = 0.2, roughness = 0.25) => {
    const m = own(L, new THREE.MeshStandardMaterial({ metalness, roughness, emissiveIntensity: glow }))
    const paint = (p: Palette) => {
      const c = typeof tone === "number" ? new THREE.Color(tone) : tone(p)
      m.color.copy(c)
      m.emissive.copy(c)
    }
    paint(pal)
    tints.push(paint)
    return m
  }
  const geos = new Map<string, THREE.BufferGeometry>()
  const geo = (key: string, make: () => THREE.BufferGeometry) => {
    let g = geos.get(key)
    if (!g) geos.set(key, (g = make()))
    return g
  }
  const mesh = (parent: THREE.Object3D, g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => {
    const o = new THREE.Mesh(g, m)
    o.position.set(x, y, z)
    o.castShadow = o.receiveShadow = true
    parent.add(o)
    return o
  }
  const box = (parent: THREE.Object3D, w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material, r = 0.04) =>
    mesh(
      parent,
      geo(`b${w},${h},${d},${r}`, () =>
        r ? new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 3, h / 3, d / 3)) : new THREE.BoxGeometry(w, h, d)
      ),
      m, x, y, z
    )
  const cyl = (parent: THREE.Object3D, r: number, h: number, x: number, y: number, z: number, m: THREE.Material, seg = 24) =>
    mesh(parent, geo(`c${r},${h},${seg}`, () => new THREE.CylinderGeometry(r, r, h, seg)), m, x, y, z)
  const tube = (parent: THREE.Object3D, pts: THREE.Vector3[], r: number, m: THREE.Material) => {
    const o = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, r, 8, false), m)
    o.castShadow = true
    parent.add(o)
    return o
  }
  type Kit = ReturnType<typeof kit>
  const screw = (parent: THREE.Object3D, x: number, y: number, z: number, M: Kit) => {
    cyl(parent, 0.055, 0.026, x, y, z, M.chrome, 12)
    box(parent, 0.068, 0.005, 0.009, x, y + 0.014, z, M.dark, 0)
  }
  const gear = (parent: THREE.Object3D, x: number, y: number, z: number, r: number, M: Kit) => {
    const g = new THREE.Group()
    g.position.set(x, y, z)
    parent.add(g)
    cyl(g, r, 0.09, 0, 0, 0, M.copper)
    cyl(g, r * 0.66, 0.105, 0, 0, 0, M.dark)
    cyl(g, r * 0.22, 0.14, 0, 0, 0, M.chrome)
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU
      box(g, r * 0.26, 0.085, r * 0.2, Math.cos(a) * r, 0, Math.sin(a) * r, M.copper, 0.008).rotation.y = -a
    }
    return g
  }
  // The layered deck under each view, after the factory's plate: base, edge, top, an amber strip, feet.
  const deck = (L: Layer, M: Kit, w: number, d: number, z = 0) => {
    const g = L.group
    box(g, w, 0.38, d, 0, -0.09, z, M.base, 0.17)
    box(g, w - 0.2, 0.055, d - 0.17, 0, 0.13, z, M.edge, 0.11)
    box(g, w - 0.31, 0.09, d - 0.29, 0, 0.19, z, M.body, 0.1)
    box(g, w - 0.9, 0.026, 0.032, 0, -0.17, z + d / 2 + 0.005, lit(L, AMBER, 1.5), 0.01)
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        cyl(g, 0.39, 0.25, sx * (w / 2 - 0.9), -0.31, z + sz * (d / 2 - 0.8), M.rubber)
        screw(g, sx * (w / 2 - 0.35), DECK + 0.015, z + sz * (d / 2 - 0.35), M)
      }
  }
  // A station footing: dark base, a glowing strip, a steel top with screws. Returns its top height.
  const footing = (parent: THREE.Object3D, w: number, d: number, strip: Std, M: Kit) => {
    box(parent, w, 0.12, d, 0, 0.06, 0, M.dark, 0.1)
    box(parent, w - 0.08, 0.03, d - 0.08, 0, 0.135, 0, strip, 0.09)
    box(parent, w - 0.02, 0.17, d - 0.05, 0, 0.235, 0, M.body, 0.1)
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) screw(parent, sx * (w / 2 - 0.18), 0.33, sz * (d / 2 - 0.18), M)
    return 0.32
  }
  const label = (L: Layer, obj: THREE.Object3D, at: THREE.Vector3, name: string, meta: string) => {
    const el = document.createElement("div")
    // A small glass pill, so the name reads on the dark deck as well as on the page.
    el.className =
      "absolute top-0 left-0 flex max-w-28 items-baseline gap-1 rounded-full bg-card/85 px-2 py-0.5 text-[11px] whitespace-nowrap opacity-0 shadow-sm ring-1 ring-foreground/5 backdrop-blur sm:max-w-44 sm:gap-1.5 sm:px-2.5 sm:py-1 sm:text-xs"
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

  // --- Hub: the workspace core, a station per project, copper lines between them ---------
  const hub = layer()
  const HM = kit(hub)
  deck(hub, HM, 9.4, 9.4)
  const core = new THREE.Group()
  core.position.y = DECK
  hub.group.add(core)
  const coreTop = footing(core, 1.9, 1.9, lit(hub, AMBER, 1.2), HM)
  box(core, 1.6, 0.62, 1.6, 0, coreTop + 0.31, 0, HM.ivory, 0.13)
  box(core, 1.7, 0.16, 1.7, 0, coreTop + 0.7, 0, HM.amber, 0.045)
  const hubGear = gear(core, 0, coreTop + 0.85, 0, 0.42, HM)
  const fill = lit(hub, AMBER, 1.2)
  data.projects.slice(0, CELLS.length).forEach((p, i) => {
    const [cx, cz] = CELLS[i]
    const t = new THREE.Group()
    t.position.set(cx * PITCH, DECK, cz * PITCH)
    hub.group.add(t)
    const strip = lit(hub, (q) => q.health[p.health], 0.7)
    const base = footing(t, 1.9, 1.7, strip, HM)
    const h = 0.12 + Math.min(p.open, 12) * 0.045
    box(t, 1.6, h, 1.4, 0, base + h / 2, -0.02, HM.ivory, 0.08)
    const top = base + h
    // Progress: a dark track with an amber fill on the tile's face.
    box(t, 1.3, 0.025, 0.12, 0, top + 0.012, 0.45, HM.dark, 0.01)
    const fw = Math.max(0.03, (1.3 * p.progress) / 100)
    box(t, fw, 0.04, 0.12, -0.65 + fw / 2, top + 0.02, 0.45, fill, 0.01)
    // A copper line from the core to the tile; it glows amber while the tile is up.
    const link = own(hub, new THREE.MeshStandardMaterial({ color: FINISH.copper[0], metalness: 0.85, roughness: 0.3, emissive: AMBER, emissiveIntensity: 0 }))
    const end = v(cx * PITCH, 0, cz * PITCH)
    const dir = end.clone().normalize()
    const a = dir.clone().multiplyScalar(1.0).setY(DECK + 0.14)
    const b = end.clone().addScaledVector(dir, cx && cz ? -1.3 : -0.97).setY(DECK + 0.14)
    tube(hub.group, [a, a.clone().lerp(b, 0.5).setY(DECK + 0.38), b], 0.05, link)
    hub.items.push({
      obj: t, y: DECK, lift: 0, glow: strip, rest: 0.7, top, cell: [cx, cz], link,
      tip: [p.name, `${PROJECT_HEALTH[p.health].label} · ${p.progress}% · ${p.open} open`],
      href: `/tasks?project=${p.id}`,
    })
    label(hub, t, v(0, 0, 1.05), p.name, String(p.open))
  })

  // --- Flow: a station per status, a block per task, a belt the followed task rides --------
  const flow = layer()
  const FM = kit(flow)
  deck(flow, FM, 13, 7.6, -1.1)
  const tasksBy = (s: TaskStatus) => data.tasks.filter((t) => t.status === s)
  for (const lane of LANES) {
    const st = new THREE.Group()
    st.position.set(lane.x, DECK, lane.z)
    flow.group.add(st)
    const strip = lit(flow, lane.status === "not_started" ? WARM_WHITE : (q) => q.status[lane.status], 0.9)
    const base = footing(st, 2.3, 2.3, strip, FM)
    tasksBy(lane.status).forEach((t, i) => {
      const col = i % 3, row = Math.floor(i / 3) % 3, level = Math.floor(i / 9)
      const y = DECK + base + level * 0.56
      const c = new THREE.Group()
      c.position.set(lane.x + (col - 1) * 0.64, y, lane.z + (row - 1) * 0.64)
      flow.group.add(c)
      const m = lit(flow, t.status === "not_started" ? FINISH.ivory[0] : (q) => q.status[t.status], 0, 0.45, 0.3)
      box(c, 0.48, 0.48, 0.48, 0, 0.24, 0, m, 0.06)
      flow.items.push({
        obj: c, y, lift: 0, glow: m, rest: 0, top: 0.48,
        tip: [t.title, [t.project, STATUS[t.status].label].filter(Boolean).join(" · ")],
        href: `/tasks/${t.id}`,
      })
    })
    label(flow, st, v(0, 0, 1.4), STATUS[lane.status].label.split(" /")[0], String(data.counts[lane.status]))
  }
  // Copper lines between stations, and a branch back to Blocked.
  for (let i = 0; i < 3; i++)
    tube(flow.group, [v(LANES[i].x + 1.15, DECK + 0.14, 0), v(LANES[i + 1].x - 1.15, DECK + 0.14, 0)], 0.05, FM.copper)
  tube(flow.group, [v(-1.4, DECK + 0.14, -1.15), v(-1.4, DECK + 0.14, -1.75)], 0.05, FM.copper)
  // The belt: a dark frame, chrome rails and instanced treads that move while playing.
  const beltY = DECK + 0.12
  box(flow.group, 11.8, 0.1, 0.7, 0, DECK + 0.05, BELT_Z, FM.dark, 0.05)
  for (const side of [-1, 1]) tube(flow.group, [v(-5.9, beltY + 0.07, BELT_Z + side * 0.36), v(5.9, beltY + 0.07, BELT_Z + side * 0.36)], 0.028, FM.chrome)
  const SLATS = 70
  const slats = new THREE.InstancedMesh(geo("slat", () => new RoundedBoxGeometry(0.12, 0.05, 0.62, 2, 0.012)), FM.body, SLATS)
  slats.receiveShadow = true
  slats.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  flow.group.add(slats)
  const dummy = new THREE.Object3D()
  const moveSlats = (offset: number) => {
    for (let i = 0; i < SLATS; i++) {
      dummy.position.set(-5.8 + ((i * 11.6) / SLATS + offset) % 11.6, beltY, BELT_Z)
      dummy.updateMatrix()
      slats.setMatrixAt(i, dummy.matrix)
    }
    slats.instanceMatrix.needsUpdate = true
  }
  moveSlats(0)
  // One real task rides the belt as a card with an amber halo: the one "Following one task" names.
  const runner = new THREE.Group()
  flow.group.add(runner)
  box(runner, 0.47, 0.71, 0.04, 0, 0.36, 0, FM.ivory, 0.022)
  box(runner, 0.36, 0.12, 0.045, 0, 0.56, 0.004, lit(flow, AMBER, 1.4), 0.01)
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(0.4, 0.414, 40),
    own(flow, new THREE.MeshBasicMaterial({ color: AMBER, transparent: true, side: THREE.DoubleSide, depthWrite: false }), 0.8)
  )
  halo.rotation.x = -Math.PI / 2
  halo.position.y = 0.01
  runner.add(halo)
  runner.position.set(-5.6, beltY + 0.03, BELT_Z)

  // --- Team: a station per person, a stack of blocks per open task ----------------------
  const team = layer()
  const TM = kit(team)
  const n = data.members.length
  const perRow = n > 4 ? Math.ceil(n / 2) : n
  deck(team, TM, Math.max(4, perRow * 2.5 + 1.4), n > 4 ? 6.4 : 3.6)
  const working = lit(team, (q) => q.status.in_progress, 0.15, 0.45, 0.3)
  const stuck = lit(team, (q) => q.status.blocked, 0.15, 0.45, 0.3)
  data.members.forEach((m, i) => {
    const row = Math.floor(i / perRow), col = i % perRow
    const inRow = row === 0 ? Math.min(perRow, n) : n - perRow
    const x = (col - (inRow - 1) / 2) * 2.5
    const z = n > 4 ? (row ? 1.4 : -1.4) : 0
    const tower = new THREE.Group()
    tower.position.set(x, DECK, z)
    team.group.add(tower)
    // The strip turns red when the person has overdue work.
    const strip = lit(team, m.overdue ? (q) => q.overdue : AMBER, 0.8)
    const base = footing(tower, 1.6, 1.6, strip, TM)
    const slabs = Math.min(m.open, 12)
    const active = m.active - m.blocked
    for (let s = 0; s < slabs; s++)
      box(tower, 1.1, 0.16, 1.1, 0, base + 0.1 + s * 0.2, 0, s < active ? working : s < m.active ? stuck : TM.ivory, 0.03)
    // Chrome, not amber: amber would read as one more "In progress" block.
    box(tower, 1.16, 0.06, 1.16, 0, base + 0.05 + slabs * 0.2, 0, TM.chrome, 0.02)
    const top = base + 0.08 + slabs * 0.2
    const meta = [`${m.open} open`, m.active && `${m.active} in progress`, m.overdue && `${m.overdue} overdue`]
    team.items.push({
      obj: tower, y: DECK, lift: 0, glow: strip, rest: 0.8, top,
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
    (layers[mode].radius * 1.05) / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.min(1, camera.aspect)
  // Focus in Flow with nothing picked rides along with the walking task.
  const followsRunner = () => cam === "focus" && !selected && mode === "flow"
  const setGoal = () => {
    const d = fit()
    controls.maxDistance = d * 1.8
    const focus = cam === "focus" ? (selected?.obj ?? (mode === "flow" ? runner : layers[mode].items[0]?.obj)) : null
    if (focus) {
      focus.getWorldPosition(goalTarget)
      goalTarget.y += 0.3
      goalPos.copy(goalTarget).addScaledVector(viewDir, d * 0.42)
      return
    }
    goalTarget.set(0, CENTER_Y, 0)
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
    pal = readPalette(root)
    for (const paint of tints) paint(pal)
  }
  const mo = new MutationObserver(repaint)
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })

  let visible = true
  const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting))
  io.observe(root)

  // --- frame loop ----------------------------------------------------------
  const p = new THREE.Vector3()
  const mainLanes = LANES.slice(0, 4)
  let last = performance.now(), raf = 0, ready = false, step = -1, frames = 0, measured = 0, simT = 0
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame)
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    if (!visible || document.hidden || lost || !sized) return
    const ease = (rate: number) => (reduce ? 1 : 1 - Math.exp(-dt * rate))
    if (playing) {
      simT += dt
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
      // Fading views go transparent; at rest they render opaque, with full shadows.
      for (const m of layerOf.mats) {
        const fading = w < 0.999 || m.userData.base < 1
        if (m.transparent !== fading) {
          m.transparent = fading
          m.needsUpdate = true
        }
        m.opacity = m.userData.base * w
      }
      const lit = hot ?? selected
      for (const it of layerOf.items) {
        const on = it === hot || it === selected
        const near = !on && lit?.cell && it.cell && Math.max(Math.abs(lit.cell[0] - it.cell[0]), Math.abs(lit.cell[1] - it.cell[1])) === 1
        const target = on ? (it.cell ? 0.55 : 0.18) : near ? 0.2 : 0
        it.lift += (target - it.lift) * ease(14)
        it.obj.position.y = it.y + it.lift
        it.glow.emissiveIntensity += ((on ? 3.5 : it.rest) - it.glow.emissiveIntensity) * ease(10)
        if (it.link) it.link.emissiveIntensity += ((on ? 1.6 : 0) - it.link.emissiveIntensity) * ease(10)
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
    hubGear.rotation.y = simT * 1.1
    if (layers.flow.weight > 0.01) {
      runner.position.x = -5.6 + runT * 11.2
      runner.scale.setScalar(Math.max(0.05, Math.min(1, runT * 8, (1 - runT) * 8)))
      if (playing) moveSlats((simT * 1.244) % 11.6)
      const { step: stepEl, bar } = hooks.journey()
      let s = 0
      for (let i = 1; i < mainLanes.length; i++) if (runner.position.x > mainLanes[i].x - 1.4) s = i
      if (stepEl && s !== step) {
        step = s
        stepEl.textContent = `${STATUS[mainLanes[s].status].label.split(" /")[0]} · step ${s + 1} of ${mainLanes.length}`
      }
      if (bar) bar.style.transform = `scaleX(${runT})`
    }

    // Camera: ease to the goal; Flight circles; Focus in Flow follows the task.
    if (cam === "flight" && playing && !dragging) {
      const a = flightT * 0.12, d = fit()
      goalTarget.set(0, CENTER_Y, 0)
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
      env.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      el.remove()
      overlay.remove()
      tip.remove()
    },
  }
}
