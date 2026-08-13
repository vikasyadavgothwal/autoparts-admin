"use client"

import { FormEvent, useState } from "react"
import { toast } from "sonner"
import { Film, HelpCircle, Info, Pencil, PlayCircle, Save, Trash2, UploadCloud, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

type SupportVideo = { id: string; accountType: string; supportTier: string; title: string; description: string | null; videoUrl: string; storedVideoUrl?: string; sortOrder: number; isActive: boolean }
type SupportFaq = { id: string; accountType: string; supportTier: string; question: string; answer: string; sortOrder: number; isActive: boolean }
type EditingContent = { kind: "video"; item: SupportVideo } | { kind: "faq"; item: SupportFaq }
type PendingDelete = { kind: "video" | "faq"; id: string; title: string }

type Props = { supportContent: { videos: SupportVideo[]; faqs: SupportFaq[] } }

const accountTypes = ["Garage", "Fleet", "Supplier"]
const allowedVideoTypes = ["video/mp4", "video/webm", "video/quicktime"]
const maxVideoSize = 250 * 1024 * 1024
const faqQuestionMinWords = 3
const faqQuestionMaxWords = 40
const faqAnswerMinWords = 6
const faqAnswerMaxWords = 250

const wordCount = (value: string) => value.trim().split(/\s+/).filter(Boolean).length

function validHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

const isDirectVideoUrl = (url: string) => /\.(mp4|webm|mov)(\?|#|$)/i.test(url) || url.includes("business-support/videos/")
const youtubeThumbnailUrl = (value: string): string | null => {
  try {
    const url = new URL(value)
    const host = url.hostname.replace(/^www\./, "").toLowerCase()
    let videoId = ""

    if (host === "youtu.be") {
      videoId = url.pathname.split("/").filter(Boolean)[0] ?? ""
    } else if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
      const [first, second] = url.pathname.split("/").filter(Boolean)
      videoId = first === "embed" || first === "shorts" || first === "live" ? second ?? "" : url.searchParams.get("v") ?? ""
    }

    return /^[A-Za-z0-9_-]{11}$/.test(videoId) ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null
  } catch {
    return null
  }
}
const autoplayVideoUrl = (url: string) => {
  try {
    const parsed = new URL(url)
    parsed.searchParams.set("autoplay", "1")
    return parsed.toString()
  } catch {
    return url
  }
}
const youtubeEmbedUrl = (value: string): string | null => {
  try {
    const url = new URL(value)
    const host = url.hostname.replace(/^www\./, "").toLowerCase()
    let videoId = ""

    if (host === "youtu.be") {
      videoId = url.pathname.split("/").filter(Boolean)[0] ?? ""
    } else if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
      const [first, second] = url.pathname.split("/").filter(Boolean)
      videoId = first === "embed" || first === "shorts" || first === "live" ? second ?? "" : url.searchParams.get("v") ?? ""
    }

    return /^[A-Za-z0-9_-]{11}$/.test(videoId) ? `https://www.youtube.com/embed/${videoId}` : null
  } catch {
    return null
  }
}

function validateForm(kind: "video" | "faq", formData: FormData) {
  const accountType = String(formData.get("accountType") ?? "").trim()
  const isEditing = Boolean(String(formData.get("id") ?? "").trim())
  const hasExistingVideo = Boolean(String(formData.get("existingVideoUrl") ?? "").trim())

  if (!accountTypes.includes(accountType)) return "Select a valid dashboard."

  if (kind === "video") {
    const title = String(formData.get("title") ?? "").trim()
    const videoUrl = String(formData.get("videoUrl") ?? "").trim()
    const videoFile = formData.get("videoFile")
    const hasFile = videoFile instanceof File && videoFile.size > 0

    if (title.length < 2 || title.length > 160) return "Video title must be 2 to 160 characters."
    if (!videoUrl && !hasFile && !(isEditing && hasExistingVideo)) return "Add a video URL or upload a video file."
    if (videoUrl && hasFile) return "Use either a video URL or an uploaded video file, not both."
    if (videoUrl && !validHttpUrl(videoUrl)) return "Video URL must be a valid http or https URL."
    if (videoUrl && !youtubeEmbedUrl(videoUrl)) return "Video URL must be a valid YouTube link."
    if (hasFile && !allowedVideoTypes.includes(videoFile.type)) return "Upload only MP4, WebM, or MOV video files."
    if (hasFile && videoFile.size > maxVideoSize) return "Video file must be 250 MB or smaller."
  } else {
    const question = String(formData.get("question") ?? "").trim()
    const answer = String(formData.get("answer") ?? "").trim()
    const questionWords = wordCount(question)
    const answerWords = wordCount(answer)
    if (!question) return "FAQ question is required."
    if (question.length < 5) return "FAQ question must be at least 5 characters."
    if (question.length > 300) return "FAQ question must be 300 characters or fewer."
    if (questionWords < faqQuestionMinWords) return `FAQ question must be at least ${faqQuestionMinWords} words.`
    if (questionWords > faqQuestionMaxWords) return `FAQ question must be ${faqQuestionMaxWords} words or fewer.`
    if (!answer) return "FAQ answer is required."
    if (answer.length < 10) return "FAQ answer must be at least 10 characters."
    if (answer.length > 2000) return "FAQ answer must be 2000 characters or fewer."
    if (answerWords < faqAnswerMinWords) return `FAQ answer must be at least ${faqAnswerMinWords} words.`
    if (answerWords > faqAnswerMaxWords) return `FAQ answer must be ${faqAnswerMaxWords} words or fewer.`
  }

  return null
}

async function readApiResponse<T>(response: Response) {
  const contentType = response.headers.get("content-type") ?? ""
  if (contentType.includes("application/json")) {
    return (await response.json().catch(() => null)) as T | null
  }

  const text = await response.text().catch(() => "")
  return { message: text && !text.trim().startsWith("<") ? text : `Request failed with status ${response.status}.` } as T
}

export function BusinessSupportContentManager({ supportContent }: Props) {
  const [kind, setKind] = useState<"video" | "faq">("video")
  const [selectedAccountType, setSelectedAccountType] = useState(accountTypes[0])
  const [items, setItems] = useState(supportContent)
  const [isSaving, setIsSaving] = useState(false)
  const [editing, setEditing] = useState<EditingContent | null>(null)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const [selectedVideo, setSelectedVideo] = useState<SupportVideo | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [formKey, setFormKey] = useState(0)

  const editingVideo = editing?.kind === "video" && kind === "video" ? editing.item : null
  const editingFaq = editing?.kind === "faq" && kind === "faq" ? editing.item : null
  const editingVideoIsUpload = editingVideo ? isDirectVideoUrl(editingVideo.videoUrl) : false
  const selectedVideos = items.videos.filter((item) => item.accountType === selectedAccountType)
  const selectedFaqs = items.faqs.filter((item) => item.accountType === selectedAccountType)

  function startEdit(nextEditing: EditingContent) {
    setKind(nextEditing.kind)
    setSelectedAccountType(nextEditing.item.accountType)
    setEditing(nextEditing)
    setFormKey((value) => value + 1)
  }

  function changeAccountType(value: string) {
    setSelectedAccountType(value)
    setEditing(null)
    setSelectedVideo(null)
    setFormKey((current) => current + 1)
  }

  function clearEdit() {
    setEditing(null)
    setFormKey((value) => value + 1)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const validationError = validateForm(kind, formData)
    if (validationError) {
      toast.error(validationError)
      return
    }

    const accountType = String(formData.get("accountType") ?? "Garage")
    const editingId = String(formData.get("id") ?? "").trim()
    let videoUrl = String(formData.get("videoUrl") ?? "").trim()
    const existingVideoUrl = String(formData.get("existingVideoUrl") ?? "").trim()
    const videoFile = formData.get("videoFile")

    setIsSaving(true)
    try {
      if (kind === "video" && videoFile instanceof File && videoFile.size > 0) {
        const uploadForm = new FormData()
        uploadForm.set("video", videoFile)
        uploadForm.set("accountType", accountType)
        const uploadResponse = await fetch("/api/v1/admin/business/support-content/upload", { method: "POST", body: uploadForm })
        const uploadResult = await readApiResponse<{ ok?: boolean; message?: string; video?: { url?: string } }>(uploadResponse)
        if (!uploadResponse.ok || !uploadResult?.ok) throw new Error(uploadResult?.message ?? "Unable to upload support video.")
        if (!uploadResult.video?.url) throw new Error("Upload finished but no video URL was returned.")
        videoUrl = uploadResult.video.url
      } else if (kind === "video" && videoUrl) {
        videoUrl = youtubeEmbedUrl(videoUrl) ?? videoUrl
      } else if (kind === "video" && existingVideoUrl) {
        videoUrl = existingVideoUrl
      }

      const payload = {
        kind,
        id: editingId || undefined,
        accountType,
        title: String(formData.get("title") ?? ""),
        videoUrl,
        question: String(formData.get("question") ?? ""),
        answer: String(formData.get("answer") ?? ""),
        sortOrder: 0,
        isActive: true,
      }
      const response = await fetch("/api/v1/admin/business/support-content", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      })
      const result = await readApiResponse<{ ok?: boolean; message?: string; supportContent?: { video?: SupportVideo; faq?: SupportFaq } }>(response)
      if (!response.ok || !result?.ok) throw new Error(result?.message ?? "Unable to save support content.")
      if (result.supportContent?.video) {
        setItems((current) => ({
          ...current,
          videos: editingId
            ? current.videos.map((item) => item.id === editingId ? result.supportContent!.video! : item)
            : [result.supportContent!.video!, ...current.videos],
        }))
      }
      if (result.supportContent?.faq) setItems((current) => ({
        ...current,
        faqs: editingId
          ? current.faqs.map((item) => item.id === editingId ? result.supportContent!.faq! : item)
          : [result.supportContent!.faq!, ...current.faqs],
      }))
      toast.success(kind === "video" ? "Support video saved successfully." : "Support FAQ saved successfully.")
      setEditing(null)
      form.reset()
      setFormKey((value) => value + 1)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save support content.")
    } finally {
      setIsSaving(false)
    }
  }

  async function deleteContent() {
    if (!pendingDelete) return
    setIsDeleting(true)
    try {
      const response = await fetch("/api/v1/admin/business/support-content", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: pendingDelete.kind, id: pendingDelete.id }),
      })
      const result = await readApiResponse<{ ok?: boolean; message?: string; deleted?: { kind: "video" | "faq"; id: string } }>(response)
      if (!response.ok || !result?.ok || !result.deleted) throw new Error(result?.message ?? "Unable to delete support content.")
      setItems((current) => result.deleted!.kind === "video"
        ? { ...current, videos: current.videos.filter((item) => item.id !== result.deleted!.id) }
        : { ...current, faqs: current.faqs.filter((item) => item.id !== result.deleted!.id) })
      if (editing && editing.item.id === result.deleted.id) clearEdit()
      if (selectedVideo?.id === result.deleted.id) setSelectedVideo(null)
      setPendingDelete(null)
      toast.success("Support content deleted.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete support content.")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <section className="space-y-5 rounded-xl border border-[#2A2A2A] bg-[#101010] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
      <div className="flex flex-col gap-4 border-b border-[#2A2A2A] pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#DC2626]">Support academy</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Videos & FAQs</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[#9CA3AF]">Create support videos and FAQs per dashboard. Every plan sees the same Admin-managed content for its dashboard type.</p>
        </div>
        <div className="inline-flex rounded-lg border border-[#2A2A2A] bg-[#050505] p-1">
          <button type="button" onClick={() => setKind("video")} className={`rounded-md px-4 py-2 text-sm ${kind === "video" ? "bg-[#DC2626] text-white" : "text-[#9CA3AF]"}`}>Video</button>
          <button type="button" onClick={() => setKind("faq")} className={`rounded-md px-4 py-2 text-sm ${kind === "faq" ? "bg-[#DC2626] text-white" : "text-[#9CA3AF]"}`}>FAQ</button>
        </div>
      </div>

      <div className="rounded-lg border border-[#2A2A2A] bg-[#050505] p-4">
        <label className="space-y-1 text-xs font-medium text-[#9CA3AF]">Dashboard &nbsp; &nbsp;
          <select value={selectedAccountType} onChange={(event) => changeAccountType(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-[#2A2A2A] bg-[#050505] px-3 text-sm text-white md:max-w-xs">
            {accountTypes.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <p className="mt-2 text-xs text-[#6B7280]">Only {selectedAccountType} videos and FAQs are shown here. New content is added to {selectedAccountType} only.</p>
      </div>

      {/* <div className="grid gap-3 rounded-lg border border-[#2A2A2A] bg-[#050505] p-4 text-sm text-[#D1D5DB] lg:grid-cols-3">
        <div className="flex gap-3"><UploadCloud className="mt-0.5 h-4 w-4 text-[#DC2626]" /><p><strong className="text-white">Upload video:</strong> MP4, WebM, or MOV is uploaded to S3. The generated S3 URL is stored in the database.</p></div>
        <div className="flex gap-3"><Info className="mt-0.5 h-4 w-4 text-[#DC2626]" /><p><strong className="text-white">Paste URL:</strong> YouTube watch, short, live, embed, or youtu.be links are accepted and shown as embeds.</p></div>
        <div className="flex gap-3"><HelpCircle className="mt-0.5 h-4 w-4 text-[#DC2626]" /><p><strong className="text-white">Visibility:</strong> FAQ and videos are common for all plans. Choose only the dashboard type.</p></div>
      </div> */}

      <form key={formKey} onSubmit={submit} className="grid gap-3 rounded-lg border border-[#2A2A2A] bg-[#050505] p-4 md:grid-cols-2">
        <input type="hidden" name="id" defaultValue={editing?.kind === kind ? editing.item.id : ""} />
        <input type="hidden" name="accountType" value={selectedAccountType} readOnly />
        <input type="hidden" name="existingVideoUrl" defaultValue={editingVideo?.storedVideoUrl ?? editingVideo?.videoUrl ?? ""} />
        <div className="flex items-end justify-between gap-3 md:col-span-2">
          <p className="text-sm font-semibold text-white">{editing?.kind === kind ? `Edit ${kind}` : `Add ${kind}`}</p>
          {editing?.kind === kind ? <Button type="button" variant="outline" size="sm" onClick={clearEdit} className="gap-1"><X className="h-3.5 w-3.5" />Cancel edit</Button> : null}
        </div>
        <div className="rounded-md border border-[#2A2A2A] bg-[#101010] px-3 py-2 text-sm text-[#D1D5DB]">
          <p className="text-xs font-medium text-[#9CA3AF]">Dashboard</p>
          <p className="mt-1 font-medium text-white">{selectedAccountType}</p>
        </div>
        {kind === "video" ? <>
          <label className="space-y-1 text-xs font-medium text-[#9CA3AF]">Video title<Input name="title" minLength={2} maxLength={160} required defaultValue={editingVideo?.title ?? ""} className="bg-[#050505]" /></label>
          <label className="space-y-1 text-xs font-medium text-[#9CA3AF]">YouTube URL<Input name="videoUrl" type="url" defaultValue={editingVideo && !editingVideoIsUpload ? editingVideo.videoUrl : ""} placeholder={editingVideoIsUpload ? "Leave blank to keep uploaded video" : "https://youtube.com/watch?v=..."} className="bg-[#050505]" /></label>
          <label className="space-y-1 text-xs font-medium text-[#9CA3AF] md:col-span-2">Upload video file<input name="videoFile" type="file" accept="video/mp4,video/webm,video/quicktime" className="block w-full rounded-md border border-[#2A2A2A] bg-[#050505] px-3 py-2 text-sm text-white file:mr-3 file:rounded-md file:border-0 file:bg-[#DC2626] file:px-3 file:py-1.5 file:text-sm file:text-white" /><span className="block text-[11px] font-normal text-[#6B7280]">{editingVideo ? "Leave URL and upload empty to keep the current video." : "Use either a YouTube URL or upload. Saving adds a new video for this dashboard."}</span></label>
        </> : <>
          <label className="space-y-1 text-xs font-medium text-[#9CA3AF] md:col-span-2">Question<Input name="question" minLength={5} maxLength={300} required defaultValue={editingFaq?.question ?? ""} className="bg-[#050505]" /><span className="block text-[11px] font-normal text-[#6B7280]">Required, 5-300 characters, {faqQuestionMinWords}-{faqQuestionMaxWords} words.</span></label>
          <label className="space-y-1 text-xs font-medium text-[#9CA3AF] md:col-span-2">Answer<textarea name="answer" minLength={10} maxLength={2000} required defaultValue={editingFaq?.answer ?? ""} className="min-h-24 w-full rounded-md border border-[#2A2A2A] bg-[#050505] px-3 py-2 text-sm text-white" /><span className="block text-[11px] font-normal text-[#6B7280]">Required, 10-2000 characters, {faqAnswerMinWords}-{faqAnswerMaxWords} words.</span></label>
        </>}
        <div className="flex items-end"><Button disabled={isSaving} className="gap-2"><Save className="h-4 w-4" />{isSaving ? "Saving..." : editing?.kind === kind ? "Update content" : "Save content"}</Button></div>
      </form>

      {kind === "video" ? (
        <div className="rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white"><Film className="h-4 w-4 text-[#DC2626]" />Videos</h3>
          {selectedVideos.length ? <>
            <div className="mt-3 grid gap-4 lg:grid-cols-3">
              {selectedVideos.map((item) => {
                const thumbnail = youtubeThumbnailUrl(item.videoUrl)
                return (
                  <article key={item.id} className="overflow-hidden rounded-lg border border-[#2A2A2A] bg-[#050505] text-sm text-[#D1D5DB] shadow-[0_12px_36px_rgba(0,0,0,0.2)]">
                    <div className="flex items-center justify-between gap-3 border-b border-[#2A2A2A] px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-white">{item.title}</p>
                        <p className="mt-0.5 text-xs text-[#9CA3AF]">{item.accountType}</p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button type="button" variant="outline" size="icon-sm" onClick={() => startEdit({ kind: "video", item })} aria-label={`Edit ${item.title}`}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button type="button" variant="destructive" size="icon-sm" onClick={() => setPendingDelete({ kind: "video", id: item.id, title: item.title })} aria-label={`Delete ${item.title}`}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                    <button type="button" onClick={() => setSelectedVideo(item)} className="group relative block aspect-video w-full overflow-hidden bg-black text-left">
                      {thumbnail ? (
                        <span className="block h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${thumbnail})` }} aria-hidden="true" />
                      ) : (
                        <video src={item.videoUrl} className="h-full w-full object-cover" muted preload="metadata" playsInline aria-hidden="true" />
                      )}
                      <span className="absolute inset-0 flex items-center justify-center bg-black/35 transition group-hover:bg-black/20">
                        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#DC2626] text-white shadow-lg">
                          <PlayCircle className="h-7 w-7" />
                        </span>
                      </span>
                      <span className="sr-only">Play {item.title}</span>
                    </button>
                  </article>
                )
              })}
            </div>
          </> : <p className="mt-3 rounded-lg border border-dashed border-[#2A2A2A] p-4 text-sm text-[#9CA3AF]">No videos added for {selectedAccountType} yet.</p>}
        </div>
      ) : (
        <div className="rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] p-4"><h3 className="flex items-center gap-2 text-sm font-semibold text-white"><HelpCircle className="h-4 w-4 text-[#DC2626]" />FAQs</h3><div className="mt-3 grid gap-3 lg:grid-cols-2">{selectedFaqs.map((item) => <div key={item.id} className="rounded-lg border border-[#2A2A2A] bg-[#050505] p-4 text-sm text-[#D1D5DB] shadow-[0_12px_36px_rgba(0,0,0,0.2)]"><div className="flex items-start justify-between gap-3"><div><p className="font-medium text-white">{item.question}</p><p className="mt-1 text-xs text-[#9CA3AF]">{item.accountType}</p></div><div className="flex shrink-0 gap-2"><Button type="button" variant="outline" size="icon-sm" onClick={() => startEdit({ kind: "faq", item })} aria-label={`Edit ${item.question}`}><Pencil className="h-3.5 w-3.5" /></Button><Button type="button" variant="destructive" size="icon-sm" onClick={() => setPendingDelete({ kind: "faq", id: item.id, title: item.question })} aria-label={`Delete ${item.question}`}><Trash2 className="h-3.5 w-3.5" /></Button></div></div><p className="mt-3 whitespace-pre-wrap text-xs leading-5 text-[#9CA3AF]">{item.answer}</p></div>)}{!selectedFaqs.length ? <p className="rounded-lg border border-dashed border-[#2A2A2A] p-4 text-sm text-[#9CA3AF]">No FAQs added for {selectedAccountType} yet.</p> : null}</div></div>
      )}
      <Dialog open={Boolean(selectedVideo)} onOpenChange={(open) => { if (!open) setSelectedVideo(null) }}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-4xl">
          <DialogHeader className="border-b border-[#2A2A2A] bg-[#050505] p-4 pr-12">
            <DialogTitle className="break-words">{selectedVideo?.title}</DialogTitle>
            <DialogDescription>Video tutorial</DialogDescription>
          </DialogHeader>
          {selectedVideo ? <div className="aspect-video bg-black">
            {isDirectVideoUrl(selectedVideo.videoUrl) ? (
              <video src={selectedVideo.videoUrl} className="h-full w-full" controls autoPlay preload="metadata" />
            ) : (
              <iframe src={autoplayVideoUrl(selectedVideo.videoUrl)} title={selectedVideo.title} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
            )}
          </div> : null}
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(pendingDelete)} onOpenChange={(open) => { if (!open) setPendingDelete(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete support content?</DialogTitle>
            <DialogDescription>{pendingDelete ? `This will delete "${pendingDelete.title}" from the ${pendingDelete.kind === "video" ? "videos" : "FAQs"} list.` : ""}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingDelete(null)} disabled={isDeleting}>Cancel</Button>
            <Button type="button" variant="destructive" onClick={deleteContent} disabled={isDeleting}>{isDeleting ? "Deleting..." : "Delete"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
