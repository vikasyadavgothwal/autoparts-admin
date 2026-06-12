import { Buffer } from "node:buffer"
import {
  GetObjectCommand,
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
  type ObjectCannedACL,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

type S3Credentials = {
  accessKeyId: string
  secretAccessKey: string
  sessionToken?: string
}

type S3StorageConfig = {
  bucket: string
  region: string
  credentials: S3Credentials
  publicBaseUrl?: string
  uploadAcl?: ObjectCannedACL
  forcePathStyle: boolean
  signedUrlExpiresIn: number
}

type S3PutObjectInput = {
  key: string
  body: Buffer
  contentType: string
  cacheControl?: string
}

type S3PutObjectResult = {
  key: string
  objectUrl: string
}

const DEFAULT_CACHE_CONTROL = "public, max-age=31536000, immutable"
const DEFAULT_SIGNED_URL_EXPIRES_IN = 60 * 60
const AWS_REGION_CODE_PATTERN = /[a-z]{2}(?:-gov)?-[a-z]+-\d/

let cachedConfig: S3StorageConfig | null = null
let cachedClient: S3Client | null = null

const getEnvValue = (...names: string[]): string | undefined => {
  for (const name of names) {
    const value = process.env[name]?.trim()
    if (value) {
      return value
    }
  }

  return undefined
}

const getBooleanEnvValue = (...names: string[]): boolean => {
  const value = getEnvValue(...names)
  return value === "1" || value?.toLowerCase() === "true"
}

const normalizeAwsRegion = (value: string): string | null => {
  const normalized = value.trim().toLowerCase()
  const regionCode = normalized.match(AWS_REGION_CODE_PATTERN)?.[0]

  return regionCode ?? null
}

const normalizeSignedUrlExpiry = (value: string | undefined): number => {
  if (!value) {
    return DEFAULT_SIGNED_URL_EXPIRES_IN
  }

  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_SIGNED_URL_EXPIRES_IN
  }

  return Math.min(parsed, 60 * 60 * 24 * 7)
}

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, "")

const encodeRfc3986 = (value: string): string =>
  encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  )

const encodeS3Path = (path: string): string =>
  path
    .split("/")
    .filter(Boolean)
    .map(encodeRfc3986)
    .join("/")

const decodeS3Path = (path: string): string | null => {
  try {
    return path
      .split("/")
      .filter(Boolean)
      .map((part) => decodeURIComponent(part))
      .join("/")
  } catch {
    return null
  }
}

const getS3StorageConfig = (): S3StorageConfig => {
  if (cachedConfig) {
    return cachedConfig
  }

  const bucket = getEnvValue(
    "AWS_S3_BUCKET",
    "AWS_S3_BUCKET_NAME",
    "S3_BUCKET",
    "S3_BUCKET_NAME",
  )
  const rawRegion = getEnvValue("AWS_REGION", "AWS_S3_REGION", "S3_REGION")
  const region = rawRegion ? normalizeAwsRegion(rawRegion) : null
  const accessKeyId = getEnvValue("AWS_ACCESS_KEY_ID", "S3_ACCESS_KEY_ID")
  const secretAccessKey = getEnvValue(
    "AWS_SECRET_ACCESS_KEY",
    "S3_SECRET_ACCESS_KEY",
  )
  const missing: string[] = []

  if (!bucket) {
    missing.push("AWS_S3_BUCKET")
  }

  if (!rawRegion) {
    missing.push("AWS_REGION")
  }

  if (!accessKeyId) {
    missing.push("AWS_ACCESS_KEY_ID")
  }

  if (!secretAccessKey) {
    missing.push("AWS_SECRET_ACCESS_KEY")
  }

  if (missing.length || !bucket || !rawRegion || !accessKeyId || !secretAccessKey) {
    throw new Error(`Missing S3 configuration: ${missing.join(", ")}`)
  }

  if (!region) {
    throw new Error(
      `Invalid AWS_REGION value "${rawRegion}". Use an AWS region code such as eu-north-1.`,
    )
  }

  cachedConfig = {
    bucket,
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
      sessionToken: getEnvValue("AWS_SESSION_TOKEN", "S3_SESSION_TOKEN"),
    },
    publicBaseUrl: getEnvValue("AWS_S3_PUBLIC_BASE_URL", "S3_PUBLIC_BASE_URL"),
    uploadAcl: getEnvValue("AWS_S3_UPLOAD_ACL", "S3_UPLOAD_ACL") as
      | ObjectCannedACL
      | undefined,
    forcePathStyle: getBooleanEnvValue(
      "AWS_S3_FORCE_PATH_STYLE",
      "S3_FORCE_PATH_STYLE",
    ),
    signedUrlExpiresIn: normalizeSignedUrlExpiry(
      getEnvValue(
        "AWS_S3_SIGNED_URL_EXPIRES_SECONDS",
        "S3_SIGNED_URL_EXPIRES_SECONDS",
      ),
    ),
  }

  return cachedConfig
}

const getS3Client = (): S3Client => {
  if (cachedClient) {
    return cachedClient
  }

  const config = getS3StorageConfig()
  cachedClient = new S3Client({
    region: config.region,
    credentials: config.credentials,
    forcePathStyle: config.forcePathStyle,
  })

  return cachedClient
}

const buildS3ObjectUrl = (key: string, config: S3StorageConfig): string => {
  const encodedKey = encodeS3Path(key)

  if (config.publicBaseUrl) {
    return `${trimTrailingSlash(config.publicBaseUrl)}/${encodedKey}`
  }

  if (config.forcePathStyle) {
    return `https://s3.${config.region}.amazonaws.com/${encodeRfc3986(config.bucket)}/${encodedKey}`
  }

  return `https://${config.bucket}.s3.${config.region}.amazonaws.com/${encodedKey}`
}

export const uploadObjectToS3 = async (
  input: S3PutObjectInput,
): Promise<S3PutObjectResult> => {
  const config = getS3StorageConfig()
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: input.key,
    Body: input.body,
    ContentType: input.contentType,
    CacheControl: input.cacheControl ?? DEFAULT_CACHE_CONTROL,
    ...(config.uploadAcl ? { ACL: config.uploadAcl } : {}),
  })

  await getS3Client().send(command)

  return {
    key: input.key,
    objectUrl: buildS3ObjectUrl(input.key, config),
  }
}

export const deleteObjectFromS3 = async (key: string): Promise<void> => {
  const config = getS3StorageConfig()
  const trimmedKey = key.trim()

  if (!trimmedKey) {
    return
  }

  const command = new DeleteObjectCommand({
    Bucket: config.bucket,
    Key: trimmedKey,
  })

  await getS3Client().send(command)
}

export const createSignedS3ObjectUrl = async (
  key: string,
  expiresIn?: number,
): Promise<string> => {
  const config = getS3StorageConfig()
  const command = new GetObjectCommand({
    Bucket: config.bucket,
    Key: key,
  })

  return getSignedUrl(getS3Client(), command, {
    expiresIn: expiresIn ?? config.signedUrlExpiresIn,
  })
}

export const getS3ObjectKeyFromUrl = (value: string): string | null => {
  const config = getS3StorageConfig()
  const trimmedValue = value.trim()

  if (!trimmedValue || trimmedValue.startsWith("blob:")) {
    return null
  }

  if (trimmedValue.startsWith("s3://")) {
    const s3Path = trimmedValue.replace(/^s3:\/\//, "")
    const [bucket, ...keyParts] = s3Path.split("/")

    if (bucket === config.bucket && keyParts.length) {
      return decodeS3Path(keyParts.join("/"))
    }

    return null
  }

  try {
    const url = new URL(trimmedValue)
    const pathKey = decodeS3Path(url.pathname)

    if (!pathKey) {
      return null
    }

    if (config.publicBaseUrl) {
      const publicBase = new URL(config.publicBaseUrl)

      if (url.host === publicBase.host) {
        const basePath = (decodeS3Path(publicBase.pathname) ?? "")
          .replace(/^\/+|\/+$/g, "")

        if (!basePath) {
          return pathKey
        }

        if (pathKey.startsWith(`${basePath}/`)) {
          return pathKey.slice(basePath.length + 1)
        }

        return null
      }
    }

    if (url.host === `${config.bucket}.s3.${config.region}.amazonaws.com`) {
      return pathKey
    }

    if (
      url.host === `s3.${config.region}.amazonaws.com` &&
      pathKey.startsWith(`${config.bucket}/`)
    ) {
      return pathKey.slice(config.bucket.length + 1)
    }
  } catch {
    return null
  }

  return null
}
