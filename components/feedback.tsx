"use client"

import {
  ImagePlusIcon,
  ListChecksIcon,
  MoreHorizontalIcon,
  PlusIcon,
  Trash2Icon,
  UserIcon,
  XIcon,
} from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import Link from "next/link"
import { useOptimistic, useState, useTransition } from "react"
import { toast } from "sonner"

import {
  createFeedback,
  deleteFeedback,
  setFeedbackResolved,
} from "@/app/actions"
import { ProjectDot, UserAvatar } from "@/components/bits"
import { Reveal, spring } from "@/components/motion-bits"
import { Pick } from "@/components/pick"
import { PillTabs } from "@/components/pill-tabs"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type Person = { id: string; name: string; image: string | null }
export type FeedbackItem = {
  id: string
  body: string | null
  hasImage: boolean
  resolved: boolean
  when: string
  task: { id: string; title: string; color: string; project: string }
  author: Person | null
  recipient: Person | null
  canDelete: boolean
}
export type FeedbackTask = {
  id: string
  title: string
  color: string
  assignee: string | null
}

type Who = "mine" | "given" | "all"
const EMPTY: Record<Who, string> = {
  mine: "Nothing to fix. Feedback on your tasks shows up here.",
  given: "You haven't given feedback yet. Pick a task and paste a screenshot.",
  all: "No open feedback. Give some with the button above.",
}

export function FeedbackBoard({
  items,
  tasks,
  meId,
}: {
  items: FeedbackItem[]
  tasks: FeedbackTask[]
  meId: string
}) {
  const [optimistic, setResolved] = useOptimistic(
    items,
    (state, { id, resolved }: { id: string; resolved: boolean }) =>
      state.map((i) => (i.id === id ? { ...i, resolved } : i))
  )
  // Start on "For me" when there's something to fix, otherwise show the whole team.
  const [who, setWho] = useState<Who>(() =>
    items.some((i) => i.recipient?.id === meId && !i.resolved) ? "mine" : "all"
  )
  const [fixed, setFixed] = useState(false)
  const [composing, setComposing] = useState(false)
  const [viewing, setViewing] = useState<FeedbackItem | null>(null)
  const [, start] = useTransition()

  const inWho = (w: Who) => (i: FeedbackItem) =>
    w === "mine"
      ? i.recipient?.id === meId
      : w === "given"
        ? i.author?.id === meId
        : true
  const open = (w: Who) =>
    optimistic.filter((i) => inWho(w)(i) && !i.resolved).length
  const shown = optimistic.filter((i) => inWho(who)(i) && i.resolved === fixed)
  // Grouped by task, newest feedback first; points inside a task read in the order they were written.
  const byTask = new Map<string, FeedbackItem[]>()
  for (const i of shown)
    byTask.set(i.task.id, [i, ...(byTask.get(i.task.id) ?? [])])
  const groups = [...byTask.values()]

  function resolve(item: FeedbackItem, resolved: boolean) {
    start(async () => {
      setResolved({ id: item.id, resolved })
      const res = await setFeedbackResolved(item.id, resolved)
      if (res.error) toast.error(res.error)
      else if (resolved)
        toast.success("Marked as fixed", {
          action: { label: "Undo", onClick: () => resolve(item, false) },
        })
    })
  }

  function remove(item: FeedbackItem) {
    if (!confirm("Delete this point? This can't be undone.")) return
    start(async () => {
      const res = await deleteFeedback(item.id)
      if (res.error) toast.error(res.error)
      else toast.success("Feedback deleted")
    })
  }

  const count = (n: number) =>
    n > 0 && <span className="tabular text-xs opacity-60">{n}</span>

  return (
    <>
      <Reveal index={1} className="flex flex-wrap items-center gap-2">
        <PillTabs
          id="feedback-who"
          className="max-w-full self-start"
          items={[
            {
              key: "mine",
              label: <>For me {count(open("mine"))}</>,
              active: who === "mine",
              onSelect: () => setWho("mine"),
            },
            {
              key: "given",
              label: <>From me {count(open("given"))}</>,
              active: who === "given",
              onSelect: () => setWho("given"),
            },
            {
              key: "all",
              label: <>Everyone {count(open("all"))}</>,
              active: who === "all",
              onSelect: () => setWho("all"),
            },
          ]}
        />
        <PillTabs
          id="feedback-state"
          className="max-w-full self-start"
          items={[
            {
              key: "open",
              label: "Open",
              active: !fixed,
              onSelect: () => setFixed(false),
            },
            {
              key: "fixed",
              label: "Fixed",
              active: fixed,
              onSelect: () => setFixed(true),
            },
          ]}
        />
        <Button
          onClick={() => setComposing(true)}
          className="h-11 gap-2 rounded-full px-5 transition-[background-color,scale] active:scale-95 sm:ml-auto"
        >
          <PlusIcon className="size-4" />
          Give feedback
        </Button>
      </Reveal>

      <Reveal
        index={2}
        className="flex flex-col gap-6 rounded-sheet bg-card p-3 shadow-sm sm:p-4"
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {groups.map((points) => {
            const { task, recipient } = points[0]
            return (
              <motion.section
                key={task.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{
                  opacity: 0,
                  scale: 0.97,
                  transition: { duration: 0.18 },
                }}
                transition={spring}
                className="flex flex-col gap-2.5"
              >
                <header className="flex min-w-0 items-center gap-2 px-3 pt-2">
                  <ProjectDot color={task.color} className="size-2.5" />
                  <Link
                    href={`/tasks/${task.id}`}
                    className="min-w-0 truncate text-lg hover:underline"
                    title={task.project}
                  >
                    {task.title}
                  </Link>
                  <span className="ml-auto flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
                    <span className="max-sm:sr-only">
                      For{" "}
                      {recipient?.id === meId
                        ? "you"
                        : (recipient?.name.split(" ")[0] ?? "nobody yet")}
                    </span>
                    {recipient ? (
                      <UserAvatar user={recipient} className="size-6 ring-0" />
                    ) : (
                      <UserIcon className="size-4" />
                    )}
                  </span>
                </header>
                <ul className="flex flex-col gap-2.5">
                  <AnimatePresence mode="popLayout" initial={false}>
                    {points.map((p) => (
                      <Point
                        key={p.id}
                        item={p}
                        onResolve={resolve}
                        onDelete={remove}
                        onView={setViewing}
                      />
                    ))}
                  </AnimatePresence>
                </ul>
              </motion.section>
            )
          })}
        </AnimatePresence>
        {groups.length === 0 && (
          <p className="rounded-card bg-muted/60 px-5 py-6 text-sm text-muted-foreground">
            {fixed ? "Fixed points show up here." : EMPTY[who]}
          </p>
        )}
      </Reveal>

      <GiveFeedbackDialog
        open={composing}
        onOpenChange={setComposing}
        tasks={tasks}
      />

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="gap-3 rounded-tile bg-card p-2 sm:max-w-5xl">
          <DialogTitle className="sr-only">Screenshot</DialogTitle>
          {viewing && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- private, cookie-guarded image; next/image can't fetch it */}
              <img
                src={`/api/feedback/${viewing.id}`}
                alt="Screenshot"
                className="max-h-[80dvh] w-full rounded-panel bg-muted object-contain"
              />
              {viewing.body && (
                <p className="px-3 pb-2 text-sm whitespace-pre-wrap text-muted-foreground">
                  {viewing.body}
                </p>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function Point({
  item,
  onResolve,
  onDelete,
  onView,
}: {
  item: FeedbackItem
  onResolve: (item: FeedbackItem, resolved: boolean) => void
  onDelete: (item: FeedbackItem) => void
  onView: (item: FeedbackItem) => void
}) {
  const done = item.resolved
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.18 } }}
      transition={spring}
      className="flex gap-3 rounded-row bg-muted/60 py-3 pr-2 pl-3 sm:pl-4"
    >
      {/* Round checkbox, as on TaskCard. */}
      <button
        type="button"
        onClick={() => onResolve(item, !done)}
        aria-label={done ? "Mark as not fixed" : "Mark as fixed"}
        aria-pressed={done}
        className="relative mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-[1.5px] border-foreground/30 transition-colors hover:border-foreground/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <motion.span
          className="absolute inset-0 rounded-full bg-foreground"
          initial={false}
          animate={{ scale: done ? 1 : 0 }}
          transition={spring}
        />
        <svg
          viewBox="0 0 24 24"
          className="relative size-3.5 text-background"
          fill="none"
        >
          <motion.path
            d="M5 12.5l4.5 4.5L19 7.5"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={false}
            animate={{ pathLength: done ? 1 : 0 }}
            transition={{ duration: 0.25, delay: done ? 0.08 : 0 }}
          />
        </svg>
      </button>
      <div className="min-w-0 flex-1">
        {item.body && (
          <p
            className={cn(
              "text-base whitespace-pre-wrap",
              done &&
                "text-muted-foreground line-through decoration-foreground/30"
            )}
          >
            {item.body}
          </p>
        )}
        {item.hasImage && (
          <button
            type="button"
            onClick={() => onView(item)}
            aria-label="Open screenshot"
            className={cn(
              "block w-full max-w-lg cursor-zoom-in overflow-hidden rounded-xl bg-card ring-1 ring-foreground/5 transition-[scale,opacity] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-[0.98]",
              item.body && "mt-2.5",
              done && "opacity-60"
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- private, cookie-guarded image; next/image can't fetch it */}
            <img
              src={`/api/feedback/${item.id}`}
              alt=""
              loading="lazy"
              className="h-44 w-full object-cover object-top sm:h-56"
            />
          </button>
        )}
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          {item.author && (
            <UserAvatar user={item.author} className="size-5 ring-0" />
          )}
          {item.author?.name ?? "Former member"} · {item.when}
        </p>
      </div>
      {item.canDelete && (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Feedback actions"
            className="grid size-10 shrink-0 place-items-center rounded-full text-muted-foreground transition-[background-color,color,scale] outline-none hover:bg-card hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95"
          >
            <MoreHorizontalIcon className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              variant="destructive"
              onClick={() => onDelete(item)}
            >
              <Trash2Icon />
              Delete point
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </motion.li>
  )
}

// ---------- Composer ----------

type Draft = {
  key: number
  body: string
  image: Blob | null
  preview: string | null
}
let nextKey = 0
const blank = (): Draft => ({
  key: nextKey++,
  body: "",
  image: null,
  preview: null,
})

// Screenshots are shrunk in the browser (at most 2000px wide, WebP or JPEG) so a send stays small.
async function shrink(file: File): Promise<Blob> {
  if (file.type === "image/gif") return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, 2000 / bitmap.width)
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas
      .getContext("2d")!
      .drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    for (const type of ["image/webp", "image/jpeg"]) {
      const blob = await new Promise<Blob | null>((r) =>
        canvas.toBlob(r, type, 0.85)
      )
      if (blob?.type === type) return blob
    }
  } catch {}
  return file
}

const imageIn = (data: DataTransfer | null) =>
  [...(data?.files ?? [])].find((f) => f.type.startsWith("image/"))
const propPick =
  "ml-0 min-w-0 flex-1 justify-between px-2.5 hover:bg-card dark:bg-transparent dark:hover:bg-card *:data-[slot=select-value]:min-w-0"

function GiveFeedbackDialog({
  open,
  onOpenChange,
  tasks,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  tasks: FeedbackTask[]
}) {
  const [taskId, setTaskId] = useState(tasks[0]?.id ?? "")
  const [drafts, setDrafts] = useState<Draft[]>(() => [blank()])
  const [over, setOver] = useState<number | null>(null)
  const [error, setError] = useState<string>()
  const [pending, start] = useTransition()
  const task = tasks.find((t) => t.id === taskId)

  const edit = (key: number, patch: Partial<Draft>) =>
    setDrafts((ds) => ds.map((d) => (d.key === key ? { ...d, ...patch } : d)))
  async function attach(key: number, file: File | undefined) {
    if (!file?.type.startsWith("image/")) return
    const image = await shrink(file)
    setDrafts((ds) =>
      ds.map((d) => {
        if (d.key !== key) return d
        if (d.preview) URL.revokeObjectURL(d.preview)
        return { ...d, image, preview: URL.createObjectURL(image) }
      })
    )
  }
  function detach(d: Draft) {
    if (d.preview) URL.revokeObjectURL(d.preview)
    edit(d.key, { image: null, preview: null })
  }
  function drop(d: Draft) {
    if (d.preview) URL.revokeObjectURL(d.preview)
    setDrafts((ds) => ds.filter((x) => x.key !== d.key))
  }

  function submit() {
    const form = new FormData()
    form.set("taskId", taskId)
    drafts.forEach((d, i) => {
      form.set(`body-${i}`, d.body)
      if (d.image)
        form.set(
          `image-${i}`,
          d.image,
          `screenshot-${i}.${d.image.type.split("/")[1]}`
        )
    })
    start(async () => {
      const res = await createFeedback(form)
      if (res.error) return setError(res.error)
      drafts.forEach((d) => d.preview && URL.revokeObjectURL(d.preview))
      setDrafts([blank()])
      setError(undefined)
      onOpenChange(false)
      const n = res.count === 1 ? "1 point" : `${res.count} points`
      toast.success(
        task?.assignee
          ? `Sent ${n} to ${task.assignee.split(" ")[0]}`
          : `Saved ${n}`
      )
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[90dvh] gap-0 overflow-y-auto rounded-tile p-0 sm:max-w-xl"
      >
        {tasks.length === 0 ? (
          <div className="p-8 text-center">
            <DialogTitle className="text-lg font-normal">
              Add a task first
            </DialogTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Feedback is given on a task.
            </p>
          </div>
        ) : (
          <form
            action={submit}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter")
                e.currentTarget.requestSubmit()
            }}
          >
            <div className="flex items-center justify-between px-6 pt-5">
              <DialogTitle className="text-2xl font-light tracking-tight">
                Give feedback
              </DialogTitle>
              <DialogClose
                aria-label="Close"
                className="-mr-2 grid size-8 place-items-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <XIcon className="size-4" />
              </DialogClose>
            </div>

            <div className="mx-3 mt-4 grid grid-cols-1 rounded-panel bg-muted/60 p-1.5">
              <div className="flex h-11 items-center gap-2 pl-2.5">
                <ListChecksIcon className="size-4 shrink-0 text-muted-foreground" />
                <span className="w-12 shrink-0 text-sm text-muted-foreground">
                  Task
                </span>
                <Pick
                  aria-label="Task"
                  variant="ghost"
                  className={propPick}
                  value={taskId}
                  onChange={setTaskId}
                  options={tasks.map((t) => ({
                    value: t.id,
                    label: (
                      <span className="flex min-w-0 items-center gap-2">
                        <ProjectDot color={t.color} />
                        <span className="truncate">{t.title}</span>
                      </span>
                    ),
                  }))}
                />
              </div>
              <div className="flex h-11 items-center gap-2 pl-2.5 text-sm">
                <UserIcon className="size-4 shrink-0 text-muted-foreground" />
                <span className="w-12 shrink-0 text-muted-foreground">For</span>
                <span
                  className={cn(
                    "px-2.5",
                    !task?.assignee && "text-muted-foreground"
                  )}
                >
                  {task?.assignee ?? "Not assigned yet"}
                </span>
              </div>
            </div>

            <ol className="flex flex-col gap-2.5 px-3 pt-3">
              <AnimatePresence initial={false}>
                {drafts.map((d, i) => (
                  <motion.li
                    key={d.key}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{
                      opacity: 0,
                      scale: 0.97,
                      transition: { duration: 0.18 },
                    }}
                    transition={spring}
                    onPaste={(e) => {
                      const file = imageIn(e.clipboardData)
                      if (file) {
                        e.preventDefault()
                        void attach(d.key, file)
                      }
                    }}
                    onDragOver={(e) => {
                      e.preventDefault()
                      setOver(d.key)
                    }}
                    onDragLeave={() => setOver(null)}
                    onDrop={(e) => {
                      e.preventDefault()
                      setOver(null)
                      void attach(d.key, imageIn(e.dataTransfer))
                    }}
                    className={cn(
                      "relative rounded-panel bg-muted/60 p-3 transition-shadow",
                      over === d.key && "ring-2 ring-foreground/15"
                    )}
                  >
                    <Textarea
                      autoFocus={i === drafts.length - 1}
                      value={d.body}
                      onChange={(e) => edit(d.key, { body: e.target.value })}
                      placeholder={
                        i === 0
                          ? "What should change? Paste a screenshot here too."
                          : "Another point…"
                      }
                      aria-label={`Point ${i + 1}`}
                      className="min-h-12 resize-none border-0 bg-transparent px-1 pr-9 text-base shadow-none focus-visible:ring-0 md:text-base dark:bg-transparent"
                    />
                    {drafts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => drop(d)}
                        aria-label={`Remove point ${i + 1}`}
                        className="absolute top-2.5 right-2.5 grid size-8 place-items-center rounded-full text-muted-foreground transition-[background-color,color,scale] hover:bg-card hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-95"
                      >
                        <XIcon className="size-4" />
                      </button>
                    )}
                    {d.preview ? (
                      <div className="relative mt-2 inline-block max-w-full">
                        {/* eslint-disable-next-line @next/next/no-img-element -- a local blob preview */}
                        <img
                          src={d.preview}
                          alt={`Screenshot for point ${i + 1}`}
                          className="max-h-48 rounded-xl bg-card ring-1 ring-foreground/5"
                        />
                        <button
                          type="button"
                          onClick={() => detach(d)}
                          aria-label="Remove screenshot"
                          className="absolute -top-2 -right-2 grid size-7 place-items-center rounded-full bg-foreground text-background shadow-md transition-[scale] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-90"
                        >
                          <XIcon className="size-3.5" />
                        </button>
                      </div>
                    ) : (
                      <label className="mt-1 inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-3 text-sm text-muted-foreground transition-[background-color,color,scale] focus-within:ring-3 focus-within:ring-ring/50 hover:bg-card hover:text-foreground active:scale-95">
                        <ImagePlusIcon className="size-4" />
                        Add screenshot
                        <span className="hidden text-foreground/40 sm:inline">
                          or paste / drop
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={(e) => {
                            void attach(d.key, e.target.files?.[0])
                            e.target.value = ""
                          }}
                        />
                      </label>
                    )}
                  </motion.li>
                ))}
              </AnimatePresence>
            </ol>

            {error && (
              <p className="px-6 pt-3 text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <div className="flex items-center justify-between gap-3 px-6 pt-4 pb-5">
              <Button
                variant="ghost"
                onClick={() => setDrafts((ds) => [...ds, blank()])}
                className="-ml-3 h-10 gap-2 rounded-full px-3 font-normal text-muted-foreground transition-[background-color,scale] active:scale-95"
              >
                <PlusIcon className="size-4" />
                Add point
              </Button>
              <Button
                type="submit"
                size="lg"
                className="h-10 rounded-full px-5 transition-[background-color,scale] active:scale-95"
                disabled={pending || !taskId}
              >
                {pending ? "Sending…" : "Send feedback"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
