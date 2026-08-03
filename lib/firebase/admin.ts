import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  type App,
  type ServiceAccount,
} from "firebase-admin/app"
import { getAuth, type Auth, type DecodedIdToken } from "firebase-admin/auth"
import { getMessaging, type Messaging } from "firebase-admin/messaging"

type ServiceAccountJson = {
  project_id?: unknown
  projectId?: unknown
  client_email?: unknown
  clientEmail?: unknown
  private_key?: unknown
  privateKey?: unknown
}

const readString = (value: unknown): string =>
  typeof value === "string" ? value.trim() : ""

const normalizePrivateKey = (value: string): string =>
  value.replace(/\\n/g, "\n")

const readServiceAccountJson = (value: string): ServiceAccount => {
  const parsed = JSON.parse(value) as ServiceAccountJson
  const projectId = readString(parsed.projectId) || readString(parsed.project_id)
  const clientEmail =
    readString(parsed.clientEmail) || readString(parsed.client_email)
  const privateKey = normalizePrivateKey(
    readString(parsed.privateKey) || readString(parsed.private_key),
  )

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Firebase service account JSON is incomplete")
  }

  return { projectId, clientEmail, privateKey }
}

const getServiceAccount = (): ServiceAccount | null => {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()
  if (serviceAccountJson) {
    return readServiceAccountJson(serviceAccountJson)
  }

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim()
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim()
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.trim()

  if (!projectId || !clientEmail || !privateKey) {
    return null
  }

  return {
    projectId,
    clientEmail,
    privateKey: normalizePrivateKey(privateKey),
  }
}

const getFirebaseAdminApp = (): App => {
  const existingApp = getApps()[0]
  if (existingApp) {
    return existingApp
  }

  const serviceAccount = getServiceAccount()
  const projectId =
    serviceAccount?.projectId ?? process.env.FIREBASE_PROJECT_ID?.trim()

  return initializeApp({
    credential: serviceAccount ? cert(serviceAccount) : applicationDefault(),
    ...(projectId ? { projectId } : {}),
  })
}

export async function verifyFirebaseIdToken(
  firebaseIdToken: string,
): Promise<DecodedIdToken> {
  try {
    return await getAuth(getFirebaseAdminApp()).verifyIdToken(firebaseIdToken)
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : ""

    if (code.startsWith("auth/")) {
      throw new Error("Invalid Firebase ID token")
    }

    console.error("Firebase ID token verification failed", error)
    throw new Error("Firebase authentication is unavailable")
  }
}

export function getFirebaseMessaging(): Messaging {
  return getMessaging(getFirebaseAdminApp())
}

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseAdminApp())
}
