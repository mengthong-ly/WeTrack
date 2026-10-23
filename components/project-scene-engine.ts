// The 3D overview's three.js engine. ProjectScene imports this on demand, so three.js stays out of
// the page bundle and hairline's Hub poster shows while it loads.
import * as THREE from "three"
import { MapControls } from "three/examples/jsm/controls/MapControls.js"
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js"
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js"

import type { TaskStatus } from "@/lib/db/enums"
import { formatDate, HEALTH, initials, PRIORITY, PROJECT_HEALTH, STATUS } from "@/lib/labels"
import { MAX_PROJECTS, type SceneData } from "@/lib/scene"

export type Mode = "hub" | "flow" | "team"
export type Cam = "overview" | "side" | "top" | "focus" | "flight"
export type Selection = { title: string; meta: string; href: string | null }
/** What was clicked in the scene: the workspace core, a project, a status station, a person or a task. */
export type ScenePick = { kind: "workspace" | "project" | "status" | "member" | "task"; id: string }
export type SceneMove = { status?: TaskStatus; assigneeId?: string }
// Where the camera and the view were, so a rebuild after new data (an edit) doesn't jump.
export type View = { mode: Mode; cam: Cam; playing: boolean; pos: number[]; target: number[]; selected: string | null }
export type SceneApi = {
  set: (s: { mode: Mode; cam: Cam; playing: boolean }) => void
  select: (on: boolean) => void
  /** Pick and fly to something by id (from the Outline or search). Returns the view it lives in. */
  focus: (pick: ScenePick) => Mode | null
  view: () => View
  /** Fly back to the current camera's home, even when it's already the active one. */
  home: () => void
  /** Turn the view an eighth of a circle around what it's looking at (1 clockwise, -1 counter). */
  turn: (dir: 1 | -1) => void
  dispose: () => void
}
export type Hooks = {
  onReady: () => void
  onFail: () => void
  onSelect: (s: Selection, pick: ScenePick) => void
  /** Set when blocks can be dragged to another status station or onto a person. */
  onMove?: (taskId: string, patch: SceneMove) => void
  /** The pointer went down on the scene (calm mode stops the motion then). */
  onInput: () => void
  /** `kind:id` keys to keep lit; everything else of that kind dims. Null: nothing dimmed. */
  highlight: () => ReadonlySet<string> | null
  journey: () => { step: HTMLElement | null; bar: HTMLElement | null }
}

// ---------------------------------------------------------------------------
// The scene. Imperative three.js, mounted once per data set; the mode is read every frame.
// ---------------------------------------------------------------------------

type Palette = ReturnType<typeof readPalette>
type Tone = (p: Palette) => THREE.Color
type Std = THREE.MeshStandardMaterial

type Item = {
  ref: ScenePick
  obj: THREE.Object3D
  home: THREE.Vector3 // where it sits; a dropped-nowhere drag returns here
  y: number
  lift: number
  rise: number // how far it lifts on hover
  glow: Std // lit on hover and focus: the plate under a token, or a task block itself
  rest: number
  tip: [string, string]
  top: number
  href: string | null
  link?: THREE.LineBasicMaterial
  drag?: "status" | "assign" // Flow blocks move between statuses; unassigned blocks go to a person
  status?: TaskStatus
  tone?: Tone // a task block's own colour, which dims toward the paper when it's filtered out
  marks?: Std[] // its deadline band and urgent pin, which fade with it
  fade?: THREE.Material[] // a token's materials, which go see-through when it's filtered out
  dim: number
}

type Layer = {
  group: THREE.Group
  mats: THREE.Material[]
  items: Item[]
  proxies: THREE.Object3D[] // invisible hit boxes, one per item
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
// Hub tokens fill rings around the core (8, then 16 more), front (towards the camera) first.
const CELLS: [number, number][] = [1, 2].flatMap((r) => {
  const ring: [number, number][] = []
  for (let cx = -r; cx <= r; cx++)
    for (let cz = -r; cz <= r; cz++) if (Math.max(Math.abs(cx), Math.abs(cz)) === r) ring.push([cx, cz])
  return ring.sort((a, b) => b[0] + b[1] - (a[0] + a[1]))
})
const PITCH = 3.3
const TAU = Math.PI * 2
const FLOOR = 0 // the ground every view stands on
const BELT_Z = 1.8
const CENTER_Y = 0.7
const PLATE = 0.05 // the meaning-coloured plate under a token
const BEVEL = 0.025
const FACE = 320 // px per token face
const BLOCK = 0.42 // a task block
const REST = 0.15 // how much a token's plate glows when nothing is on it
const LINE = 0.3 // a hairline's opacity; a hovered project's line darkens to 0.9
const WHITE = new THREE.Color(0xffffff)
const UP = new THREE.Vector3(0, 1, 0)
const NEAR_BLACK = new THREE.Color(0x171717)

/** What a token shows on top: an image (as a duotone), initials, or a status glyph. */
type Glyph = TaskStatus | "unassigned"
type FaceSpec = {
  fill: Tone
  ink: Tone
  text?: string
  image?: string | null
  glyph?: Glyph
  /** In a badge under the mark (beside the glyph on a tray). */
  name?: string
  /** Trays carry blocks in the middle, so their glyph sits at the front edge. */
  front?: boolean
}

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
  const fill = (className: string) => {
    probe.className = className
    return toColor(getComputedStyle(probe).backgroundColor)
  }
  const ink = text("text-foreground")
  const paper = fill("bg-card")
  const muted = text("text-muted-foreground")
  const palette = {
    ink,
    paper,
    muted,
    neutral: paper.clone().lerp(muted, 0.6), // not-started and unassigned blocks
    ghost: paper.clone().lerp(muted, 0.25), // a filtered-out block fades toward the paper
    font: getComputedStyle(root).fontFamily,
    overdue: text(HEALTH.overdue.className),
    dueSoon: text(HEALTH.due_soon.className),
    urgent: text(PRIORITY.urgent.className),
    status: Object.fromEntries(Object.entries(STATUS).map(([k, v]) => [k, text(v.className)])) as Record<TaskStatus, THREE.Color>,
    health: Object.fromEntries(Object.entries(PROJECT_HEALTH).map(([k, v]) => [k, text(v.className)])) as Record<
      keyof typeof PROJECT_HEALTH,
      THREE.Color
    >,
  }
  probe.remove()
  return palette
}

// White engraving on dark colours, near-black on light ones (yellow, cyan).
const inkOn = (c: THREE.Color) => (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b > 0.4 ? NEAR_BLACK : WHITE)

const roundedSquare = (half: number, r: number) => {
  const s = new THREE.Shape()
  s.moveTo(-half + r, -half)
  s.lineTo(half - r, -half)
  s.absarc(half - r, -half + r, r, -Math.PI / 2, 0)
  s.lineTo(half, half - r)
  s.absarc(half - r, half - r, r, 0, Math.PI / 2)
  s.lineTo(-half + r, half)
  s.absarc(-half + r, half - r, r, Math.PI / 2, Math.PI)
  s.lineTo(-half, -half + r)
  s.absarc(-half + r, -half + r, r, Math.PI, Math.PI * 1.5)
  return s
}

// Status glyphs, one family: dashed ring (not started), half and three-quarter fills (in progress,
// review), a cross (blocked), a filled check (completed).
function drawGlyph(x: CanvasRenderingContext2D, g: Glyph, cx: number, cy: number, r: number, ink: string, hole: string) {
  x.strokeStyle = x.fillStyle = ink
  x.lineWidth = r * 0.2
  x.lineCap = x.lineJoin = "round"
  const ring = () => {
    x.beginPath()
    x.arc(cx, cy, r, 0, TAU)
    x.stroke()
  }
  const pie = (part: number) => {
    x.beginPath()
    x.moveTo(cx, cy)
    x.arc(cx, cy, r * 0.56, -Math.PI / 2, -Math.PI / 2 + TAU * part)
    x.closePath()
    x.fill()
  }
  if (g === "not_started" || g === "unassigned") {
    x.setLineDash([r * 0.42, r * 0.36])
    ring()
    x.setLineDash([])
  } else if (g === "in_progress") {
    ring()
    pie(0.5)
  } else if (g === "review") {
    ring()
    pie(0.75)
  } else if (g === "blocked") {
    ring()
    const k = r * 0.4
    x.beginPath()
    x.moveTo(cx - k, cy - k)
    x.lineTo(cx + k, cy + k)
    x.moveTo(cx + k, cy - k)
    x.lineTo(cx - k, cy + k)
    x.stroke()
  } else {
    x.beginPath()
    x.arc(cx, cy, r + x.lineWidth / 2, 0, TAU)
    x.fill()
    x.strokeStyle = hole
    x.beginPath()
    x.moveTo(cx - r * 0.42, cy + r * 0.02)
    x.lineTo(cx - r * 0.1, cy + r * 0.34)
    x.lineTo(cx + r * 0.45, cy - r * 0.3)
    x.stroke()
  }
}

// Shortens text with an ellipsis until it fits `max` px in the current font.
function fit(x: CanvasRenderingContext2D, text: string, max: number) {
  if (x.measureText(text).width <= max) return text
  let t = text
  while (t.length > 1 && x.measureText(`${t}…`).width > max) t = t.slice(0, -1)
  return `${t.trimEnd()}…`
}

// A token's face: its colour, the mark engraved in it, the name in a badge under the mark, and fine
// scanlines over all of it like an engraving. Canvas top is the token's back, bottom its front.
function paintFace(c: HTMLCanvasElement, f: FaceSpec, pal: Palette, img: HTMLImageElement | null) {
  const S = c.width
  const x = c.getContext("2d")!
  const fill = f.fill(pal), ink = f.ink(pal)
  x.fillStyle = fill.getStyle()
  x.fillRect(0, 0, S, S)
  const named = !!f.name && !f.front
  let cx = S / 2
  const cy = f.front ? S * 0.845 : named ? S * 0.37 : S / 2
  const r = f.front ? S * 0.075 : named ? S * 0.2 : S * 0.27
  if (f.front && f.name) {
    // A tray: glyph and name side by side, centred together on the front edge.
    x.font = `500 ${Math.round(S * 0.07)}px ${pal.font}`
    const label = fit(x, f.name, S * 0.6)
    const gap = S * 0.035, w = x.measureText(label).width
    cx = S / 2 - (r * 2 + gap + w) / 2 + r
    x.fillStyle = ink.getStyle()
    x.textAlign = "left"
    x.textBaseline = "middle"
    x.fillText(label, cx + r + gap, cy)
  }
  let drawn = false
  if (img) {
    // The image as a duotone between the face's darker and lighter colour, so any picture
    // sits in the token's colour.
    const d = Math.round(r * 2.1)
    const off = document.createElement("canvas")
    off.width = off.height = d
    const o = off.getContext("2d")!
    const s = Math.max(d / img.naturalWidth, d / img.naturalHeight)
    o.drawImage(img, (d - img.naturalWidth * s) / 2, (d - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s)
    try {
      const px = o.getImageData(0, 0, d, d)
      const lumOf = (k: THREE.Color) => 0.2126 * k.r + 0.7152 * k.g + 0.0722 * k.b
      const [dark, light] = lumOf(fill) < lumOf(ink) ? [fill, ink] : [ink, fill]
      const a = dark.clone().convertLinearToSRGB(), b = light.clone().convertLinearToSRGB()
      for (let i = 0; i < px.data.length; i += 4) {
        const l = (0.2126 * px.data[i] + 0.7152 * px.data[i + 1] + 0.0722 * px.data[i + 2]) / 255
        px.data[i] = (a.r + (b.r - a.r) * l) * 255
        px.data[i + 1] = (a.g + (b.g - a.g) * l) * 255
        px.data[i + 2] = (a.b + (b.b - a.b) * l) * 255
      }
      o.putImageData(px, 0, 0)
      x.save()
      x.beginPath()
      x.roundRect(cx - d / 2, cy - d / 2, d, d, d * 0.2)
      x.clip()
      x.drawImage(off, cx - d / 2, cy - d / 2)
      x.restore()
      drawn = true
    } catch {
      // A picture from a host without CORS can't be read; the initials stay.
    }
  }
  if (named) {
    // The name in a pill under the mark, the ink at low opacity behind it.
    x.font = `500 ${Math.round(S * 0.105)}px ${pal.font}`
    const label = fit(x, f.name!, S * 0.74)
    const h = S * 0.19, w = x.measureText(label).width + S * 0.12, y = S * 0.77
    x.fillStyle = ink.getStyle()
    x.globalAlpha = 0.14
    x.beginPath()
    x.roundRect(S / 2 - w / 2, y - h / 2, w, h, h / 2)
    x.fill()
    x.globalAlpha = 1
    x.textAlign = "center"
    x.textBaseline = "middle"
    x.fillText(label, S / 2, y + S * 0.004)
  }
  if (!drawn && f.glyph) drawGlyph(x, f.glyph, cx, cy, r, ink.getStyle(), fill.getStyle())
  else if (!drawn && f.text) {
    x.fillStyle = ink.getStyle()
    x.font = `400 ${Math.round(r * (f.text.length > 1 ? 1.15 : 1.5))}px ${pal.font}`
    x.textAlign = "center"
    x.textBaseline = "middle"
    x.fillText(f.text, cx, cy + r * 0.05)
  }
  x.fillStyle = "rgba(0,0,0,0.05)"
  for (let y = 0; y < S; y += 4) x.fillRect(0, y, S, 1)
}

export function mountScene(root: HTMLElement, data: SceneData, hooks: Hooks, view: View | null): SceneApi {
  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" })
  } catch {
    hooks.onFail()
    return { set: () => {}, select: () => {}, focus: () => null, view: () => view!, home: () => {}, turn: () => {}, dispose: () => {} }
  }
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches
  let pal = readPalette(root)
  let alive = true
  const tints: ((p: Palette) => void)[] = []

  let pixelRatio = Math.min(devicePixelRatio, 2)
  renderer.setPixelRatio(pixelRatio)
  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  // Neutral keeps the theme and project colours true; ACES would wash them out.
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.toneMappingExposure = 1
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.domElement.className = "block size-full cursor-grab touch-none outline-none"
  root.appendChild(renderer.domElement)
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())

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
  // Map-style: drag moves around the floor, Shift-drag or right-drag turns, scroll and pinch zoom
  // toward the pointer. One finger moves, two turn and zoom.
  const controls = new MapControls(camera, renderer.domElement)
  controls.zoomToCursor = true
  controls.target.set(0, CENTER_Y, 0)
  controls.enableDamping = true
  controls.dampingFactor = 0.065
  controls.minDistance = 4
  controls.minPolarAngle = 0.05
  controls.maxPolarAngle = Math.PI * 0.475
  controls.rotateSpeed = 0.48
  controls.zoomSpeed = 0.7
  controls.autoRotateSpeed = 0.24

  // --- light: soft daylight on paper. A sky/ground fill, one key with soft shadows, a front fill.
  const pmrem = new THREE.PMREMGenerator(renderer)
  const room = new RoomEnvironment()
  const env = pmrem.fromScene(room, 0.04)
  scene.environment = env.texture
  scene.environmentIntensity = 0.35
  room.dispose()
  pmrem.dispose()
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d8d8, 1.7))
  const key = new THREE.DirectionalLight(0xffffff, 2.3)
  key.position.set(-4, 12, 7)
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  Object.assign(key.shadow.camera, { left: -10, right: 10, top: 9, bottom: -9, near: 0.5, far: 35 })
  key.shadow.normalBias = 0.03
  key.shadow.bias = -0.0002
  key.shadow.radius = 5
  scene.add(key)
  const front = new THREE.DirectionalLight(0xffffff, 0.7)
  front.position.set(5, 3, 10)
  scene.add(front)

  // The floor: shadows only, under a hairline grid that fades out before it reaches an edge.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), new THREE.ShadowMaterial({ opacity: 0.12 }))
  floor.rotation.x = -Math.PI / 2
  floor.position.y = FLOOR - 0.001
  floor.receiveShadow = true
  scene.add(floor)
  const grid = (() => {
    const pos: number[] = [], col: number[] = []
    const R = 22, step = 2, seg = 44
    const a = (x: number, z: number) => Math.max(0, 1 - Math.hypot(x, z) / R) ** 1.6
    for (let k = -R; k <= R; k += step)
      for (let i = 0; i < seg; i++) {
        const t0 = -R + (i / seg) * 2 * R, t1 = -R + ((i + 1) / seg) * 2 * R
        for (const [x0, z0, x1, z1] of [[k, t0, k, t1], [t0, k, t1, k]]) {
          pos.push(x0, FLOOR, z0, x1, FLOOR, z1)
          col.push(1, 1, 1, a(x0, z0), 1, 1, 1, a(x1, z1))
        }
      }
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
    // RGBA vertex colours: the alpha is the fade.
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 4))
    const m = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.16, depthWrite: false, toneMapped: false })
    tints.push((q) => m.color.copy(q.ink))
    m.color.copy(pal.ink)
    return new THREE.LineSegments(g, m)
  })()
  scene.add(grid)

  // Fine vertical hairlines down every token's sides. Side-wall UVs are in world units, so the
  // spacing is the same on every size of token.
  const stripes = (() => {
    const c = document.createElement("canvas")
    c.width = 64
    c.height = 4
    const x = c.getContext("2d")!
    x.fillStyle = "#fff"
    x.fillRect(0, 0, 64, 4)
    x.fillStyle = "#cfcfcf"
    for (let i = 0; i < 64; i += 4) x.fillRect(i, 0, 1, 4)
    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(1.5, 1)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = anisotropy
    return t
  })()
  const faces: THREE.Texture[] = []

  // --- building blocks -------------------------------------------------------
  const layer = (): Layer => {
    const group = new THREE.Group()
    scene.add(group)
    return { group, mats: [], items: [], proxies: [], weight: 0, radius: 4 }
  }
  const own = <T extends THREE.Material>(L: Layer, m: T, base = 1) => {
    m.userData.base = base
    L.mats.push(m)
    return m
  }
  // A coloured part that can glow: a theme, status or health colour from lib/labels.ts.
  const lit = (L: Layer, tone: Tone | THREE.Color, glow: number, metalness = 0, roughness = 0.5) => {
    const m = own(L, new THREE.MeshStandardMaterial({ metalness, roughness, emissiveIntensity: glow }))
    const paint = (p: Palette) => {
      const c = tone instanceof THREE.Color ? tone : tone(p)
      m.color.copy(c)
      m.emissive.copy(c)
    }
    paint(pal)
    tints.push(paint)
    return m
  }
  // A 1px line in the ink colour; `userData.base` is its opacity.
  const stroke = (L: Layer) => {
    const m = own(L, new THREE.LineBasicMaterial({ toneMapped: false }), LINE)
    const paint = (p: Palette) => m.color.copy(p.ink)
    paint(pal)
    tints.push(paint)
    return m
  }
  // Each view owns its materials, so it can fade on its own.
  const kit = (L: Layer) => {
    const line = lit(L, (q) => q.ink, 0)
    line.userData.base = LINE
    return { ink: lit(L, (q) => q.ink, 0, 0, 0.45), paper: lit(L, (q) => q.paper, 0, 0, 0.6), neutral: lit(L, (q) => q.neutral, 0), line, stroke: stroke(L) }
  }
  type Kit = ReturnType<typeof kit>
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
  // A hairline through the points; three or more bend into a smooth curve.
  const hairline = (parent: THREE.Object3D, pts: THREE.Vector3[], m: THREE.LineBasicMaterial) => {
    const at = pts.length > 2 ? new THREE.CatmullRomCurve3(pts).getPoints(32) : pts
    parent.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(at), m))
  }
  // A rounded-square slab standing on y = 0: an extruded shape, so the corners stay round in plan
  // however thin it is (a rounded box can't round its corners more than half its height).
  const slab = (size: number, h: number) =>
    geo(`s${size},${h}`, () => {
      const b = Math.min(BEVEL, h / 4)
      const g = new THREE.ExtrudeGeometry(roundedSquare(size / 2 - b, size * 0.15), {
        depth: h - b * 2, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 10,
      })
      g.rotateX(-Math.PI / 2)
      g.translate(0, b, 0)
      return g
    })
  // The face laid on a slab's flat top, with its UVs spread 0–1 across it.
  const decal = (size: number) =>
    geo(`d${size}`, () => {
      const s = size / 2 - BEVEL
      const g = new THREE.ShapeGeometry(roundedSquare(s, size * 0.15), 10)
      const uv = g.attributes.uv
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) + s) / (2 * s), (uv.getY(i) + s) / (2 * s))
      g.rotateX(-Math.PI / 2)
      return g
    })
  /**
   * A token: a rounded square seen in perspective, its mark engraved on top and hairlines down
   * its sides. With `plate`, it stands on a thin plate in a meaning colour (health, status,
   * overdue) that glows on hover. Returns the height of its top, the glow and its materials.
   */
  const token = (L: Layer, parent: THREE.Object3D, size: number, h: number, body: Tone, f: FaceSpec, plate: Tone | null, y = 0) => {
    const fade: THREE.Material[] = []
    let glow: Std | null = null
    if (plate) {
      glow = lit(L, plate, REST)
      fade.push(glow)
      mesh(parent, slab(size + 0.1, PLATE), glow, 0, y, 0)
      y += PLATE
    }
    const side = lit(L, body, 0, 0, 0.55)
    side.map = stripes
    mesh(parent, slab(size, h), side, 0, y, 0)
    const canvas = document.createElement("canvas")
    canvas.width = canvas.height = FACE
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = anisotropy
    faces.push(tex)
    const top = own(L, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2 }))
    let img: HTMLImageElement | null = null
    const paint = (p: Palette) => {
      paintFace(canvas, f, p, img)
      tex.needsUpdate = true
    }
    paint(pal)
    tints.push(paint)
    if (f.image) {
      const load = new Image()
      load.crossOrigin = "anonymous"
      load.onload = () => {
        if (!alive) return
        img = load
        paint(pal)
      }
      load.src = f.image
    }
    mesh(parent, decal(size), top, 0, y + h + 0.002, 0).castShadow = false
    fade.push(side, top)
    return { top: y + h, glow, fade }
  }
  const track = (L: Layer, it: Omit<Item, "home" | "lift" | "dim">) => {
    const item = { ...it, lift: 0, dim: 0, home: it.obj.position.clone() }
    L.items.push(item)
    return item
  }
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

  // A task as a block in its status colour. The facts people act on sit on the block itself:
  // a red band when overdue, an amber one when due soon, a red pin when urgent.
  const block = (L: Layer, M: Kit, c: THREE.Group, t: SceneData["tasks"][number], y: number, drag: Item["drag"]) => {
    const tone: Tone = (q) => (t.status === "not_started" || drag === "assign" ? q.neutral : q.status[t.status])
    const m = lit(L, tone, 0, 0, 0.45)
    box(c, BLOCK, BLOCK, BLOCK, 0, BLOCK / 2, 0, m, 0.06)
    const late = t.health === "overdue" ? (q: Palette) => q.overdue : t.health === "due_soon" ? (q: Palette) => q.dueSoon : null
    const marks: Std[] = []
    if (late) {
      const band = lit(L, late, 0.5)
      marks.push(band)
      box(c, BLOCK + 0.04, 0.06, BLOCK + 0.04, 0, 0.045, 0, band, 0.02)
    }
    if (t.priority === "urgent") {
      const pin = lit(L, (q) => q.urgent, 0.8)
      marks.push(pin)
      cyl(c, 0.016, 0.18, 0.15, BLOCK + 0.09, 0.15, M.ink, 8)
      cyl(c, 0.05, 0.045, 0.15, BLOCK + 0.2, 0.15, pin, 16)
    }
    for (const m of marks) m.userData.glow = m.emissiveIntensity
    const due = t.deadline && (t.health === "overdue" || t.health === "due_soon") ? `${HEALTH[t.health].label} ${formatDate(t.deadline)}` : null
    const meta = drag === "assign" ? [t.project, "Unassigned", due] : [t.project, STATUS[t.status].label, due, t.assignee?.split(" ")[0]]
    track(L, {
      ref: { kind: "task", id: t.id },
      obj: c, y, rise: 0.18, glow: m, rest: 0, top: BLOCK, drag, status: t.status, tone, marks,
      tip: [t.priority === "urgent" ? `${t.title} (urgent)` : t.title, meta.filter(Boolean).join(" · ")],
      href: `/tasks/${t.id}`,
    })
  }
  // Up to 27 blocks in a 3×3×3 stack on a tray, behind the glyph at its front edge.
  const stack = (L: Layer, M: Kit, tasks: SceneData["tasks"], x: number, z: number, base: number, drag: Item["drag"]) =>
    tasks.forEach((t, i) => {
      const col = i % 3, row = Math.floor(i / 3) % 3, level = Math.floor(i / 9)
      const y = FLOOR + base + level * (BLOCK + 0.06)
      const c = new THREE.Group()
      c.position.set(x + (col - 1) * 0.5, y, z + (row - 1) * 0.5 - 0.3)
      L.group.add(c)
      block(L, M, c, t, y, drag)
    })

  // --- Hub: the workspace core, a token per project, a line from the core to each ------------
  const hub = layer()
  const shown = data.projects.slice(0, MAX_PROJECTS)
  const core = new THREE.Group()
  core.position.y = FLOOR
  hub.group.add(core)
  const coreTok = token(
    hub, core, 1.9, 0.5, (q) => q.ink,
    { fill: (q) => q.ink, ink: (q) => q.paper, text: initials(data.workspace.name), image: data.workspace.logo, name: data.workspace.name },
    (q) => q.status.in_progress
  )
  const openCount = Object.values(data.counts).reduce((a, b) => a + b, 0) - data.counts.completed
  track(hub, {
    ref: { kind: "workspace", id: "workspace" },
    obj: core, y: FLOOR, rise: 0.15, glow: coreTok.glow!, rest: REST, top: coreTok.top, href: null, fade: coreTok.fade,
    tip: [data.workspace.name, `${data.projects.length} projects · ${openCount} open`],
  })
  shown.forEach((p, i) => {
    const [cx, cz] = CELLS[i]
    const t = new THREE.Group()
    t.position.set(cx * PITCH, FLOOR, cz * PITCH)
    hub.group.add(t)
    const color = new THREE.Color(p.color)
    // Taller with more open work.
    const h = 0.2 + Math.min(p.open, 12) * 0.05
    const tok = token(
      hub, t, 1.5, h, () => color,
      { fill: () => color, ink: () => inkOn(color), text: initials(p.name), name: p.name },
      (q) => q.health[p.health]
    )
    // A hairline from the core to the token; it darkens while the token is up. The outer ring's
    // lines arc over the inner tokens.
    const link = stroke(hub)
    const end = v(cx * PITCH, 0, cz * PITCH)
    const dir = end.clone().normalize()
    const a = dir.clone().multiplyScalar(1.1).setY(FLOOR + 0.01)
    const b = end.clone().addScaledVector(dir, cx && cz ? -1.2 : -0.85).setY(FLOOR + 0.01)
    const outer = Math.max(Math.abs(cx), Math.abs(cz)) > 1
    hairline(hub.group, outer ? [a, a.clone().lerp(b, 0.5).setY(FLOOR + 1.2), b] : [a, b], link)
    track(hub, {
      ref: { kind: "project", id: p.id },
      obj: t, y: FLOOR, rise: 0.3, glow: tok.glow!, rest: REST, top: tok.top, link, fade: tok.fade,
      tip: [p.name, `${PROJECT_HEALTH[p.health].label} · ${p.progress}% · ${p.open} open`],
      href: `/tasks?project=${p.id}`,
    })
  })

  // --- Flow: a tray per status, a block per task, a line the followed task rides --------------
  const flow = layer()
  const FM = kit(flow)
  const tasksBy = (s: TaskStatus) => data.tasks.filter((t) => t.status === s)
  for (const lane of LANES) {
    const st = new THREE.Group()
    st.position.set(lane.x, FLOOR, lane.z)
    flow.group.add(st)
    const tone: Tone = (q) => q.status[lane.status]
    const name = STATUS[lane.status].label.split(" /")[0]
    const tray = token(flow, st, 2.3, 0.14, (q) => q.paper, { fill: (q) => q.paper, ink: tone, glyph: lane.status, name, front: true }, tone)
    track(flow, {
      ref: { kind: "status", id: lane.status },
      obj: st, y: FLOOR, rise: 0, glow: tray.glow!, rest: REST, top: tray.top, href: `/tasks?status=${lane.status}`,
      tip: [name, `${data.counts[lane.status]} tasks`],
    })
    stack(flow, FM, tasksBy(lane.status), lane.x, lane.z, tray.top, "status")
  }
  // Hairlines between the trays, and a branch back to Blocked.
  for (let i = 0; i < 3; i++)
    hairline(flow.group, [v(LANES[i].x + 1.25, FLOOR + 0.01, 0), v(LANES[i + 1].x - 1.25, FLOOR + 0.01, 0)], FM.stroke)
  hairline(flow.group, [v(-1.4, FLOOR + 0.01, -1.25), v(-1.4, FLOOR + 0.01, -1.65)], FM.stroke)
  // The line: a paper bed between two hairlines, with dashes that move while playing.
  const beltY = FLOOR + 0.05
  box(flow.group, 11.8, 0.05, 0.7, 0, FLOOR + 0.025, BELT_Z, FM.paper, 0.02)
  for (const side of [-1, 1]) hairline(flow.group, [v(-5.9, beltY, BELT_Z + side * 0.33), v(5.9, beltY, BELT_Z + side * 0.33)], FM.stroke)
  const SLATS = 70
  const slats = new THREE.InstancedMesh(geo("slat", () => new THREE.BoxGeometry(0.03, 0.006, 0.42)), FM.line, SLATS)
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
  // One real task rides the line as a paper card with an in-progress band and a ring around it:
  // the one "Following one task" names.
  const runner = new THREE.Group()
  flow.group.add(runner)
  box(runner, 0.47, 0.71, 0.04, 0, 0.36, 0, FM.paper, 0.022)
  box(runner, 0.36, 0.12, 0.045, 0, 0.56, 0.004, lit(flow, (q) => q.status.in_progress, 0.4), 0.01)
  const haloMat = own(flow, new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }), 0.8)
  tints.push((q) => haloMat.color.copy(q.status.in_progress))
  haloMat.color.copy(pal.status.in_progress)
  const halo = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.414, 40), haloMat)
  halo.rotation.x = -Math.PI / 2
  halo.position.y = 0.01
  runner.add(halo)
  runner.position.set(-5.6, beltY, BELT_Z)

  // --- Team: a token per person raised on a stack of their open work, and unassigned work -----
  const team = layer()
  const TM = kit(team)
  const n = data.members.length
  const perRow = n > 4 ? Math.ceil(n / 2) : Math.max(1, n)
  const rows = n > 4 ? 2 : 1
  const spare = data.unassigned.length > 0
  // The Unassigned tray sits to the right of the people.
  const spareX = ((perRow - 1) / 2) * 2.5 + 2.9
  team.group.position.x = spare ? -1.45 : 0
  const working = lit(team, (q) => q.status.in_progress, 0.1, 0, 0.45)
  const stuck = lit(team, (q) => q.status.blocked, 0.1, 0, 0.45)
  data.members.forEach((m, i) => {
    const row = Math.floor(i / perRow), col = i % perRow
    const inRow = row === 0 ? Math.min(perRow, n) : n - perRow
    const x = (col - (inRow - 1) / 2) * 2.5
    const z = rows === 2 ? (row ? 1.4 : -1.4) : 0
    const tower = new THREE.Group()
    tower.position.set(x, FLOOR, z)
    team.group.add(tower)
    // The plate turns red when the person has overdue work.
    const strip = lit(team, (q) => (m.overdue ? q.overdue : q.muted), REST)
    mesh(tower, slab(1.4, PLATE), strip, 0, 0, 0)
    // One slab per open task (in progress and blocked in their colours), the person on top.
    const slabs = Math.min(m.open, 12)
    const active = m.active - m.blocked
    for (let s = 0; s < slabs; s++) mesh(tower, slab(1.1, 0.13), s < active ? working : s < m.active ? stuck : TM.neutral, 0, PLATE + s * 0.16, 0)
    const tok = token(
      team, tower, 1.3, 0.22, (q) => q.ink,
      { fill: (q) => q.paper, ink: (q) => q.ink, text: initials(m.name), image: m.image, name: m.name.split(" ")[0] },
      null, PLATE + slabs * 0.16
    )
    const meta = [`${m.open} open`, m.active && `${m.active} in progress`, m.overdue && `${m.overdue} overdue`]
    track(team, {
      ref: { kind: "member", id: m.id },
      obj: tower, y: FLOOR, rise: 0.2, glow: strip, rest: REST, top: tok.top, fade: [strip, ...tok.fade],
      tip: [m.name, meta.filter(Boolean).join(" · ")],
      href: `/tasks?person=${m.id}`,
    })
  })
  if (spare) {
    const st = new THREE.Group()
    st.position.set(spareX, FLOOR, 0)
    team.group.add(st)
    const tray = token(team, st, 2.3, 0.14, (q) => q.paper, { fill: (q) => q.paper, ink: (q) => q.muted, glyph: "unassigned", name: "Unassigned", front: true }, (q) => q.muted)
    stack(team, TM, data.unassigned, spareX, 0, tray.top, "assign")
  }

  const layers: Record<Mode, Layer> = { hub, flow, team }
  for (const L of Object.values(layers)) {
    const sphere = new THREE.Box3().setFromObject(L.group).getBoundingSphere(new THREE.Sphere())
    L.radius = Math.max(3, sphere.radius)
  }
  // Hit boxes: one invisible box per item, sized to it and reaching down as far as it rises, so a
  // lifted token never slips out from under the pointer (no flicker at its edges). Hover tests
  // these boxes only, never the meshes, which is exact from every angle and cheap.
  const hitOf = new Map<THREE.Object3D, Item>()
  const hitMat = new THREE.MeshBasicMaterial()
  const bounds = new THREE.Box3(), extent = new THREE.Vector3(), mid = new THREE.Vector3()
  scene.updateMatrixWorld(true)
  for (const L of Object.values(layers))
    for (const it of L.items) {
      bounds.setFromObject(it.obj).getSize(extent)
      it.obj.worldToLocal(bounds.getCenter(mid))
      const box = new THREE.Mesh(new THREE.BoxGeometry(extent.x, extent.y + it.rise, extent.z), hitMat)
      box.position.set(mid.x, mid.y - it.rise / 2, mid.z)
      box.visible = false
      it.obj.add(box)
      L.proxies.push(box)
      hitOf.set(box, it)
    }
  // Canvas faces use Geist; once it has loaded, engrave them again in it.
  document.fonts?.ready.then(() => alive && tints.forEach((paint) => paint(pal)))

  // --- pointer, camera, sizing, theme -------------------------------------
  const pointer = new THREE.Vector2()
  let mode: Mode = view?.mode ?? "hub", cam: Cam = view?.cam ?? "overview", playing = view?.playing ?? !reduce
  let inside = false, downX = 0, downY = 0, dragging = false, lastInput = performance.now()
  let hot: Item | null = null, selected: Item | null = null
  const keyOf = (it: Item) => `${it.ref.kind}:${it.ref.id}`
  if (view) {
    // A rebuild after new data: same view, no fade-in, the same thing still picked.
    layers[mode].weight = 1
    selected = layers[mode].items.find((it) => keyOf(it) === view.selected) ?? null
  }
  const ray = new THREE.Raycaster()
  const hit = new THREE.Vector3()
  const setPointer = (e: PointerEvent) => {
    const r = root.getBoundingClientRect()
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
  }
  // Re-aimed only when the pointer or the camera moved, not every frame.
  let aim = true
  const pick = (): Item | null => {
    ray.setFromCamera(pointer, camera)
    const h = ray.intersectObjects(layers[mode].proxies, false)[0]
    return h ? hitOf.get(h.object)! : null
  }

  // --- camera: a goal the camera eases to, after the factory scene -----------
  const goalPos = new THREE.Vector3()
  const goalTarget = new THREE.Vector3(0, 0.4, 0)
  const viewDir = new THREE.Vector3(1, 0.85, 1.1).normalize()
  let animating = true, flightT = 0, runT = 0
  let spin = 0 // radians of a turn still to go
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
      // The first real size places the camera at once, without a fly-in (or where it was, on a rebuild).
      sized = true
      camera.position.copy(view ? v(view.pos[0], view.pos[1], view.pos[2]) : goalPos)
      controls.target.copy(view ? v(view.target[0], view.target[1], view.target[2]) : goalTarget)
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
  // Moving around stays over the work: the point you look at can't leave the current view.
  const clampPan = () => {
    const r = layers[mode].radius, t = controls.target
    const x = THREE.MathUtils.clamp(t.x, -r, r) - t.x, z = THREE.MathUtils.clamp(t.z, -r, r) - t.z
    if (!x && !z) return
    t.x += x
    t.z += z
    camera.position.x += x
    camera.position.z += z
  }
  controls.addEventListener("change", () => {
    aim = true
    clampPan()
  })
  // A sideways two-finger swipe (or Shift + wheel) moves left and right along the floor; up and
  // down still zoom. Runs before MapControls, which would zoom on any wheel.
  const side = new THREE.Vector3()
  const onWheel = (e: WheelEvent) => {
    if (e.ctrlKey || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return
    e.preventDefault()
    e.stopImmediatePropagation()
    const perPx = (2 * camera.position.distanceTo(controls.target) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / height
    side.setFromMatrixColumn(camera.matrix, 0).setY(0).normalize().multiplyScalar(e.deltaX * perPx)
    camera.position.add(side)
    controls.target.add(side)
    clampPan()
    animating = false
    aim = true
    lastInput = performance.now()
  }
  controls.addEventListener("end", () => {
    dragging = false
    lastInput = performance.now()
  })
  // --- dragging a block: onto another status station (Flow) or onto a person (Team) ---------
  let grab: { it: Item; id: number; moved: boolean } | null = null
  let dropOn: Item | null = null
  let pending: Item | null = null // dropped and saving: it pulses until the new data rebuilds the scene
  const carry = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(FLOOR + 0.6))
  const targetsFor = (it: Item) =>
    it.drag === "status"
      ? flow.items.filter((t) => t.ref.kind === "status" && t.ref.id !== it.status)
      : team.items.filter((t) => t.ref.kind === "member")
  // Carry the grabbed block under the pointer and find the station it's over.
  const carryTo = (e: PointerEvent, it: Item) => {
    setPointer(e)
    ray.setFromCamera(pointer, camera)
    if (!ray.ray.intersectPlane(carry, hit)) return
    it.obj.parent!.worldToLocal(hit) // Team is shifted to centre it with the Unassigned tray
    it.obj.position.x = hit.x
    it.obj.position.z = hit.z
    dropOn = null
    let best = 1.6
    for (const t of targetsFor(it)) {
      const d = Math.hypot(t.obj.position.x - hit.x, t.obj.position.z - hit.z)
      if (d < best) [dropOn, best] = [t, d]
    }
  }
  const onMove = (e: PointerEvent) => {
    if (grab && e.pointerId === grab.id) {
      if (!grab.moved && Math.hypot(e.clientX - downX, e.clientY - downY) > 5) {
        grab.moved = true
        el.setPointerCapture(e.pointerId)
        el.style.cursor = "grabbing"
      }
      if (grab.moved) carryTo(e, grab.it)
      return
    }
    if (e.pointerType === "touch") return
    inside = true
    aim = true
    setPointer(e)
    lastInput = performance.now()
  }
  const onLeave = () => (inside = false)
  // Runs before MapControls (capture), so grabbing a block never starts a pan.
  const onDown = (e: PointerEvent) => {
    downX = e.clientX
    downY = e.clientY
    lastInput = performance.now()
    hooks.onInput()
    if (!hooks.onMove || e.button !== 0) return
    setPointer(e)
    const it = pick()
    if (!it?.drag) return
    grab = { it, id: e.pointerId, moved: false }
    hot = null
    controls.enabled = false
  }
  const onUp = (e: PointerEvent) => {
    const g = grab
    if (g && e.pointerId === g.id) {
      grab = null
      controls.enabled = true
      if (g.moved) {
        if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
        // Judge the drop where the pointer was let go, not where the last move left it.
        carryTo(e, g.it)
        const to = dropOn
        dropOn = null
        if (to) {
          // Stays on the station it was dropped on; the refreshed data puts it in its place.
          g.it.obj.position.x = to.obj.position.x
          g.it.obj.position.z = to.obj.position.z
          pending = g.it
          hooks.onMove?.(g.it.ref.id, g.it.drag === "status" ? { status: to.ref.id as TaskStatus } : { assigneeId: to.ref.id })
        } else {
          g.it.obj.position.x = g.it.home.x
          g.it.obj.position.z = g.it.home.z
        }
        return
      }
    }
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) return
    setPointer(e)
    const it = pick()
    if (!it) return
    selected = it
    cam = "focus"
    setGoal()
    animating = true
    hooks.onSelect({ title: it.tip[0], meta: it.tip[1], href: it.href }, it.ref)
  }
  el.addEventListener("pointermove", onMove)
  el.addEventListener("pointerleave", onLeave)
  el.addEventListener("pointerdown", onDown, { capture: true })
  el.addEventListener("pointerup", onUp)
  el.addEventListener("wheel", onWheel, { capture: true, passive: false })

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
  let tipOn = false, tipX = 0, tipY = 0, tipFor: Item | null = null
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

    if (grab?.moved || dragging || !inside) hot = null
    else if (aim) {
      hot = pick()
      aim = false
    }
    if (!grab?.moved) el.style.cursor = hot ? (hot.drag && hooks.onMove ? "grab" : "pointer") : dragging ? "grabbing" : "grab"

    for (const [key, layerOf] of Object.entries(layers) as [Mode, Layer][]) {
      layerOf.weight += ((key === mode ? 1 : 0) - layerOf.weight) * ease(7)
      const w = layerOf.weight
      layerOf.group.visible = w > 0.01
      if (!layerOf.group.visible) continue
      if (!reduce) layerOf.group.position.y = (1 - w) * -0.5
      // Fading views go transparent; at rest they render opaque, with full shadows.
      // Filtered-out tokens go see-through too (their `dim`, set below).
      for (const m of layerOf.mats) {
        const dim = m.userData.dim ?? 0
        const fading = w < 0.999 || m.userData.base < 1 || dim > 0.01
        if (m.transparent !== fading) {
          m.transparent = fading
          m.needsUpdate = true
        }
        m.opacity = m.userData.base * w * (1 - dim * 0.7)
      }
      const keep = hooks.highlight()
      for (const it of layerOf.items) {
        // Search and filters: what doesn't match dims (blocks fade to paper, tokens go see-through).
        const out = !!keep && it.ref.kind !== "status" && it.ref.kind !== "workspace" && !keep.has(keyOf(it))
        it.dim += ((out ? 1 : 0) - it.dim) * ease(8)
        const carried = grab?.moved && it === grab.it
        const on = it === hot || it === selected || it === dropOn || carried
        // One smooth lift for what's under the pointer; nothing around it moves.
        it.lift += ((carried ? 0.7 : on ? it.rise : 0) - it.lift) * ease(10)
        it.obj.position.y = it.y + it.lift
        const pulse = it === pending ? 1.2 + Math.sin(now / 120) * 1.1 : null
        const glowTo = pulse ?? (on ? (it.tone ? 0.35 : 1.1) : out ? 0 : keep && it.tone ? 0.4 : it.rest)
        it.glow.emissiveIntensity += (glowTo - it.glow.emissiveIntensity) * ease(10)
        if (it.tone) {
          it.glow.color.copy(it.tone(pal)).lerp(pal.ghost, it.dim * 0.85)
          it.glow.emissive.copy(it.glow.color)
        }
        for (const m of it.marks ?? []) m.emissiveIntensity = m.userData.glow * (1 - it.dim * 0.9)
        for (const m of it.fade ?? []) m.userData.dim = it.dim
        if (it.link) it.link.userData.base += ((on ? 0.9 : LINE) - it.link.userData.base) * ease(10)
      }
    }

    // The followed task walks the Flow line, hopping lane to lane, fading in and out at its ends.
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
    // A turn from the buttons: the rest of it eases out around the point the view looks at.
    if (spin) {
      const a = Math.abs(spin) < 0.001 ? spin : spin * ease(7)
      spin -= a
      p.subVectors(camera.position, controls.target).applyAxisAngle(UP, a)
      camera.position.addVectors(controls.target, p)
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
      // Shown: glide to the next item. Hidden: appear in place.
      const k = tipOn ? ease(18) : 1
      tipX += (x - tipX) * k
      tipY += (y - tipY) * k
      tip.style.transform = `translate(${tipX}px, ${tipY}px)`
      if (tipFor !== hot) {
        tipFor = hot
        tipTitle.textContent = hot.tip[0]
        tipMeta.textContent = hot.tip[1]
      }
      if (!tipOn) tip.style.opacity = "1"
      tipOn = true
    } else if (tipOn) {
      tip.style.opacity = "0"
      tipOn = false
    }

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
      aim = true
      if (moved) {
        lastInput = performance.now()
        setGoal()
        animating = true
      }
    },
    select(on) {
      if (!on) selected = null
    },
    home() {
      setGoal()
      animating = true
    },
    turn(dir) {
      spin += (dir * Math.PI) / 4
      animating = false
      lastInput = performance.now()
    },
    focus(pick) {
      // A task can sit in Flow (by status) or, unassigned, in Team.
      const where: Mode[] = pick.kind === "task" ? ["flow", "team"] : pick.kind === "status" ? ["flow"] : pick.kind === "member" ? ["team"] : ["hub"]
      for (const m of where) {
        const it = layers[m].items.find((i) => i.ref.kind === pick.kind && i.ref.id === pick.id)
        if (!it) continue
        mode = m
        cam = "focus"
        selected = it
        lastInput = performance.now()
        setGoal()
        animating = true
        return m
      }
      return null
    },
    view: () => ({
      mode,
      cam,
      playing,
      pos: camera.position.toArray(),
      target: controls.target.toArray(),
      selected: selected && keyOf(selected),
    }),
    dispose() {
      cancelAnimationFrame(raf)
      ro.disconnect()
      mo.disconnect()
      io.disconnect()
      el.removeEventListener("pointermove", onMove)
      el.removeEventListener("pointerleave", onLeave)
      el.removeEventListener("pointerdown", onDown, { capture: true })
      el.removeEventListener("pointerup", onUp)
      el.removeEventListener("wheel", onWheel, { capture: true })
      el.removeEventListener("webglcontextlost", onLost)
      el.removeEventListener("webglcontextrestored", onRestored)
      controls.dispose()
      alive = false
      scene.traverse((o) => {
        const m = o as THREE.Mesh
        m.geometry?.dispose()
        ;(Array.isArray(m.material) ? m.material : m.material ? [m.material] : []).forEach((x) => x.dispose())
      })
      for (const t of faces) t.dispose()
      stripes.dispose()
      env.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      el.remove()
      tip.remove()
    },
  }
}
