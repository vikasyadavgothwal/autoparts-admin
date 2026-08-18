import crypto from "node:crypto"
import { NextRequest } from "next/server"

import type {
  VinSearchApiCallResult,
  VinSearchNormalizedResult,
  VinSearchNormalizedResultPayload,
  VinSearchParsedBodyResult,
  VinSearchQueryParamsResult,
  VinSearchRequestPayload,
  VinSearchRequestPayloadInput,
  VinSearchUpstreamJsonResult,
} from "@/types/vin-search/vin-search-api"
export const VIN_API_DEFAULT_BASE_URL = "https://api.17vin.com/vin"
const VIN_API_TIMEOUT_MS = 15_000

export const getVinSearchApiBaseUrl = (): string =>
  process.env.VIN_API_BASE_URL ?? VIN_API_DEFAULT_BASE_URL

const toUpperTrimmedString = (value: unknown): string | null =>
  typeof value === "string" ? value.trim().toUpperCase() : null

const normalizeUpstreamTextField = (
  value: unknown,
): string | null => {
  if (typeof value === "string" || typeof value === "number") {
    const normalized = String(value).trim()
    return normalized.length > 0 ? normalized : null
  }

  return null
}

const isVinSearchObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

const firstModelListItem = (value: unknown): Record<string, unknown> | null => {
  if (!Array.isArray(value)) return null
  const firstItem = value.find(isVinSearchObject)

  return firstItem ?? null
}

export const normalizeVinSearchResult = (
  upstreamResult: unknown,
): VinSearchNormalizedResult => {
  if (!isVinSearchObject(upstreamResult)) {
    return {
      ok: false,
      status: 500,
      error: "Invalid response from VIN API",
    }
  }

  const rawCode = upstreamResult.code
  const code =
    typeof rawCode === "number"
      ? rawCode
      : Number.parseInt(String(rawCode), 10)

  if (code === 1001) {
    return {
      ok: false,
      status: 400,
      error: "wrong ving",
    }
  }

  if (typeof upstreamResult.data !== "object" || upstreamResult.data == null) {
    return {
      ok: false,
      status: 400,
      error: "wrong ving",
    }
  }

  const data = upstreamResult.data as Record<string, unknown>
  const modelListItem = firstModelListItem(data.model_list)
  const modelId =
    normalizeUpstreamTextField(data.model_id) ||
    normalizeUpstreamTextField(data.modelId) ||
    normalizeUpstreamTextField(data.Id) ||
    normalizeUpstreamTextField(data.id) ||
    normalizeUpstreamTextField(data.vehicle_id) ||
    normalizeUpstreamTextField(modelListItem?.Id) ||
    normalizeUpstreamTextField(modelListItem?.id) ||
    normalizeUpstreamTextField(data.my_model_std_id) ||
    normalizeUpstreamTextField(data.epc_id) ||
    null
  const makeName =
    normalizeUpstreamTextField(modelListItem?.Series_en) ||
    normalizeUpstreamTextField(modelListItem?.Brand_en) ||
    normalizeUpstreamTextField(data.epc) ||
    ""
  const normalizedData: VinSearchNormalizedResultPayload = {
    VIN: normalizeUpstreamTextField(data.full_vin) || "",
    "Model year": normalizeUpstreamTextField(data.model_year_from_vin) || "",
    "Make name": makeName,
    ...(modelId ? { "Model id": modelId } : {}),
  }

  if (
    !normalizedData.VIN ||
    !normalizedData["Model year"] ||
    !normalizedData["Make name"]
  ) {
    return {
      ok: false,
      status: 400,
      error: "wrong ving",
    }
  }

  return {
    ok: true,
    status: 200,
    data: normalizedData,
  }
}

export const buildVinSearchToken = (
  username: string,
  password: string,
  urlParameters: string,
): string => {
  const userHash = crypto.createHash("md5").update(username).digest("hex")
  const passHash = crypto.createHash("md5").update(password).digest("hex")

  return crypto
    .createHash("md5")
    .update(`${userHash}${passHash}${urlParameters}`)
    .digest("hex")
}

export const buildVinSearchQueryParams = (
  vin: unknown,
  partNumber: unknown,
): VinSearchQueryParamsResult => {
  const normalizedVin = toUpperTrimmedString(vin)
  const normalizedPart =
    typeof partNumber === "string" ? partNumber.trim() : ""

  if (!normalizedVin && !normalizedPart) {
    return {
      ok: false,
      status: 400,
      payload: { error: "vin or partNumber is required" },
    }
  }

  const queryParams = new URLSearchParams()

  if (normalizedVin && normalizedPart) {
    queryParams.set("action", "search_part_number")
    queryParams.set("vin", normalizedVin)
    queryParams.set("query_part_number", normalizedPart)
  } else if (normalizedVin) {
    queryParams.set("vin", normalizedVin)
  } else {
    queryParams.set("action", "search_part_number")
    queryParams.set("query_part_number", normalizedPart)
  }

  return {
    ok: true,
    queryParams,
    queryString: queryParams.toString(),
  }
}

export const parseVinSearchBody = async (
  request: NextRequest,
): Promise<VinSearchParsedBodyResult> => {
  try {
    const body = (await request.json()) as VinSearchRequestPayloadInput | null

    if (!body || typeof body !== "object") {
      return { ok: false, status: 400, payload: { error: "Invalid JSON body" } }
    }

    const vin = typeof body.vin === "string" ? body.vin.trim() : ""
    const partNumber =
      typeof body.partNumber === "string" ? body.partNumber.trim() : null

    if (!vin && !partNumber) {
      return {
        ok: false,
        status: 400,
        payload: { error: "vin or partNumber is required" },
      }
    }

    const payload: VinSearchRequestPayload = {
      ...(vin ? { vin } : {}),
      ...(partNumber ? { partNumber } : {}),
    }

    return { ok: true, body: payload }
  } catch {
    return { ok: false, status: 400, payload: { error: "Invalid JSON payload" } }
  }
}

const parseJsonResponse = async (
  response: Response,
): Promise<VinSearchUpstreamJsonResult> => {
  try {
    const data = await response.json()
    return { ok: true, data }
  } catch {
    const text = await response.text()
    return {
      ok: false,
      data: {
        error: "17VIN API did not return valid JSON",
        rawResponse: text?.slice(0, 1200) ?? "",
      },
    }
  }
}

export const fetchVinSearchResult = async (
  vin: string | undefined,
  partNumber: string | undefined,
  credentials: { username: string; password: string },
  baseUrl: string,
): Promise<VinSearchApiCallResult> => {
  const queryBuildResult = buildVinSearchQueryParams(vin, partNumber)

  if (!queryBuildResult.ok) {
    return {
      ok: false,
      status: queryBuildResult.status,
      data: queryBuildResult.payload,
    }
  }

  const token = buildVinSearchToken(
    credentials.username,
    credentials.password,
    queryBuildResult.queryString,
  )
  queryBuildResult.queryParams.set("user", credentials.username)
  queryBuildResult.queryParams.set("token", token)
  const apiUrl = `${baseUrl}?${queryBuildResult.queryParams.toString()}`
  // Calls the third-party API from server-side (credentials never leave server).
  const response = await fetch(apiUrl, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(VIN_API_TIMEOUT_MS),
  })

  const parsedPayload = await parseJsonResponse(response)
  if (!parsedPayload.ok) {
    return { ok: false, status: 502, data: parsedPayload.data }
  }

  return { ok: true, status: response.status || 200, data: parsedPayload.data }
}
