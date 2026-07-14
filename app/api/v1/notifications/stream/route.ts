import { NextRequest } from "next/server"

import { getNotificationScopeFromRequest } from "@/lib/notifications/auth"
import { subscribeToNotifications } from "@/services/notifications/notification-events"
import {
  listNotifications,
  notificationScopeChannel,
} from "@/services/notifications/notification-service"

export const dynamic = "force-dynamic"

const encoder = new TextEncoder()

function sseMessage(event: string, data: unknown) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

export async function GET(request: NextRequest) {
  const auth = await getNotificationScopeFromRequest(request)
  if (!auth.ok) return auth.response

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false

      const send = (event: string, data: unknown) => {
        if (closed) return
        try {
          controller.enqueue(sseMessage(event, data))
        } catch {
          closed = true
        }
      }

      send("snapshot", { ok: true, ...(await listNotifications(auth.scope)) })

      const unsubscribe = subscribeToNotifications(
        notificationScopeChannel(auth.scope),
        (notification) => send("notification", { notification }),
      )

      const heartbeat = setInterval(() => {
        send("keepalive", { now: new Date().toISOString() })
      }, 25_000)

      const cleanup = () => {
        if (closed) return
        closed = true
        clearInterval(heartbeat)
        unsubscribe()
        try {
          controller.close()
        } catch {}
      }

      request.signal.addEventListener("abort", cleanup, { once: true })
    },
  })

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  })
}
