"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"

import { PillTabs } from "@/components/pill-tabs"
import type { TaskStatus } from "@/lib/db/enums"
import { HEALTH, PROJECT_HEALTH, STATUS } from "@/lib/labels"
import type { SceneData } from "@/lib/scene"
import { cn } from "@/lib/utils"

/**
 * The 3D overview: the workspace drawn as an isometric hairline figure you can spin.
 * Three views of the same work:
 * - Hub: the workspace in the middle, a tile per project around it. The tile nearest the
 *   pointer rises and its link turns solid; its neighbours rise less.
 * - Flow: a platform per status with a cube per task, and a marker running the line.
 * - Team: a tower per person, one slab per open task.
 * Lines and plates read the theme tokens, status and health colours come from lib/labels.ts.
 */

type Mode = "hub" | "flow" | "team"
const MODES: { key: Mode; label: string }[] = [
  { key: "hub", label: "Hub" },
  { key: "flow", label: "Flow" },
  { key: "team", label: "Team" },
]

export function ProjectScene({
  data,
  linked = false,
  surface = "card",
  className,
}: {
  data: SceneData
  /** Hover shows details; with `linked`, a click opens the project, task or person. */
  linked?: boolean
  /** The surface behind the scene, so plates hide the lines behind them. */
  surface?: "card" | "background"
  className?: string
}) {
  const [mode, setMode] = useState<Mode>("hub")
  const rootRef = useRef<HTMLDivElement>(null)
  const modeRef = useRef(mode)
  const router = useRouter()
  const openRef = useRef<((href: string) => void) | null>(null)

  useEffect(() => {
    modeRef.current = mode
  }, [mode])
  useEffect(() => {
    openRef.current = linked ? (href) => router.push(href) : null
  }, [linked, router])
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    return mountScene(root, data, surface, () => modeRef.current, (href) => openRef.current?.(href))
  }, [data, surface])

  const tasks = Object.values(data.counts).reduce((a, b) => a + b, 0)
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div
        ref={rootRef}
        className="absolute inset-0"
        role="img"
        aria-label={`3D view of ${data.projects.length} projects, ${tasks} tasks and ${data.members.length} people. Drag to rotate.`}
      />
      <PillTabs
        id="scene-mode"
        className="absolute top-3 left-3 max-w-full sm:top-4 sm:left-4"
        items={MODES.map((m) => ({ key: m.key, label: m.label, active: mode === m.key, onSelect: () => setMode(m.key) }))}
      />
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
  getMode: () => Mode,
  open: (href: string) => void
): () => void {
  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  } catch {
    root.innerHTML = `<p class="grid h-full place-items-center text-sm text-muted-foreground">3D view isn't available in this browser.</p>`
    return () => (root.innerHTML = "")
  }
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches
  const coarse = matchMedia("(pointer: coarse)").matches
  let pal = readPalette(root, surface)
  const tints: [THREE.Material & { color: THREE.Color }, Tone][] = []

  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.setClearColor(0x000000, 0)
  renderer.domElement.className = "block size-full touch-pan-y outline-none"
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
  controls.enableZoom = false // the wheel scrolls the page
  controls.enableRotate = !coarse // a finger scrolls the page; taps still pick
  controls.minPolarAngle = 0.35
  controls.maxPolarAngle = 1.25
  controls.rotateSpeed = 0.5
  controls.autoRotateSpeed = 0.35

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
  const runner = box(flow, flow.group, 0.22, 0.22, 0.22, -5.6, 0.04, 1.6, (q) => q.fg)
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

  // --- sizing, pointer, theme ---------------------------------------------
  let width = 1, height = 1
  const resize = () => {
    width = root.clientWidth || 1
    height = root.clientHeight || 1
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }
  resize()
  const ro = new ResizeObserver(resize)
  ro.observe(root)

  const pointer = new THREE.Vector2()
  let inside = false, downX = 0, downY = 0, lastInput = 0
  let hot: Item | null = null
  const ray = new THREE.Raycaster()
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  const hit = new THREE.Vector3()
  const setPointer = (e: PointerEvent) => {
    const r = root.getBoundingClientRect()
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
  }
  const pick = (): Item | null => {
    const L = layers[getMode()]
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
  const el = renderer.domElement
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
    lastInput = performance.now()
  }
  const onUp = (e: PointerEvent) => {
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) return
    setPointer(e)
    const it = pick()
    // A tap shows the details first; a second tap on the same thing opens it.
    if (e.pointerType === "touch" && it !== hot) {
      inside = true
      hot = it
      return
    }
    if (it?.href) open(it.href)
  }
  el.addEventListener("pointermove", onMove)
  el.addEventListener("pointerleave", onLeave)
  el.addEventListener("pointerdown", onDown)
  el.addEventListener("pointerup", onUp)

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
  const offset = new THREE.Vector3()
  const p = new THREE.Vector3()
  const dir = new THREE.Vector3(1, 0.85, 1.1).normalize()
  let dist = 0, last = performance.now(), raf = 0, runT = 0
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame)
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    if (!visible || document.hidden) return
    const mode = getMode()
    const L = layers[mode]
    const ease = (rate: number) => (reduce ? 1 : 1 - Math.exp(-dt * rate))

    if (inside) {
      const it = pick()
      if (it || !coarse) hot = it
    } else if (!coarse) hot = null
    if (hot && !L.items.includes(hot)) hot = null

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
      for (const it of layerOf.items) {
        const on = it === hot
        const near = !on && hot?.cell && it.cell && Math.max(Math.abs(hot.cell[0] - it.cell[0]), Math.abs(hot.cell[1] - it.cell[1])) === 1
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

    // The runner walks the Flow line, fading in and out at its ends.
    if (!reduce && layers.flow.weight > 0.01) {
      runT = (runT + dt / 7) % 1
      runner.g.position.x = -5.6 + runT * 11.2
      runner.g.position.y = 0.04 + Math.abs(Math.sin(runT * Math.PI * 8)) * 0.12
      runner.edge.opacity = layers.flow.weight * Math.min(1, runT * 8, (1 - runT) * 8)
    }

    // Fit the active view: distance eases between views, the orbit angle stays the user's.
    const fit = (L.radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) / Math.min(1, camera.aspect)
    dist = dist ? dist + (fit - dist) * ease(5) : fit
    controls.autoRotate = !reduce && !hot && performance.now() - lastInput > 5000
    controls.update(dt)
    offset.copy(camera.position).sub(controls.target)
    if (!offset.lengthSq()) offset.copy(dir)
    camera.position.copy(controls.target).add(offset.setLength(dist))

    if (hot) {
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
  }
  raf = requestAnimationFrame(frame)

  return () => {
    cancelAnimationFrame(raf)
    ro.disconnect()
    mo.disconnect()
    io.disconnect()
    el.removeEventListener("pointermove", onMove)
    el.removeEventListener("pointerleave", onLeave)
    el.removeEventListener("pointerdown", onDown)
    el.removeEventListener("pointerup", onUp)
    controls.dispose()
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      m.geometry?.dispose()
      ;(Array.isArray(m.material) ? m.material : m.material ? [m.material] : []).forEach((x) => x.dispose())
    })
    renderer.dispose()
    el.remove()
    overlay.remove()
    tip.remove()
  }
}
