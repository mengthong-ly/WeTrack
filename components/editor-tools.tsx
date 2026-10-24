"use client"

import { CodeIcon, EyeIcon, type LucideIcon, PanelRightIcon, RotateCcwIcon } from "lucide-react"
import { createContext, useState, useSyncExternalStore } from "react"

import { RoundButton } from "@/components/bits"
import { PillTabs } from "@/components/pill-tabs"
import { cn } from "@/lib/utils"

// How the writer likes to see the page: font, size, spacing, width, and rendered text or raw Markdown.
// Kept per browser (localStorage) and shared by every document editor, so the setting follows you between pages.
export type EditorPrefs = {
  font: "sans" | "serif" | "mono"
  size: number
  leading: number
  width: number
  markdown: boolean
  open: boolean
}

const DEFAULTS: EditorPrefs = { font: "sans", size: 16, leading: 1.6, width: 100, markdown: false, open: true }
const KEY = "wetrack:editor"
const listeners = new Set<() => void>()
let cache: EditorPrefs | null = null

function read() {
  if (!cache) {
    try {
      cache = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }
    } catch {
      cache = DEFAULTS
    }
  }
  return cache!
}

function set(patch: Partial<EditorPrefs>) {
  cache = { ...read(), ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(cache))
  } catch {}
  listeners.forEach((l) => l())
}

const subscribe = (l: () => void) => (listeners.add(l), () => listeners.delete(l))
const useEditorPrefs = () => useSyncExternalStore(subscribe, read, () => DEFAULTS)

/** Read by `RichText`: set inside an `EditorSheet`, null everywhere else (comments, read-only notes). */
export const EditorTuning = createContext<EditorPrefs | null>(null)

type Tab = { key: string; label: string; content: React.ReactNode }

// A focus page (task, New task, Give feedback): the document in the middle and a sticky side panel on the right
// with the page's fields (`side`) and the text settings. `contents` adds a sticky column on the left (the task
// tree) when the page is wide enough; `tabs` turns the panel into Info (`side`) / Style (text settings) / more.
// Narrow (a phone, the workspace sheet), without tabs it stacks as title, fields, document, text settings (the
// panel and main column turn `contents` so their parts reorder); with tabs the panel follows the document.
// `PanelToggle` in the page header hides the panel (narrow, untabbed: only the text settings, the fields stay).
export function FocusLayout({
  title,
  side,
  tabs,
  contents,
  children,
}: {
  title?: React.ReactNode
  side: React.ReactNode
  tabs?: Tab[]
  contents?: React.ReactNode
  children: React.ReactNode
}) {
  const prefs = useEditorPrefs()
  const card = "flex flex-col gap-2 rounded-panel bg-card p-2 shadow-sm @4xl:rounded-none @4xl:bg-transparent @4xl:p-0 @4xl:shadow-none"
  const panel =
    "transition-[opacity,translate] duration-200 ease-out-expo starting:translate-y-1 starting:opacity-0 motion-reduce:starting:translate-y-0 @4xl:sticky @4xl:top-6 @4xl:max-h-[calc(100dvh-3rem)] @4xl:w-72 @4xl:shrink-0 @4xl:overflow-y-auto @4xl:overscroll-contain"
  return (
    <div data-tools={prefs.open ? "open" : undefined} className="@container">
      <div className="flex flex-col gap-6 @4xl:flex-row @4xl:items-start">
        {contents && <div className="hidden w-56 shrink-0 @6xl:sticky @6xl:top-6 @6xl:block">{contents}</div>}
        <div className="contents @4xl:flex @4xl:min-w-0 @4xl:flex-1 @4xl:flex-col @4xl:gap-6">
          {title && <div className="order-1">{title}</div>}
          <div className="order-3 flex min-w-0 flex-col gap-6">{children}</div>
        </div>
        {tabs ? (
          prefs.open && (
            <aside aria-label="Side panel" className={cn("order-4 flex flex-col gap-2 rounded-panel bg-card p-2 shadow-sm", panel)}>
              <TabbedPanel prefs={prefs} side={side} tabs={tabs} />
            </aside>
          )
        ) : (
          <aside
            aria-label="Side panel"
            className={cn(
              "contents @4xl:flex @4xl:flex-col @4xl:gap-2 @4xl:rounded-panel @4xl:bg-card @4xl:p-2 @4xl:shadow-sm",
              panel,
              !prefs.open && "@4xl:hidden"
            )}
          >
            <div className={cn("order-2", card)}>{side}</div>
            {prefs.open && (
              <section aria-label="Text" className={cn("order-4", card)}>
                <h2 className="px-2 pt-1 text-xs text-muted-foreground">Text</h2>
                <TextSettings prefs={prefs} />
              </section>
            )}
          </aside>
        )}
      </div>
    </div>
  )
}

// Craft-style tabs across the top of the panel. Info is the page's own fields; Style is the text settings.
function TabbedPanel({ prefs, side, tabs }: { prefs: EditorPrefs; side: React.ReactNode; tabs: Tab[] }) {
  const [tab, setTab] = useState("info")
  const all: Tab[] = [
    { key: "info", label: "Info", content: side },
    { key: "style", label: "Style", content: <TextSettings prefs={prefs} /> },
    ...tabs,
  ]
  return (
    <>
      <PillTabs
        id="side-panel"
        className="bg-muted/60 ring-0 *:flex-1 *:justify-center *:px-3"
        items={all.map((t) => ({ key: t.key, label: t.label, active: t.key === tab, onSelect: () => setTab(t.key) }))}
      />
      {/* Tabs switch many times a session, so the content swaps without animating. */}
      <div className="flex flex-col gap-2">{all.find((t) => t.key === tab)?.content}</div>
    </>
  )
}

/** The white sheet that holds a focus page's `RichText`; the editor inside follows the text settings. */
export function EditorSheet({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0 rounded-panel bg-card p-5 shadow-sm", className)}>
      <Tuned>{children}</Tuned>
    </div>
  )
}

/** Applies the text settings to a `RichText` inside, for a page that draws its own sheet (the task page). */
export function Tuned({ children }: { children: React.ReactNode }) {
  return <EditorTuning value={useEditorPrefs()}>{children}</EditorTuning>
}

/** Header button that shows or hides a `FocusLayout`'s side panel. */
export function PanelToggle() {
  const { open } = useEditorPrefs()
  return (
    <RoundButton aria-label={open ? "Hide side panel" : "Show side panel"} title={open ? "Hide panel" : "Show panel"} aria-expanded={open} onClick={() => set({ open: !open })}>
      <PanelRightIcon className="size-5" />
    </RoundButton>
  )
}

/** A labelled group of `SideProp`s in the side panel, styled like the text settings. */
export function SideSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section aria-label={label} className="flex flex-col gap-2">
      <h2 className="px-2 pt-1 text-xs text-muted-foreground">{label}</h2>
      <div className="rounded-row bg-muted/60 p-1">{children}</div>
    </section>
  )
}

/** One field in a side panel group: muted icon + label, then a ghost `Pick` (hover `bg-card`) or a plain value. */
export function SideProp({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-11 min-w-0 items-center gap-2 py-1 pl-2.5 text-sm">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="w-16 shrink-0 text-muted-foreground">{label}</span>
      {/* Ghost selects sit flush with the label and hover to the sheet colour, as on the grey group. */}
      <div className="flex min-w-0 flex-1 items-center pr-1 *:max-w-full **:data-[slot=select-trigger]:ml-0 **:data-[slot=select-trigger]:hover:bg-card">
        {children}
      </div>
    </div>
  )
}

const fonts = [
  { value: "sans", label: "Sans", className: "font-sans" },
  { value: "serif", label: "Serif", className: "font-serif" },
  { value: "mono", label: "Mono", className: "font-mono" },
] as const

function TextSettings({ prefs }: { prefs: EditorPrefs }) {
  const changed = (Object.keys(DEFAULTS) as (keyof EditorPrefs)[]).some((k) => k !== "open" && prefs[k] !== DEFAULTS[k])
  return (
    <>
      <div role="group" aria-label="Font" className="grid grid-cols-3 gap-2">
        {fonts.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={prefs.font === f.value}
            onClick={() => set({ font: f.value })}
            className="flex h-18 flex-col items-center justify-center gap-0.5 rounded-row bg-muted/60 text-foreground outline-none transition-[background-color,color,scale] hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-97 aria-pressed:bg-foreground aria-pressed:text-background"
          >
            <span className={cn("text-2xl leading-none", f.className)}>Aa</span>
            <span className="text-xs opacity-70">{f.label}</span>
          </button>
        ))}
      </div>
      <Ticks label="Font size" min={13} max={22} step={1} value={prefs.size} show={(v) => `${v}px`} onChange={(size) => set({ size })} />
      <Ticks label="Line spacing" min={1.2} max={2.2} step={0.1} value={prefs.leading} show={(v) => v.toFixed(1)} onChange={(leading) => set({ leading })} />
      <Ticks label="Editor width" min={50} max={100} step={5} value={prefs.width} show={(v) => `${v}%`} onChange={(width) => set({ width })} />
      <PillTabs
        id="editor-syntax"
        className="bg-muted/60 ring-0 *:flex-1 *:justify-center"
        items={[
          { key: "text", label: <><EyeIcon className="size-4" />Text</>, active: !prefs.markdown, onSelect: () => set({ markdown: false }) },
          { key: "md", label: <><CodeIcon className="size-4" />Markdown</>, active: prefs.markdown, onSelect: () => set({ markdown: true }) },
        ]}
      />
      {changed && (
        <button
          type="button"
          onClick={() => set({ ...DEFAULTS, open: true })}
          className="flex h-9 items-center justify-center gap-1.5 rounded-full text-xs text-muted-foreground outline-none transition-[background-color,color,scale] hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95"
        >
          <RotateCcwIcon className="size-3.5" />
          Reset
        </button>
      )}
    </>
  )
}

// A ruler of ticks over a native range input: the input gives keyboard, touch and screen reader support,
// the ticks show the steps, and the current one stands tall.
function Ticks({
  label,
  min,
  max,
  step,
  value,
  show,
  onChange,
}: {
  label: string
  min: number
  max: number
  step: number
  value: number
  show: (v: number) => string
  onChange: (v: number) => void
}) {
  const count = Math.round((max - min) / step) + 1
  const at = Math.round((value - min) / step)
  return (
    <label className="flex flex-col gap-2 rounded-row bg-muted/60 px-4 pt-3 pb-2.5 has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
      <span className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular">{show(value)}</span>
      </span>
      <span className="relative h-7">
        {/* Inset by half the native thumb so each tick sits where the thumb stops. */}
        <span aria-hidden className="absolute inset-x-2 inset-y-0 flex items-center justify-between">
          {Array.from({ length: count }, (_, i) => (
            <span
              key={i}
              className={cn(
                "h-full w-0.5 rounded-full transition-[scale,background-color] duration-150 ease-out-expo",
                i === at ? "bg-foreground" : "scale-y-50 bg-foreground/20"
              )}
            />
          ))}
        </span>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-valuetext={show(value)}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full cursor-pointer opacity-0"
        />
      </span>
    </label>
  )
}

/** A row in a side panel's Actions group: muted icon + label, `destructive` for the red one. */
export function SideAction({
  icon: Icon,
  destructive,
  children,
  ...props
}: { icon: LucideIcon; destructive?: boolean } & React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "flex h-10 w-full items-center gap-3 rounded-row px-2.5 text-left text-sm outline-none transition-[background-color,scale] hover:bg-card focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-97",
        destructive && "text-destructive"
      )}
    >
      <Icon className={cn("size-4 shrink-0", !destructive && "text-muted-foreground")} />
      {children}
    </button>
  )
}
