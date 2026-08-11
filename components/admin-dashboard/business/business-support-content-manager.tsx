"use client"

import { FormEvent, useState } from "react"
import { toast } from "sonner"
import { Film, HelpCircle, Info, Save, UploadCloud } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type SupportVideo = { id: string; accountType: string; supportTier: string; title: string; description: string | null; videoUrl: string; sortOrder: number; isActive: boolean }
type SupportFaq = { id: string; accountType: string; supportTier: string; question: string; answer: string; sortOrder: number; isActive: boolean }

type Props = { supportContent: { videos: SupportVideo[]; faqs: SupportFaq[] } }

const accountTypes = ["Garage", "Fleet", "Supplier"]
const supportTiers = ["Basic", "Standard", "Premium"]
const allowedVideoTypes = ["video/mp4", "video/webm", "video/quicktime"]
const maxVideoSize = 250 * 1024 * 1024

function validHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

function validateForm(kind: "video" | "faq", formData: FormData) {
  const accountType = String(formData.get("accountType") ?? "").trim()
  const supportTier = String(formData.get("supportTier") ?? "").trim()
  const sortOrder = Number(formData.get("sortOrder") ?? 0)

  if (!accountTypes.includes(accountType)) return "Select a valid dashboard."
  if (!supportTiers.includes(supportTier)) return "Select a valid support tier."
  if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 9999) return "Sort order must be a whole number between 0 and 9999."

  if (kind === "video") {
    const title = String(formData.get("title") ?? "").trim()
    const videoUrl = String(formData.get("videoUrl") ?? "").trim()
    const videoFile = formData.get("videoFile")
    const hasFile = videoFile instanceof File && videoFile.size > 0

    if (title.length < 2 || title.length > 160) return "Video title must be 2 to 160 characters."
    if (!videoUrl && !hasFile) return "Add a video URL or upload a video file."
    if (videoUrl && !validHttpUrl(videoUrl)) return "Video URL must be a valid http or https URL."
    if (hasFile && !allowedVideoTypes.includes(videoFile.type)) return "Upload only MP4, WebM, or MOV video files."
    if (hasFile && videoFile.size > maxVideoSize) return "Video file must be 250 MB or smaller."
  } else {
    const question = String(formData.get("question") ?? "").trim()
    const answer = String(formData.get("answer") ?? "").trim()
    if (question.length < 5 || question.length > 300) return "FAQ question must be 5 to 300 characters."
    if (answer.length < 10 || answer.length > 2000) return "FAQ answer must be 10 to 2000 characters."
  }

  return null
}

export function BusinessSupportContentManager({ supportContent }: Props) {
  const [kind, setKind] = useState<"video" | "faq">("video")
  const [items, setItems] = useState(supportContent)
  const [isSaving, setIsSaving] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const validationError = validateForm(kind, formData)
    if (validationError) {
      toast.error(validationError)
      return
    }

    const accountType = String(formData.get("accountType") ?? "Garage")
    const supportTier = String(formData.get("supportTier") ?? "Basic")
    let videoUrl = String(formData.get("videoUrl") ?? "").trim()
    const videoFile = formData.get("videoFile")

    setIsSaving(true)
    try {
      if (kind === "video" && videoFile instanceof File && videoFile.size > 0) {
        const uploadForm = new FormData()
        uploadForm.set("video", videoFile)
        uploadForm.set("accountType", accountType)
        uploadForm.set("supportTier", supportTier)
        const uploadResponse = await fetch("/api/v1/admin/business/support-content/upload", { method: "POST", body: uploadForm })
        const uploadResult = await uploadResponse.json().catch(() => null) as { ok?: boolean; message?: string; video?: { url?: string } } | null
        if (!uploadResponse.ok || !uploadResult?.ok || !uploadResult.video?.url) throw new Error(uploadResult?.message ?? "Unable to upload support video.")
        videoUrl = uploadResult.video.url
      }

      const payload = {
        kind,
        accountType,
        supportTier,
        title: String(formData.get("title") ?? ""),
        description: String(formData.get("description") ?? ""),
        videoUrl,
        question: String(formData.get("question") ?? ""),
        answer: String(formData.get("answer") ?? ""),
        sortOrder: Number(formData.get("sortOrder") ?? 0),
        isActive: true,
      }
      const response = await fetch("/api/v1/admin/business/support-content", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      })
      const result = await response.json().catch(() => null) as { ok?: boolean; message?: string; supportContent?: { video?: SupportVideo; faq?: SupportFaq } } | null
      if (!response.ok || !result?.ok) throw new Error(result?.message ?? "Unable to save support content.")
      if (result.supportContent?.video) setItems((current) => ({ ...current, videos: [result.supportContent!.video!, ...current.videos] }))
      if (result.supportContent?.faq) setItems((current) => ({ ...current, faqs: [result.supportContent!.faq!, ...current.faqs] }))
      toast.success(kind === "video" ? "Support video saved successfully." : "Support FAQ saved successfully.")
      event.currentTarget.reset()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save support content.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="space-y-5 rounded-xl border border-[#2A2A2A] bg-[#101010] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
      <div className="flex flex-col gap-4 border-b border-[#2A2A2A] pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#DC2626]">Support academy</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Videos & FAQs</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[#9CA3AF]">Create support videos and FAQs per dashboard and support tier. Dashboards only show content for their business type and current plan tier.</p>
        </div>
        <div className="inline-flex rounded-lg border border-[#2A2A2A] bg-[#050505] p-1">
          <button type="button" onClick={() => setKind("video")} className={`rounded-md px-4 py-2 text-sm ${kind === "video" ? "bg-[#DC2626] text-white" : "text-[#9CA3AF]"}`}>Video</button>
          <button type="button" onClick={() => setKind("faq")} className={`rounded-md px-4 py-2 text-sm ${kind === "faq" ? "bg-[#DC2626] text-white" : "text-[#9CA3AF]"}`}>FAQ</button>
        </div>
      </div>

      <div className="grid gap-3 rounded-lg border border-[#2A2A2A] bg-[#050505] p-4 text-sm text-[#D1D5DB] lg:grid-cols-3">
        <div className="flex gap-3"><UploadCloud className="mt-0.5 h-4 w-4 text-[#DC2626]" /><p><strong className="text-white">Upload video:</strong> MP4, WebM, or MOV is uploaded to S3. The generated S3 URL is stored in the database.</p></div>
        <div className="flex gap-3"><Info className="mt-0.5 h-4 w-4 text-[#DC2626]" /><p><strong className="text-white">Paste URL:</strong> HTTP/HTTPS links are stored directly. Use embed URLs for YouTube/Vimeo and direct URLs for MP4/WebM/MOV.</p></div>
        <div className="flex gap-3"><HelpCircle className="mt-0.5 h-4 w-4 text-[#DC2626]" /><p><strong className="text-white">Visibility:</strong> Basic sees Basic content, Standard sees Basic + Standard, Premium sees all support content.</p></div>
      </div>

      <form onSubmit={submit} className="grid gap-3 rounded-lg border border-[#2A2A2A] bg-[#050505] p-4 md:grid-cols-2">
        <label className="space-y-1 text-xs font-medium text-[#9CA3AF]">Dashboard<select name="accountType" className="h-10 w-full rounded-md border border-[#2A2A2A] bg-[#050505] px-3 text-sm text-white">{accountTypes.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="space-y-1 text-xs font-medium text-[#9CA3AF]">Support tier<select name="supportTier" className="h-10 w-full rounded-md border border-[#2A2A2A] bg-[#050505] px-3 text-sm text-white">{supportTiers.map((item) => <option key={item}>{item}</option>)}</select></label>
        {kind === "video" ? <>
          <label className="space-y-1 text-xs font-medium text-[#9CA3AF]">Video title<Input name="title" minLength={2} maxLength={160} required className="bg-[#050505]" /></label>
          <label className="space-y-1 text-xs font-medium text-[#9CA3AF]">Video URL<Input name="videoUrl" type="url" placeholder="https://... or upload file below" className="bg-[#050505]" /></label>
          <label className="space-y-1 text-xs font-medium text-[#9CA3AF] md:col-span-2">Upload video file<input name="videoFile" type="file" accept="video/mp4,video/webm,video/quicktime" className="block w-full rounded-md border border-[#2A2A2A] bg-[#050505] px-3 py-2 text-sm text-white file:mr-3 file:rounded-md file:border-0 file:bg-[#DC2626] file:px-3 file:py-1.5 file:text-sm file:text-white" /><span className="block text-[11px] font-normal text-[#6B7280]">Optional when URL is provided. If both are provided, uploaded S3 video is used.</span></label>
          <label className="space-y-1 text-xs font-medium text-[#9CA3AF] md:col-span-2">Description<Input name="description" maxLength={500} className="bg-[#050505]" /></label>
        </> : <>
          <label className="space-y-1 text-xs font-medium text-[#9CA3AF] md:col-span-2">Question<Input name="question" minLength={5} maxLength={300} required className="bg-[#050505]" /></label>
          <label className="space-y-1 text-xs font-medium text-[#9CA3AF] md:col-span-2">Answer<textarea name="answer" minLength={10} maxLength={2000} required className="min-h-24 w-full rounded-md border border-[#2A2A2A] bg-[#050505] px-3 py-2 text-sm text-white" /></label>
        </>}
        <label className="space-y-1 text-xs font-medium text-[#9CA3AF]">Sort order<Input name="sortOrder" type="number" min={0} max={9999} defaultValue={0} className="bg-[#050505]" /></label>
        <div className="flex items-end"><Button disabled={isSaving} className="gap-2"><Save className="h-4 w-4" />{isSaving ? "Saving..." : "Save content"}</Button></div>
      </form>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] p-4"><h3 className="flex items-center gap-2 text-sm font-semibold text-white"><Film className="h-4 w-4 text-[#DC2626]" />Videos</h3><div className="mt-3 grid gap-2">{items.videos.map((item) => <p key={item.id} className="rounded-md border border-[#2A2A2A] px-3 py-2 text-sm text-[#D1D5DB]">{item.accountType} · {item.supportTier} · {item.title}</p>)}</div></div>
        <div className="rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] p-4"><h3 className="flex items-center gap-2 text-sm font-semibold text-white"><HelpCircle className="h-4 w-4 text-[#DC2626]" />FAQs</h3><div className="mt-3 grid gap-2">{items.faqs.map((item) => <p key={item.id} className="rounded-md border border-[#2A2A2A] px-3 py-2 text-sm text-[#D1D5DB]">{item.accountType} · {item.supportTier} · {item.question}</p>)}</div></div>
      </div>
    </section>
  )
}
