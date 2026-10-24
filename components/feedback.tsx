"use client"

import type { Editor } from "@tiptap/react"
import {
  CircleCheckIcon,
  ChevronRightIcon,
  CircleDashedIcon,
  ClockIcon,
  ImageOffIcon,
  ImagePlusIcon,
  ImageUpIcon,
  ListChecksIcon,
  MoreHorizontalIcon,
  PenLineIcon,
  PlusIcon,
  RotateCcwIcon,
  Trash2Icon,
  UserIcon,
} from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react"
import { toast } from "sonner"

import {
  createFeedback,
  deleteFeedback,
  setFeedbackImage,
  setFeedbackResolved,
  updateFeedback,
} from "@/app/actions"
import { Crumbs, LoadMore, ProjectDot, UserAvatar } from "@/components/bits"
import {
  EditorSheet,
  FocusLayout,
  PanelToggle,
  SideAction,
  SideProp,
  SideSection,
  Tuned,
} from "@/components/editor-tools"
import { ImageGallery } from "@/components/image-gallery"
import { Reveal, spring } from "@/components/motion-bits"
import { Pick } from "@/components/pick"
import { PillTabs } from "@/components/pill-tabs"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { FEEDBACK_PAGE, feedbackKey, type FeedbackWho, readFeedbackParams } from "@/lib/paging"
import { imageForm, shrink, uploadTo } from "@/lib/image"
import { type ListPage, useServerList } from "@/lib/use-server-list"
import { plainText } from "@/lib/markdown"
import { attachmentSrc, cn } from "@/lib/utils"

// Tiptap loads after the page; until then read-only notes show as written.
const RichText = dynamic(() =>
  import("@/components/rich-text").then((m) => m.RichText)
)

type Person = { id: string; name: string; image: string | null }
export type FeedbackItem = {
  id: string
  body: string | null
  imageId: string | null
  resolved: boolean
  when: string
  task: { id: string; title: string; color: string; project: string } | null
  author: Person | null
  recipient: Person | null
  canDelete: boolean
}
export type FeedbackTask = {
  id: string
  title: string
  color: string
  assigneeId: string | null
}

type Who = "mine" | "given" | "all"
const EMPTY: Record<Who, string> = {
  mine: "Nothing to fix. Feedback on your tasks shows up here.",
  given: "You haven't given feedback yet. Pick someone and paste a screenshot.",
  all: "No open feedback. Give some with the button above.",
}

// Tab, Open / Fixed and how many are shown live in the URL (?who=, ?fixed=1, ?show=), changed through the
// History API like the Tasks filters; useServerList fetches the feedback for the new URL.
function setParam(key: string, value: string | null, { replace = false } = {}) {
  const q = new URLSearchParams(window.location.search)
  if (value) q.set(key, value)
  else q.delete(key)
  if (key !== "show") q.delete("show")
  window.history[replace ? "replaceState" : "pushState"](null, "", `?${q}`)
}

export function FeedbackBoard({
  initial,
  fallback,
  meId,
}: {
  initial: ListPage<FeedbackItem> & { open: Record<FeedbackWho, number> }
  fallback: FeedbackWho // the tab with no ?who=: "For me" when there's something to fix
  meId: string
}) {
  const params = readFeedbackParams(useSearchParams(), fallback)
  const { who, fixed } = params
  const { rows, total, open, pending, appending } = useServerList(initial, feedbackKey(params), "/api/feedback")
  const [optimistic, setResolved] = useOptimistic(
    rows,
    (state, { id, resolved }: { id: string; resolved: boolean }) =>
      state.map((i) => (i.id === id ? { ...i, resolved } : i))
  )
  const [, start] = useTransition()

  // Pin the first tab into the URL, so the board stays on it when a fix changes what the default would be.
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("who")) setParam("who", fallback, { replace: true })
  }, [fallback])
  const setWho = (w: Who) => setParam("who", w)
  const setFixed = (f: boolean) => setParam("fixed", f ? "1" : null)

  // Feedback ticked fixed leaves the Open list at once; the server's next page agrees.
  const shown = optimistic.filter((i) => i.resolved === fixed)
  // Grouped by task (feedback without one, by who they're for), newest feedback first; feedback inside a group reads in
  // the order they were written.
  const byGroup = new Map<string, FeedbackItem[]>()
  for (const i of shown) {
    const key = i.task?.id ?? `for:${i.recipient?.id}`
    byGroup.set(key, [i, ...(byGroup.get(key) ?? [])])
  }
  const groups = [...byGroup.entries()]

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
    if (!confirm("Delete this feedback? This can't be undone.")) return
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
              label: <>For me {count(open.mine)}</>,
              active: who === "mine",
              onSelect: () => setWho("mine"),
            },
            {
              key: "given",
              label: <>From me {count(open.given)}</>,
              active: who === "given",
              onSelect: () => setWho("given"),
            },
            {
              key: "all",
              label: <>Everyone {count(open.all)}</>,
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
          nativeButton={false}
          render={<Link href="/feedback/new" />}
          className="h-11 gap-2 rounded-full px-5 transition-[background-color,scale] active:scale-95 sm:ml-auto"
        >
          <PlusIcon className="size-4" />
          Give feedback
        </Button>
      </Reveal>

      <Reveal
        index={2}
        className={cn(
          "flex flex-col gap-6 rounded-sheet bg-card p-3 shadow-sm transition-opacity duration-200 sm:p-4",
          pending && !appending && "opacity-60"
        )}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {groups.map(([key, points]) => {
            const { task, recipient } = points[0]
            return (
              <motion.section
                key={key}
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
                  {task ? (
                    <>
                      <ProjectDot color={task.color} className="size-2.5" />
                      <Link
                        href={`/tasks/${task.id}`}
                        className="min-w-0 truncate text-lg hover:underline"
                        title={task.project}
                      >
                        {task.title}
                      </Link>
                    </>
                  ) : (
                    <span className="min-w-0 truncate text-lg">General</span>
                  )}
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
            {fixed ? "Fixed feedback shows up here." : EMPTY[who]}
          </p>
        )}
        <LoadMore
          left={total - rows.length}
          pending={appending}
          onClick={() => setParam("show", String(params.show + FEEDBACK_PAGE), { replace: true })}
          className="bg-muted/60 ring-0 backdrop-blur-none hover:bg-muted"
        />
      </Reveal>

    </>
  )
}

function Point({
  item,
  onResolve,
  onDelete,
}: {
  item: FeedbackItem
  onResolve: (item: FeedbackItem, resolved: boolean) => void
  onDelete: (item: FeedbackItem) => void
}) {
  const done = item.resolved
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.18 } }}
      transition={spring}
      className="group relative flex gap-3 rounded-row bg-muted/60 py-3 pr-2 pl-3 transition-[background-color,scale] duration-150 ease-out hover:bg-muted has-[[data-row-link]:active]:scale-[0.99] sm:pl-4"
    >
      {/* The whole row opens the feedback, like a TaskCard; the controls below sit above this link (z-10). */}
      <Link
        href={`/feedback/${item.id}`}
        data-row-link
        aria-label="Open feedback"
        className="absolute inset-0 rounded-row outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      {/* Round checkbox, as on TaskCard. */}
      <button
        type="button"
        onClick={() => onResolve(item, !done)}
        aria-label={done ? "Mark as not fixed" : "Mark as fixed"}
        aria-pressed={done}
        className="relative z-10 mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-[1.5px] border-foreground/30 transition-colors hover:border-foreground/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
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
      {/* Read-only content lets clicks through to the row link, so anywhere on it opens the feedback. */}
      <div className="pointer-events-none min-w-0 flex-1">
        {item.body && (
          <RichText
            editable={false}
            defaultValue={item.body}
            contentClassName={cn(
              "text-base",
              done &&
                "text-muted-foreground line-through decoration-foreground/30"
            )}
          />
        )}
        {item.imageId && (
          <div
            className={cn(
              "w-full max-w-lg overflow-hidden rounded-xl bg-card ring-1 ring-foreground/5",
              item.body && "mt-2.5",
              done && "opacity-60"
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- private, cookie-guarded image; next/image can't fetch it */}
            <img
              src={attachmentSrc(item.imageId)}
              alt=""
              loading="lazy"
              className="h-44 w-full object-cover object-top sm:h-56"
            />
          </div>
        )}
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          {item.author && (
            <UserAvatar user={item.author} className="size-5 ring-0" />
          )}
          {item.author?.name ?? "Former member"} ·{" "}
          {item.when}
        </p>
      </div>
      <ChevronRightIcon
        aria-hidden
        className="mt-1 size-4 shrink-0 -translate-x-1 text-muted-foreground opacity-0 transition-[opacity,translate] duration-150 ease-out group-hover:translate-x-0 group-hover:opacity-100 max-sm:hidden"
      />
      {item.canDelete && (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Feedback actions"
            className="relative z-10 grid size-10 shrink-0 place-items-center rounded-full text-muted-foreground transition-[background-color,color,scale] outline-none hover:bg-card hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95"
          >
            <MoreHorizontalIcon className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem render={<Link href={`/feedback/${item.id}`} />}>
              <PenLineIcon />
              Edit feedback
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => onDelete(item)}
            >
              <Trash2Icon />
              Delete feedback
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </motion.li>
  )
}

// ---------- One feedback ----------

// A feedback's own page (/feedback/[id]): the note and full-size screenshot as one document, who and what it's about in
// the side panel, and the dark pill to mark it fixed (or reopen it).
export function FeedbackDetail({ item }: { item: FeedbackItem }) {
  const router = useRouter()
  const [resolved, setResolved] = useOptimistic(item.resolved)
  const [pending, start] = useTransition()
  const title = item.body ? plainText(item.body).slice(0, 80) : "Screenshot"
  const firstName = (p: Person | null) => p?.name.split(" ")[0]

  function resolve(next: boolean) {
    start(async () => {
      setResolved(next)
      const res = await setFeedbackResolved(item.id, next)
      if (res.error) toast.error(res.error)
      else if (next) toast.success("Marked as fixed", { action: { label: "Undo", onClick: () => resolve(false) } })
    })
  }

  // Edit in place: saved when the editor loses focus, and only if the text changed.
  const saved = useRef(item.body?.trim() ?? "")
  function save(markdown: string) {
    const next = markdown.trim()
    if (next === saved.current) return
    start(async () => {
      const res = await updateFeedback(item.id, next)
      if (res.error) toast.error(res.error)
      else {
        saved.current = next
        toast.success("Feedback updated")
      }
    })
  }

  // Adds, replaces or (with null) removes the screenshot; the page shows the new one once it's saved.
  const picker = useRef<HTMLInputElement>(null)
  function setImage(file: File | null) {
    if (!file && !confirm("Remove the screenshot from this feedback?")) return
    start(async () => {
      const res = await setFeedbackImage(item.id, file ? imageForm("image", await shrink(file)) : new FormData())
      if (res.error) toast.error(res.error)
      else toast.success(file ? "Screenshot saved" : "Screenshot removed")
    })
  }

  function remove() {
    if (!confirm("Delete this feedback? This can't be undone.")) return
    start(async () => {
      const res = await deleteFeedback(item.id)
      if (res.error) return void toast.error(res.error)
      toast.success("Feedback deleted")
      router.replace("/feedback")
    })
  }

  return (
    <div data-focus className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-2">
        <Crumbs onBack={() => router.back()} trail={[{ href: "/feedback", label: "Feedback" }]} current={title} />
        <div className="flex shrink-0 items-center gap-2">
          <PanelToggle />
          <Button
            type="button"
            variant={resolved ? "secondary" : "default"}
            onClick={() => resolve(!resolved)}
            disabled={pending}
            className="h-11 gap-2 rounded-full px-5 transition-[background-color,scale] active:scale-95"
          >
            {resolved ? <RotateCcwIcon className="size-4" /> : <CircleCheckIcon className="size-4" />}
            {resolved ? "Reopen" : "Mark as fixed"}
          </Button>
        </div>
      </div>

      <ImageGallery>
      <FocusLayout
        side={
          <>
            <SideSection label="Feedback">
              <SideProp icon={UserIcon} label="For">
                <Person person={item.recipient} fallback="Nobody yet" />
              </SideProp>
              <SideProp icon={PenLineIcon} label="From">
                <Person person={item.author} fallback="Former member" />
              </SideProp>
              <SideProp icon={ListChecksIcon} label="Task">
                {item.task ? (
                  <Link href={`/tasks/${item.task.id}`} className="flex min-w-0 items-center gap-2 px-2.5 hover:underline">
                    <ProjectDot color={item.task.color} />
                    <span className="truncate">{item.task.title}</span>
                  </Link>
                ) : (
                  <span className="px-2.5 text-muted-foreground">No task</span>
                )}
              </SideProp>
              <SideProp icon={resolved ? CircleCheckIcon : CircleDashedIcon} label="Status">
                <span className={cn("px-2.5", !resolved && "text-muted-foreground")}>{resolved ? "Fixed" : "Open"}</span>
              </SideProp>
              <SideProp icon={ClockIcon} label="Given">
                <span className="px-2.5">{item.when}</span>
              </SideProp>
            </SideSection>
            {item.canDelete && (
              <SideSection label="Actions">
                <input
                  ref={picker}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden
                  onChange={(e) => {
                    const file = e.currentTarget.files?.[0]
                    e.currentTarget.value = ""
                    if (file) setImage(file)
                  }}
                />
                <SideAction icon={item.imageId ? ImageUpIcon : ImagePlusIcon} onClick={() => picker.current?.click()} disabled={pending}>
                  {item.imageId ? "Replace screenshot" : "Add screenshot"}
                </SideAction>
                {item.imageId && item.body && (
                  <SideAction icon={ImageOffIcon} onClick={() => setImage(null)} disabled={pending}>
                    Remove screenshot
                  </SideAction>
                )}
                <SideAction icon={Trash2Icon} onClick={remove} disabled={pending} destructive>
                  Delete feedback
                </SideAction>
              </SideSection>
            )}
          </>
        }
      >
        {/* The feedback as one document: who it's for in a quiet line, the note, then the screenshot at full size. */}
        <article className="flex flex-col rounded-tile bg-card px-5 py-6 shadow-sm sm:px-10 sm:py-9">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span>
              {firstName(item.author) ?? "Someone"} for {item.recipient ? firstName(item.recipient) : "nobody yet"}
            </span>
            {item.task && (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <ProjectDot color={item.task.color} />
                <span className="truncate">{item.task.title}</span>
              </span>
            )}
            <span className={resolved ? "text-foreground" : undefined}>{resolved ? "Fixed" : "Open"}</span>
          </p>
          <div className="my-5 h-px bg-foreground/5" />
          {(item.body || item.canDelete) && (
            <Tuned>
              <RichText
                editable={item.canDelete}
                defaultValue={item.body}
                placeholder="Add details, or type / for headings, checklists and images…"
                aria-label="Feedback note"
                onBlur={save}
                onImage={uploadTo}
                contentClassName={cn("text-base", resolved && "text-muted-foreground")}
              />
            </Tuned>
          )}
          {item.imageId && (
            <button
              type="button"
              data-zoom
              aria-label="Open screenshot"
              className={cn(
                "block max-w-full cursor-zoom-in self-start overflow-hidden rounded-panel bg-muted ring-1 ring-foreground/5 transition-[scale] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-99",
                item.body && "mt-6"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- private, cookie-guarded image; next/image can't fetch it */}
              <img src={attachmentSrc(item.imageId)} alt="Screenshot" className="max-h-72 w-auto object-contain" />
            </button>
          )}
        </article>
      </FocusLayout>
      </ImageGallery>
    </div>
  )
}

function Person({ person, fallback }: { person: Person | null; fallback: string }) {
  if (!person) return <span className="px-2.5 text-muted-foreground">{fallback}</span>
  return (
    <span className="flex min-w-0 items-center gap-2 px-2.5">
      <UserAvatar user={person} className="size-5 ring-0" />
      <span className="truncate">{person.name}</span>
    </span>
  )
}

// ---------- Composer ----------

// What you wrote stays if you leave the page before sending (until a reload); Send clears it. Only
// ever written in the browser, so the server's copy of this module stays empty.
const saved = { taskId: "", recipientId: "", draft: "" }
const NO_TASK = "none"

// The Give feedback page: pick who it's for (or a task, which picks its assignee), then write it.
export function GiveFeedback({
  tasks,
  people,
  taskId: linked,
}: {
  tasks: FeedbackTask[]
  people: Person[]
  /** From `?task=`, e.g. the task page's "Give feedback" button. */
  taskId?: string
}) {
  const router = useRouter()
  const [taskId, setTaskId] = useState(linked ?? saved.taskId)
  const [recipientId, setRecipientId] = useState(saved.recipientId)
  const [empty, setEmpty] = useState(!saved.draft)
  const editor = useRef<Editor>(null)
  const [error, setError] = useState<string>()
  const [pending, start] = useTransition()
  const task = tasks.find((t) => t.id === taskId)
  // A task's feedback goes to its assignee; otherwise to whoever is picked.
  const forId = task ? task.assigneeId : recipientId
  const forName = people.find((p) => p.id === forId)?.name

  function ready(e: Editor) {
    editor.current = e
    const sync = () => {
      setEmpty(e.isEmpty)
      saved.draft = e.isEmpty ? "" : e.getMarkdown()
    }
    sync()
    e.on("update", sync)
  }

  function submit() {
    if (!editor.current) return
    const form = new FormData()
    if (task) form.set("taskId", task.id)
    else form.set("recipientId", recipientId)
    form.set("body", editor.current.getMarkdown())
    start(async () => {
      const res = await createFeedback(form)
      if (res.error) return setError(res.error)
      Object.assign(saved, { taskId: "", recipientId: "", draft: "" })
      toast.success(forName ? `Sent feedback to ${forName.split(" ")[0]}` : "Feedback saved")
      router.replace("/feedback")
    })
  }

  return (
    <form
      action={submit}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter")
          e.currentTarget.requestSubmit()
      }}
      data-focus
      className="flex flex-col gap-6"
    >
      <div className="flex items-center justify-between gap-2">
        <Crumbs
          onBack={() => router.back()}
          trail={[{ href: "/feedback", label: "Feedback" }]}
          current="Give feedback"
        />
        <div className="flex shrink-0 items-center gap-2">
          <PanelToggle />
          <Button
            type="submit"
            className="h-11 rounded-full px-5 transition-[background-color,scale] active:scale-95"
            disabled={pending || (!task && !recipientId) || empty}
          >
            {pending ? "Sending…" : "Send feedback"}
          </Button>
        </div>
      </div>
      <ImageGallery>
      <FocusLayout
        title={<h1 className="sr-only">Give feedback</h1>}
        side={
          <SideSection label="Feedback">
            <SideProp icon={UserIcon} label="For">
              {task ? (
                <span className={cn("truncate px-2.5", !forName && "text-muted-foreground")}>
                  {forName ?? "Not assigned yet"}
                </span>
              ) : (
                <Pick
                  aria-label="For"
                  variant="ghost"
                  className="max-w-full *:data-[slot=select-value]:min-w-0"
                  placeholder="Pick someone"
                  value={recipientId || null}
                  onChange={(id) => {
                    setRecipientId(id)
                    saved.recipientId = id
                  }}
                  options={people.map((p) => ({
                    value: p.id,
                    label: (
                      <span className="flex min-w-0 items-center gap-2">
                        <UserAvatar user={p} className="size-5 ring-0" />
                        <span className="truncate">{p.name}</span>
                      </span>
                    ),
                  }))}
                />
              )}
            </SideProp>
            <SideProp icon={ListChecksIcon} label="Task">
              <Pick
                aria-label="Task"
                variant="ghost"
                className="max-w-full *:data-[slot=select-value]:min-w-0"
                value={taskId || NO_TASK}
                onChange={(id) => {
                  const next = id === NO_TASK ? "" : id
                  setTaskId(next)
                  saved.taskId = next
                }}
                options={[
                  { value: NO_TASK, label: <span className="text-muted-foreground">No task</span> },
                  ...tasks.map((t) => ({
                    value: t.id,
                    label: (
                      <span className="flex min-w-0 items-center gap-2">
                        <ProjectDot color={t.color} />
                        <span className="truncate">{t.title}</span>
                      </span>
                    ),
                  })),
                ]}
              />
            </SideProp>
          </SideSection>
        }
      >
        <EditorSheet className="flex flex-col gap-4">
          <RichText
            autoFocus
            aria-label="Feedback"
            defaultValue={saved.draft}
            placeholder="What should change? Paste screenshots where they help."
            onImage={uploadTo}
            onReady={ready}
            contentClassName="min-h-[60dvh] text-base"
          />
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ImagePlusIcon className="size-3.5 shrink-0" />
            Paste or drop screenshots, or type / for headings and lists. ⌘↵
            sends.
          </p>
        </EditorSheet>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </FocusLayout>
      </ImageGallery>
    </form>
  )
}
