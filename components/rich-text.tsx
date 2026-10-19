"use client"

import { Markdown } from "@tiptap/markdown"
import { Placeholder } from "@tiptap/extensions"
import { type Editor, EditorContent, useEditor, useEditorState } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import {
  BoldIcon,
  CodeIcon,
  CodeXmlIcon,
  HeadingIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  type LucideIcon,
  QuoteIcon,
  StrikethroughIcon,
} from "lucide-react"
import { useState } from "react"

import { cn } from "@/lib/utils"

// Tiptap editor that reads and writes Markdown, so plain-text descriptions stay valid and card previews stay readable.
// In a <form>, pass `name` to post the Markdown through a hidden input; for inline edit, use `onBlur`.
export function RichText({
  name,
  defaultValue,
  placeholder,
  onBlur,
  className,
  contentClassName,
  "aria-label": ariaLabel,
}: {
  name?: string
  defaultValue?: string | null
  placeholder?: string
  onBlur?: (markdown: string) => void
  className?: string
  contentClassName?: string
  "aria-label"?: string
}) {
  const [value, setValue] = useState(defaultValue ?? "")
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [3] },
        underline: false, // not Markdown
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
      Markdown,
      Placeholder.configure({ placeholder }),
    ],
    content: defaultValue ?? "",
    contentType: "markdown",
    editorProps: {
      attributes: { class: cn("rich outline-none", contentClassName), "aria-label": ariaLabel ?? "" },
    },
    onUpdate: ({ editor }) => name && setValue(markdownOf(editor)),
    onBlur: ({ editor }) => onBlur?.(markdownOf(editor)),
  })

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {name && <input type="hidden" name={name} value={value} />}
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  )
}

const markdownOf = (editor: Editor) => (editor.isEmpty ? "" : editor.getMarkdown().trim())

type Tool = { icon: LucideIcon; label: string; active: string; run: (e: Editor) => void }

const groups: Tool[][] = [
  [
    { icon: HeadingIcon, label: "Heading", active: "heading", run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
    { icon: ListIcon, label: "Bulleted list", active: "bulletList", run: (e) => e.chain().focus().toggleBulletList().run() },
    { icon: ListOrderedIcon, label: "Numbered list", active: "orderedList", run: (e) => e.chain().focus().toggleOrderedList().run() },
    { icon: QuoteIcon, label: "Quote", active: "blockquote", run: (e) => e.chain().focus().toggleBlockquote().run() },
  ],
  [
    { icon: BoldIcon, label: "Bold", active: "bold", run: (e) => e.chain().focus().toggleBold().run() },
    { icon: ItalicIcon, label: "Italic", active: "italic", run: (e) => e.chain().focus().toggleItalic().run() },
    { icon: StrikethroughIcon, label: "Strikethrough", active: "strike", run: (e) => e.chain().focus().toggleStrike().run() },
    { icon: CodeIcon, label: "Inline code", active: "code", run: (e) => e.chain().focus().toggleCode().run() },
    { icon: CodeXmlIcon, label: "Code block", active: "codeBlock", run: (e) => e.chain().focus().toggleCodeBlock().run() },
    { icon: LinkIcon, label: "Link", active: "link", run: toggleLink },
  ],
]

// ponytail: native prompt() for the URL; swap for a popover if links get edited often.
function toggleLink(e: Editor) {
  if (e.isActive("link")) return e.chain().focus().unsetLink().run()
  const href = prompt("Link URL")?.trim()
  if (href) e.chain().focus().extendMarkRange("link").setLink({ href }).run()
}

function Toolbar({ editor }: { editor: Editor | null }) {
  const active = useEditorState({
    editor,
    selector: ({ editor }) =>
      Object.fromEntries(groups.flat().map((t) => [t.active, editor?.isActive(t.active) ?? false])),
  })
  return (
    <div role="toolbar" aria-label="Formatting" className="-mx-1.5 flex flex-wrap items-center gap-0.5">
      {groups.map((group, i) => (
        <div key={i} className="flex items-center gap-0.5">
          {i > 0 && <span className="mx-1 h-4 w-px bg-foreground/10" />}
          {group.map((t) => (
            <button
              key={t.label}
              type="button"
              aria-label={t.label}
              title={t.label}
              aria-pressed={active?.[t.active] ?? false}
              disabled={!editor}
              onMouseDown={(e) => e.preventDefault()} // keep the editor's selection
              onClick={() => editor && t.run(editor)}
              className="grid size-8 place-items-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:bg-foreground aria-pressed:text-background"
            >
              <t.icon className="size-4" />
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
