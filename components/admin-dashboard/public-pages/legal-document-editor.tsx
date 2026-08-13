"use client"

import { useEffect, useState } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { getPublicPage } from "@/services/admin-dashboard/public-pages/public-pages-data"
import { saveLegalDocumentContent } from "@/actions/admin-dashboard/public-pages/public-content"
import { LEGAL_CONTENT_FALLBACK_TEXT } from "@/services/admin-dashboard/public-pages/legal-content-fallback"
import { SeoPanel } from "@/components/admin-dashboard/public-pages/seo-panel"
import type { LegalDocumentEditorProps } from "@/types/admin-dashboard/public-pages/legal-document-editor"

const TOOLBAR_BUTTON =
  "h-8 rounded-md border border-[#2A2A2A] px-2 text-xs font-medium text-[#9CA3AF] transition hover:bg-[#1A1A1A] hover:text-white"
const ACTIVE_TOOLBAR_BUTTON =
  "border-[#DC2626] bg-[#DC2626]/15 text-white"

export function LegalDocumentEditor({
  slug,
  initialContent,
  initialSeo,
}: LegalDocumentEditorProps) {
  const page = getPublicPage(slug)
  const fallbackContent = LEGAL_CONTENT_FALLBACK_TEXT[slug]
  const [activeTab, setActiveTab] = useState<"content" | "seo">("content")
  const [statusMessage, setStatusMessage] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const editorInitialContent = initialContent ?? fallbackContent

  const editor = useEditor({
    extensions: [StarterKit],
    content: editorInitialContent,
    immediatelyRender: true,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-[300px] rounded-md border border-[#2A2A2A] bg-[#0A0A0A] p-4 text-[#E5E7EB] outline-none focus:ring-0 [&_p]:my-2 [&_h1]:mt-4 [&_h1]:text-2xl [&_h2]:mt-4 [&_h2]:text-lg [&_h3]:mt-4 [&_h3]:text-base [&_ul]:pl-5 [&_ol]:pl-5 [&_li]:mt-1",
      },
    },
  })

  useEffect(() => {
    if (typeof window === "undefined" || !editor) {
      return
    }

    editor.commands.setContent(editorInitialContent)
  }, [editor, editorInitialContent])

  const onSave = async () => {
    if (!editor) {
      return
    }

    try {
      setIsSaving(true)
      setStatusMessage("Publishing...")
      const value = editor.getHTML()
      const result = await saveLegalDocumentContent({
        slug,
        content: value,
      })
      if (!result.ok) {
        const errorMessage = result.error || "Failed to save legal document."
        setStatusMessage(errorMessage)
        toast.error(errorMessage)
        return
      }
      setStatusMessage(`Saved at ${new Date().toLocaleTimeString()}`)
      toast.success("Legal document saved.")
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to save legal document. Please try again."
      setStatusMessage(errorMessage)
      toast.error(errorMessage)
    } finally {
      setIsSaving(false)
    }
  }

  if (!page) {
    return <div className="text-white">Page not found.</div>
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">{page.title}</h1>
        <p className="mt-2 max-w-3xl text-sm text-[#9CA3AF]">
          Edit and update this policy page directly and save changes with one action.
        </p>
      </div>

      <div className="flex gap-2 rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] p-2">
        <button
          type="button"
          onClick={() => setActiveTab("content")}
          className={cn(
            "rounded-md px-4 py-2 text-sm font-medium transition",
            activeTab === "content"
              ? "bg-[#DC2626] text-white"
              : "text-[#9CA3AF] hover:bg-[#1A1A1A] hover:text-white",
          )}
        >
          Content
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("seo")}
          className={cn(
            "rounded-md px-4 py-2 text-sm font-medium transition",
            activeTab === "seo"
              ? "bg-[#DC2626] text-white"
              : "text-[#9CA3AF] hover:bg-[#1A1A1A] hover:text-white",
          )}
        >
          SEO
        </button>
      </div>

      {activeTab === "seo" ? (
        <SeoPanel slug={slug} initialSeo={initialSeo} />
      ) : (
        <Card className="rounded-lg border-[#2A2A2A] bg-[#1A1A1A]">
        <CardHeader>
          <CardTitle className="text-white">{page.title} Editor</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={cn(
                TOOLBAR_BUTTON,
                editor?.isActive("bold") ? ACTIVE_TOOLBAR_BUTTON : ""
              )}
              onClick={() => editor?.chain().focus().toggleBold().run()}
              disabled={!editor}
            >
              B
            </button>
            <button
              type="button"
              className={cn(
                TOOLBAR_BUTTON,
                editor?.isActive("italic") ? ACTIVE_TOOLBAR_BUTTON : ""
              )}
              onClick={() => editor?.chain().focus().toggleItalic().run()}
              disabled={!editor}
            >
              I
            </button>
            <button
              type="button"
              className={cn(
                TOOLBAR_BUTTON,
                editor?.isActive("strike") ? ACTIVE_TOOLBAR_BUTTON : ""
              )}
              onClick={() => editor?.chain().focus().toggleStrike().run()}
              disabled={!editor}
            >
              S
            </button>
            <button
              type="button"
              className={cn(
                TOOLBAR_BUTTON,
                editor?.isActive("code") ? ACTIVE_TOOLBAR_BUTTON : ""
              )}
              onClick={() => editor?.chain().focus().toggleCode().run()}
              disabled={!editor}
            >
              Code
            </button>

            <span className="mx-1 h-4 w-px bg-[#2A2A2A]" />

            <button
              type="button"
              className={cn(
                TOOLBAR_BUTTON,
                editor?.isActive("heading", { level: 1 }) ? ACTIVE_TOOLBAR_BUTTON : ""
              )}
              onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
              disabled={!editor}
            >
              H1
            </button>
            <button
              type="button"
              className={cn(
                TOOLBAR_BUTTON,
                editor?.isActive("heading", { level: 2 }) ? ACTIVE_TOOLBAR_BUTTON : ""
              )}
              onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
              disabled={!editor}
            >
              H2
            </button>
            <button
              type="button"
              className={cn(
                TOOLBAR_BUTTON,
                editor?.isActive("heading", { level: 3 }) ? ACTIVE_TOOLBAR_BUTTON : ""
              )}
              onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
              disabled={!editor}
            >
              H3
            </button>
            <button
              type="button"
              className={cn(
                TOOLBAR_BUTTON,
                editor?.isActive("paragraph") ? ACTIVE_TOOLBAR_BUTTON : ""
              )}
              onClick={() => editor?.chain().focus().setParagraph().run()}
              disabled={!editor}
            >
              P
            </button>

            <span className="mx-1 h-4 w-px bg-[#2A2A2A]" />

            <button
              type="button"
              className={cn(
                TOOLBAR_BUTTON,
                editor?.isActive("blockquote") ? ACTIVE_TOOLBAR_BUTTON : ""
              )}
              onClick={() => editor?.chain().focus().toggleBlockquote().run()}
              disabled={!editor}
            >
              Quote
            </button>
            <button
              type="button"
              className={cn(
                TOOLBAR_BUTTON,
                editor?.isActive("bulletList") ? ACTIVE_TOOLBAR_BUTTON : ""
              )}
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
              disabled={!editor}
            >
              • List
            </button>
            <button
              type="button"
              className={cn(
                TOOLBAR_BUTTON,
                editor?.isActive("orderedList") ? ACTIVE_TOOLBAR_BUTTON : ""
              )}
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
              disabled={!editor}
            >
              1. List
            </button>

            <span className="mx-1 h-4 w-px bg-[#2A2A2A]" />

            <button
              type="button"
              className={TOOLBAR_BUTTON}
              onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
              disabled={!editor}
            >
              Code Block
            </button>
            <button
              type="button"
              className={TOOLBAR_BUTTON}
              onClick={() => editor?.chain().focus().setHorizontalRule().run()}
              disabled={!editor}
            >
              HR
            </button>
            <button
              type="button"
              className={TOOLBAR_BUTTON}
              onClick={() => editor?.chain().focus().setHardBreak().run()}
              disabled={!editor}
            >
              Break
            </button>
            <button
              type="button"
              className={TOOLBAR_BUTTON}
              onClick={() =>
                editor
                  ?.chain()
                  .focus()
                  .clearNodes()
                  .unsetAllMarks()
                  .run()
              }
              disabled={!editor}
            >
              Clear
            </button>

            <span className="mx-1 h-4 w-px bg-[#2A2A2A]" />

            <button
              type="button"
              className={TOOLBAR_BUTTON}
              onClick={() => editor?.chain().focus().undo().run()}
              disabled={!editor}
            >
              Undo
            </button>
            <button
              type="button"
              className={TOOLBAR_BUTTON}
              onClick={() => editor?.chain().focus().redo().run()}
              disabled={!editor}
            >
              Redo
            </button>
          </div>

          {editor ? <EditorContent editor={editor} /> : <div className="h-72" />}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              onClick={onSave}
              disabled={!editor || isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Publishing...
                </>
              ) : (
                "Publish"
              )}
            </Button>
            <span className="text-xs text-[#9CA3AF]">
              {isSaving ? "Publishing..." : statusMessage || "Ready to publish"}
            </span>
          </div>
        </CardContent>
        </Card>
      )}
    </section>
  )
}
