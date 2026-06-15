"use client"

import type { Editor } from "@tiptap/react"
import {
  Bold, Italic, Heading2, Heading3, List, ListOrdered,
  Quote, Minus, Link2, Image, PlayCircle, Code,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useTranslations } from "next-intl"

function Btn({ active, onClick, title, children }: {
  active?: boolean; onClick: () => void; title: string; children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "p-1.5 rounded hover:bg-gray-100 transition-colors",
        active ? "bg-[#D1F0E0] text-[#2D7A5F]" : "text-[#6B7280]"
      )}
    >
      {children}
    </button>
  )
}

export function BlogEditorToolbar({ editor, onImageUpload }: {
  editor: Editor | null
  onImageUpload: () => void
}) {
  const t = useTranslations("compBlogBlogEditorToolbar")

  if (!editor) return null

  function addLink() {
    const url = window.prompt(t("promptEnterUrl"), "https://")
    if (!url) return
    editor!.chain().focus().setLink({ href: url }).run()
  }

  function addYoutube() {
    const url = window.prompt(t("promptPasteYoutubeUrl"), "https://www.youtube.com/watch?v=")
    if (!url) return
    editor!.chain().focus().setYoutubeVideo({ src: url }).run()
  }

  return (
    <div className="flex flex-wrap items-center gap-0.5 px-3 py-2 border-b border-gray-200 bg-gray-50 rounded-t-xl">
      <Btn title={t("titleBold")} active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold size={15} />
      </Btn>
      <Btn title={t("titleItalic")} active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic size={15} />
      </Btn>
      <Btn title={t("titleCode")} active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()}>
        <Code size={15} />
      </Btn>
      <span className="w-px h-5 bg-gray-200 mx-1" />
      <Btn title={t("titleHeading2")} active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 size={15} />
      </Btn>
      <Btn title={t("titleHeading3")} active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        <Heading3 size={15} />
      </Btn>
      <span className="w-px h-5 bg-gray-200 mx-1" />
      <Btn title={t("titleBulletList")} active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List size={15} />
      </Btn>
      <Btn title={t("titleNumberedList")} active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered size={15} />
      </Btn>
      <Btn title={t("titleBlockquote")} active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote size={15} />
      </Btn>
      <Btn title={t("titleDivider")} onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        <Minus size={15} />
      </Btn>
      <span className="w-px h-5 bg-gray-200 mx-1" />
      <Btn title={t("titleAddLink")} active={editor.isActive("link")} onClick={addLink}>
        <Link2 size={15} />
      </Btn>
      <Btn title={t("titleInsertImage")} onClick={onImageUpload}>
        <Image size={15} />
      </Btn>
      <Btn title={t("titleEmbedYoutube")} onClick={addYoutube}>
        <PlayCircle size={15} />
      </Btn>
    </div>
  )
}
