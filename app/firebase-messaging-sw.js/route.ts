import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export function GET() {
  const script = `
importScripts("https://www.gstatic.com/firebasejs/12.15.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.15.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: ${JSON.stringify(process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "")},
  authDomain: ${JSON.stringify(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "")},
  projectId: ${JSON.stringify(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? process.env.FIREBASE_PROJECT_ID ?? "")},
  storageBucket: ${JSON.stringify(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "")},
  messagingSenderId: ${JSON.stringify(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "")},
  appId: ${JSON.stringify(process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "")}
});

const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  const notification = payload.notification || {};
  const data = payload.data || {};
  self.registration.showNotification(notification.title || "AutoParts Pro", {
    body: notification.body || "You have a new notification.",
    data: { linkUrl: data.linkUrl || "/" }
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const linkUrl = event.notification.data?.linkUrl || "/";
  event.waitUntil(clients.openWindow(linkUrl));
});
`
  return new NextResponse(script, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "no-store",
    },
  })
}
