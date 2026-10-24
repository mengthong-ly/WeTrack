"use client"

import { Image } from "@tiptap/extension-image"
import { TaskItem, TaskList } from "@tiptap/extension-list"
import { Placeholder } from "@tiptap/extensions"
import { Markdown } from "@tiptap/markdown"
import { NodeSelection, TextSelection } from "@tiptap/pm/state"
import { type ChainedCommands, type Editor, EditorContent, Extension, useEditor, useEditorState } from "@tiptap/react"
import { BubbleMenu } from "@tiptap/react/menus"
import StarterKit from "@tiptap/starter-kit"
import { Suggestion, type SuggestionProps } from "@tiptap/suggestion"
import {
  BoldIcon,
  CodeIcon,
  CodeXmlIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ImageIcon,
  ItalicIcon,
  LinkIcon,
  ListChecksIcon,
  ListIcon,
  ListOrderedIcon,
  type LucideIcon,
  MinusIcon,
  PilcrowIcon,
  PlusIcon,
  QuoteIcon,
  StrikethroughIcon,
} from "lucide-react"
import { useContext, useEffect, useRef, useState } from "react"

import { EditorTuning } from "@/components/editor-tools"
import { shrink } from "@/lib/image"
import { cn } from "@/lib/utils"

// Tiptap editor that reads and writes Markdown, so plain-text descriptions stay valid and card previews stay readable.
// No toolbar: "/" (or the "+" on an empty line) opens the block menu, selecting text shows a small format bar,
// and Markdown shortcuts (# , - , [] , > ) still work. Images are pasted, dropped or picked from the block menu
// when the caller passes `onImage`, which stores the image and returns its URL.
// In a <form>, pass `name` to post the Markdown through a hidden input; for inline edit, use `onBlur`.
export function RichText({
  name,
  defaultValue,
  placeholder,
  onBlur,
  onImage,
  onSubmit,
  onReady,
  editable = true,
  autoFocus,
  className,
  contentClassName,
  "aria-label": ariaLabel,
}: {
  name?: string
  defaultValue?: string | null
  placeholder?: string
  onBlur?: (markdown: string) => void
  onImage?: (image: Blob) => Promise<string | null>
  /** ⌘/Ctrl + Enter inside the editor. */
  onSubmit?: () => void
  onReady?: (editor: Editor) => void
  editable?: boolean
  autoFocus?: boolean
  className?: string
  contentClassName?: string
  "aria-label"?: string
}) {
  const [value, setValue] = useState(defaultValue ?? "")
  const [slash, setSlash] = useState<Slash | null>(null)
  // Inside an EditorSheet: the writer's font, size, spacing, width and Markdown view.
  const tuning = useContext(EditorTuning)
  const source = editable && tuning?.markdown
  // The editor is built once; these refs let its plugins see the latest props and menu state.
  const slashRef = useRef<Slash | null>(null)
  const props = useRef({ onBlur, onImage, onSubmit })
  useEffect(() => {
    props.current = { onBlur, onImage, onSubmit }
  })
  const menuEl = useRef<HTMLDivElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const show = (next: Slash | null) => {
    slashRef.current = next
    setSlash(next)
  }

  async function addImages(editor: Editor, files: File[], at?: number) {
    for (const file of files) {
      const src = await props.current.onImage?.(await shrink(file))
      if (!src) continue
      const chain = editor.chain().focus()
      ;(at === undefined ? chain : chain.setTextSelection(at)).setImage({ src }).run()
      at = undefined
    }
  }

  /* eslint-disable react-hooks/refs -- the editor reads these refs in its callbacks, never while rendering */
  const editor = useEditor({
    immediatelyRender: false,
    editable,
    autofocus: autoFocus ? "end" : false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        underline: false, // not Markdown
        link: { openOnClick: !editable, autolink: true, defaultProtocol: "https" },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Image,
      Markdown,
      Placeholder.configure({
        showOnlyCurrent: true,
        placeholder: ({ editor, node }) =>
          editor.isEmpty
            ? (placeholder ?? "")
            : node.type.name === "paragraph"
              ? props.current.onImage
                ? "Type / for lists, checklists, images…"
                : "Type / for lists, checklists…"
              : "",
      }),
      SlashCommand.configure({
        suggestion: {
          items: ({ query }) =>
            blocks.filter(
              (b) => (!b.image || props.current.onImage) && `${b.label} ${b.keywords}`.toLowerCase().includes(query.toLowerCase())
            ),
          command: ({ editor, range, props: block }) => {
            const chain = editor.chain().focus().deleteRange(range)
            if (!block.image) return block.run(chain)
            chain.run()
            fileInput.current?.click()
          },
          allow: ({ state, range }) => !state.doc.resolve(range.from).parent.type.spec.code,
          render: () => {
            let unmount: (() => void) | undefined
            const open = (p: SuggestionProps<Block, Block>) =>
              show({ items: p.items, index: 0, command: p.command })
            return {
              onStart: (p) => {
                open(p)
                if (menuEl.current) unmount = p.mount(menuEl.current)
              },
              onUpdate: open,
              onExit: () => {
                unmount?.()
                show(null)
              },
              onKeyDown: ({ event }) => {
                const s = slashRef.current
                if (event.key === "Escape") {
                  event.stopPropagation() // close the menu, not the dialog around the editor
                  return true
                }
                if (!s?.items.length) return false
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  const step = event.key === "ArrowDown" ? 1 : -1
                  show({ ...s, index: (s.index + step + s.items.length) % s.items.length })
                  return true
                }
                if (event.key === "Enter" || event.key === "Tab") {
                  s.command(s.items[s.index])
                  return true
                }
                return false
              },
            }
          },
        },
      }),
    ],
    content: defaultValue ?? "",
    contentType: "markdown",
    editorProps: {
      attributes: { class: cn("rich outline-none", contentClassName), "aria-label": ariaLabel ?? "" },
      handleKeyDown: (_view, event) => {
        if (!(event.metaKey || event.ctrlKey) || event.key !== "Enter" || !props.current.onSubmit) return false
        props.current.onSubmit()
        return true
      },
      handlePaste: (_view, event) => {
        const files = imagesIn(event.clipboardData)
        if (!files.length || !props.current.onImage || !editorRef.current) return false
        void addImages(editorRef.current, files)
        return true
      },
      handleDrop: (view, event, _slice, moved) => {
        const files = imagesIn(event.dataTransfer)
        if (moved || !files.length || !props.current.onImage || !editorRef.current) return false
        void addImages(editorRef.current, files, view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos)
        return true
      },
    },
    onUpdate: ({ editor }) => name && setValue(markdownOf(editor)),
    onBlur: ({ editor }) => props.current.onBlur?.(markdownOf(editor)),
  })
  /* eslint-enable react-hooks/refs */
  const editorRef = useRef(editor)
  useEffect(() => {
    editorRef.current = editor
    if (editor) onReady?.(editor)
  }, [editor]) // eslint-disable-line react-hooks/exhaustive-deps -- once per editor

  return (
    <div
      className={cn("relative", className)}
      data-tuned={tuning ? "" : undefined}
      data-font={tuning?.font}
      style={
        tuning
          ? ({ "--rich-size": `${tuning.size}px`, "--rich-leading": tuning.leading, "--rich-width": `${tuning.width}%` } as React.CSSProperties)
          : undefined
      }
    >
      {name && <input type="hidden" name={name} value={value} />}
      {/* Saved text shows as written until the editor mounts, so the page doesn't jump. */}
      {!editor && defaultValue && <div className={cn("rich whitespace-pre-wrap", contentClassName)}>{defaultValue}</div>}
      {/* Markdown view: the same text as source. Typing updates the editor, which stays mounted underneath. */}
      {editor && source && (
        <textarea
          aria-label={ariaLabel}
          placeholder={placeholder}
          defaultValue={markdownOf(editor)}
          spellCheck
          onChange={(e) => editor.commands.setContent(e.target.value, { contentType: "markdown" })}
          onBlur={(e) => props.current.onBlur?.(e.target.value.trim())}
          onKeyDown={(e) => {
            if (!(e.metaKey || e.ctrlKey) || e.key !== "Enter" || !props.current.onSubmit) return
            e.preventDefault()
            props.current.onSubmit()
          }}
          className={cn(
            "rich-source block field-sizing-content w-full resize-none bg-transparent leading-relaxed outline-none placeholder:text-muted-foreground/70",
            contentClassName
          )}
        />
      )}
      <div hidden={!!source}>
        <EditorContent editor={editor} />
      </div>
      {editor && editable && !source && (
        <>
          <FormatBar editor={editor} />
          <BlockHandle editor={editor} />
          {onImage && (
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                void addImages(editor, [...(e.target.files ?? [])])
                e.target.value = ""
              }}
            />
          )}
        </>
      )}
      {/* The block menu. Suggestion positions it at the caret; it stays in this tree so dialogs treat it as inside. */}
      <div
        ref={menuEl}
        role="listbox"
        aria-label="Blocks"
        hidden={!slash?.items.length}
        className="absolute z-50 max-h-80 min-w-60 overflow-y-auto rounded-panel bg-card p-1.5 shadow-lg ring-1 ring-foreground/5"
      >
        {slash?.items.map((b, i) => (
          <button
            key={b.label}
            type="button"
            role="option"
            aria-selected={i === slash.index}
            ref={i === slash.index ? (el) => el?.scrollIntoView({ block: "nearest" }) : undefined}
            onMouseDown={(e) => e.preventDefault()} // keep the editor's selection
            onMouseEnter={() => show({ ...slash, index: i })}
            onClick={() => slash.command(b)}
            className="flex h-10 w-full items-center gap-3 rounded-row px-3 text-left text-sm outline-none aria-selected:bg-muted"
          >
            <b.icon className="size-4 shrink-0 text-muted-foreground" />
            {b.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// Empty lines are written as "&nbsp;"; the ones at the end are just where the cursor was left.
const markdownOf = (editor: Editor) => (editor.isEmpty ? "" : editor.getMarkdown().replace(/(\s*&nbsp;)+\s*$/, "").trim())
const imagesIn = (data: DataTransfer | null) => [...(data?.files ?? [])].filter((f) => f.type.startsWith("image/"))

type Slash = { items: Block[]; index: number; command: (block: Block) => void }
type Block = { label: string; icon: LucideIcon; keywords: string; run: (c: ChainedCommands) => boolean; image?: true }

const blocks: Block[] = [
  { label: "Text", icon: PilcrowIcon, keywords: "paragraph plain", run: (c) => c.setParagraph().run() },
  { label: "Heading 1", icon: Heading1Icon, keywords: "title big h1 #", run: (c) => c.setHeading({ level: 1 }).run() },
  { label: "Heading 2", icon: Heading2Icon, keywords: "subtitle h2 ##", run: (c) => c.setHeading({ level: 2 }).run() },
  { label: "Heading 3", icon: Heading3Icon, keywords: "small h3 ###", run: (c) => c.setHeading({ level: 3 }).run() },
  { label: "Bulleted list", icon: ListIcon, keywords: "ul bullet points", run: (c) => c.toggleBulletList().run() },
  { label: "Numbered list", icon: ListOrderedIcon, keywords: "ol ordered steps", run: (c) => c.toggleOrderedList().run() },
  { label: "Checklist", icon: ListChecksIcon, keywords: "todo task checkbox", run: (c) => c.toggleTaskList().run() },
  { label: "Image", icon: ImageIcon, keywords: "picture photo screenshot", run: (c) => c.run(), image: true },
  { label: "Quote", icon: QuoteIcon, keywords: "blockquote", run: (c) => c.toggleBlockquote().run() },
  { label: "Code block", icon: CodeXmlIcon, keywords: "pre snippet", run: (c) => c.toggleCodeBlock().run() },
  { label: "Divider", icon: MinusIcon, keywords: "line rule hr separator", run: (c) => c.setHorizontalRule().run() },
]

const SlashCommand = Extension.create<{ suggestion: Omit<Parameters<typeof Suggestion<Block, Block>>[0], "editor"> }>({
  name: "slashCommand",
  addOptions: () => ({ suggestion: {} }),
  addProseMirrorPlugins() {
    return [Suggestion<Block, Block>({ editor: this.editor, char: "/", ...this.options.suggestion })]
  },
})

const iconButton =
  "grid size-8 place-items-center rounded-full text-muted-foreground outline-none transition-[background-color,color,scale] hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95 aria-pressed:bg-foreground aria-pressed:text-background"

type Mark = { icon: LucideIcon; label: string; active: string; run: (e: Editor) => void }
const marks: Mark[] = [
  { icon: BoldIcon, label: "Bold", active: "bold", run: (e) => e.chain().focus().toggleBold().run() },
  { icon: ItalicIcon, label: "Italic", active: "italic", run: (e) => e.chain().focus().toggleItalic().run() },
  { icon: StrikethroughIcon, label: "Strikethrough", active: "strike", run: (e) => e.chain().focus().toggleStrike().run() },
  { icon: CodeIcon, label: "Inline code", active: "code", run: (e) => e.chain().focus().toggleCode().run() },
  { icon: LinkIcon, label: "Link", active: "link", run: toggleLink },
]

// ponytail: native prompt() for the URL; swap for a popover if links get edited often.
function toggleLink(e: Editor) {
  if (e.isActive("link")) return e.chain().focus().unsetLink().run()
  const href = prompt("Link URL")?.trim()
  if (href) e.chain().focus().extendMarkRange("link").setLink({ href }).run()
}

// Shown over selected text: the marks that make sense inline.
function FormatBar({ editor }: { editor: Editor }) {
  const active = useEditorState({
    editor,
    selector: ({ editor }) => Object.fromEntries(marks.map((m) => [m.active, editor.isActive(m.active)])),
  })
  return (
    <BubbleMenu
      editor={editor}
      pluginKey="formatBar"
      shouldShow={({ editor, view, state }) =>
        editor.isEditable &&
        view.hasFocus() &&
        state.selection instanceof TextSelection &&
        !state.selection.empty &&
        !editor.isActive("codeBlock")
      }
      options={{ placement: "top", offset: 8 }}
      role="toolbar"
      aria-label="Formatting"
      className="z-50 flex items-center gap-0.5 rounded-full bg-card/80 p-1 shadow-lg ring-1 ring-foreground/5 backdrop-blur"
    >
      {marks.map((m) => (
        <button
          key={m.label}
          type="button"
          aria-label={m.label}
          title={m.label}
          aria-pressed={active[m.active] ?? false}
          onMouseDown={(e) => e.preventDefault()} // keep the editor's selection
          onClick={() => m.run(editor)}
          className={iconButton}
        >
          <m.icon className="size-4" />
        </button>
      ))}
    </BubbleMenu>
  )
}

// A faint "+" at the end of an empty line. It types "/" so the block menu opens: one menu, one way in.
function BlockHandle({ editor }: { editor: Editor }) {
  return (
    <BubbleMenu
      editor={editor}
      pluginKey="blockHandle"
      updateDelay={0}
      shouldShow={({ editor, view, state }) => {
        const { selection } = state
        return (
          editor.isEditable &&
          view.hasFocus() &&
          selection.empty &&
          !(selection instanceof NodeSelection) &&
          selection.$from.parent.type.name === "paragraph" &&
          selection.$from.parent.content.size === 0 &&
          !editor.isActive("codeBlock")
        )
      }}
      getReferencedVirtualElement={() => {
        const dom = editor.view.domAtPos(editor.state.selection.from).node
        const el = dom instanceof HTMLElement ? dom : dom.parentElement
        return el ? { getBoundingClientRect: () => el.getBoundingClientRect() } : null
      }}
      options={{ placement: "right", offset: -28, flip: false, shift: false }}
      className="z-40"
    >
      <button
        type="button"
        aria-label="Add a block"
        title="Add a block"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().insertContent("/").run()}
        className="grid size-7 place-items-center rounded-full text-muted-foreground/70 outline-none transition-[background-color,color,scale] hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95"
      >
        <PlusIcon className="size-4" />
      </button>
    </BubbleMenu>
  )
}
