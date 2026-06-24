"use client"

import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import ImageExt from "@tiptap/extension-image"
import Youtube from "@tiptap/extension-youtube"
import Link from "@tiptap/extension-link"
import Placeholder from "@tiptap/extension-placeholder"
import { useRef, useEffect } from "react"
import { useTranslations } from "next-intl"
import { BlogEditorToolbar } from "./BlogEditorToolbar"

interface BlogEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
}

export function BlogEditor({ value, onChange, placeholder }: BlogEditorProps) {
  const t = useTranslations("compBlogBlogEditor")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const editorPlaceholder = placeholder ?? t("placeholderWriteArticle")

  const editor = useEditor({
    extensions: [
      // StarterKit v3 bundles Link; disable it so our custom Link below isn't a duplicate.
      StarterKit.configure({ link: false }),
      ImageExt.configure({ allowBase64: false, HTMLAttributes: { class: "rounded-lg max-w-full my-4" } }),
      Youtube.configure({ controls: true, nocookie: true, HTMLAttributes: { class: "w-full aspect-video rounded-lg my-4" } }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-[#2D7A5F] underline" } }),
      Placeholder.configure({ placeholder: editorPlaceholder }),
    ],
    content: value,
    editorProps: {
      attributes: { class: "prose prose-slate max-w-none min-h-[400px] px-5 py-4 focus:outline-none text-sm leading-relaxed" },
    },
    onUpdate({ editor }) {
      onChange(editor.getHTML())
    },
  })

  // Sync external value changes (e.g. loading saved draft)
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false })
    }
  }, [value, editor])

  async function handleImageFile(file: File) {
    if (!editor) return
    try {
      const presignRes = await fetch("/api/upload/presigned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type, contentLength: file.size, folder: "blog-images" }),
      })
      const { uploadUrl, publicUrl } = await presignRes.json()
      await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } })
      editor.chain().focus().setImage({ src: publicUrl, alt: file.name }).run()
    } catch {
      alert(t("errorImageUploadFailed"))
    }
  }

  function openFilePicker() {
    fileInputRef.current?.click()
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      <BlogEditorToolbar editor={editor} onImageUpload={openFilePicker} />
      <EditorContent editor={editor} />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleImageFile(file)
          e.target.value = ""
        }}
      />
    </div>
  )
}
