import {
  buildVinSearchToken,
  VIN_API_DEFAULT_BASE_URL,
} from "@/lib/vin-search"

const VIN17_TIMEOUT_MS = 15_000

export type Vin17PartCandidate = {
  sourcePartId: string | null
  partNumber: string | null
  partNumberOriginal: string | null
  brandName: string | null
  partName: string | null
  category: string | null
  groupId: string | null
  groupName: string | null
  imageUrl: string | null
  raw: unknown
}

export type Vin17VehicleCandidate = {
  vin17ModelId: string | null
  brand: string | null
  make: string | null
  model: string | null
  series: string | null
  modelYear: number | null
  yearFrom: number | null
  yearTo: number | null
  engine: string | null
  engineNo: string | null
  cc: string | null
  fuelType: string | null
  transmission: string | null
  bodyType: string | null
  dateBegin: string | null
  dateEnd: string | null
  raw: unknown
}

export type Vin17InterchangeResult = {
  part: Vin17PartCandidate | null
  oeInterchanges: Vin17PartCandidate[]
  factoryInterchanges: Vin17PartCandidate[]
}

const containsCjkText = (value: string) => /[\u3400-\u9fff]/u.test(value)

const sanitizeUpstreamMessage = (message: string | null): string | null => {
  if (!message) {
    return null
  }

  return containsCjkText(message) ? null : message
}

const knownVin17ErrorMessages: Record<
  number,
  { adminMessage: string; retryable: boolean }
> = {
  1006: {
    adminMessage:
      "17VIN could not route the brand lookup for this part number. Retry later or map the part manually.",
    retryable: true,
  },
}

const formatVin17AdminMessage = (
  code: number | null,
  upstreamMessage: string | null,
) => {
  if (code !== null) {
    const knownError = knownVin17ErrorMessages[code]
    if (knownError) {
      return knownError
    }
  }

  const safeUpstreamMessage = sanitizeUpstreamMessage(upstreamMessage)

  return {
    adminMessage: safeUpstreamMessage
      ? `17VIN API error${code !== null ? ` ${code}` : ""}: ${safeUpstreamMessage}`
      : `17VIN API error${code !== null ? ` ${code}` : ""}: Upstream request failed`,
    retryable: false,
  }
}

export class Vin17ApiError extends Error {
  code: number | null
  upstreamMessage: string | null
  retryable: boolean

  constructor(code: number | null, upstreamMessage: string | null) {
    const details = formatVin17AdminMessage(code, upstreamMessage)
    super(details.adminMessage)
    this.name = "Vin17ApiError"
    this.code = code
    this.upstreamMessage = upstreamMessage
    this.retryable = details.retryable
  }
}

const getVin17BaseUrl = () =>
  process.env.VIN17_BASE_URL?.trim() ||
  process.env.VIN_API_BASE_URL?.trim() ||
  VIN_API_DEFAULT_BASE_URL

const getVin17Credentials = () => {
  const username = process.env.VIN17_USER?.trim() || process.env.VIN_API_USER?.trim()
  const password =
    process.env.VIN17_PASSWORD?.trim() || process.env.VIN_API_PASS?.trim()

  if (!username || !password) {
    throw new Error("17VIN credentials are not configured")
  }

  return { username, password }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

const readString = (
  source: Record<string, unknown>,
  keys: string[],
): string | null => {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value)
    }
  }

  return null
}

const readInt = (
  source: Record<string, unknown>,
  keys: string[],
): number | null => {
  const value = readString(source, keys)
  if (!value) {
    return null
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? null : parsed
}

const findList = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) {
    return payload
  }

  if (!isObject(payload)) {
    return []
  }

  for (const key of ["data", "result", "results", "items", "list", "parts", "models"]) {
    const value = payload[key]
    const nested = findList(value)
    if (nested.length > 0) {
      return nested
    }
  }

  return []
}

const findListAtPath = (payload: unknown, path: string[]): unknown[] => {
  let current = payload

  for (const key of path) {
    if (!isObject(current)) {
      return []
    }
    current = current[key]
  }

  return Array.isArray(current) ? current : []
}

const findValueAtPath = (payload: unknown, path: string[]): unknown => {
  let current = payload

  for (const key of path) {
    if (!isObject(current)) {
      return null
    }
    current = current[key]
  }

  return current
}

const assert17VinBusinessSuccess = (payload: unknown) => {
  if (!isObject(payload) || !("code" in payload)) {
    return
  }

  const rawCode = payload.code
  const code =
    typeof rawCode === "number"
      ? rawCode
      : Number.parseInt(String(rawCode), 10)
  const message = readString(payload, ["msg", "message", "error"])
  const data = payload.data

  if (code >= 1000 || (message && data === "")) {
    throw new Vin17ApiError(Number.isFinite(code) ? code : null, message)
  }
}

const fetch17Vin = async (
  params: Record<string, string>,
): Promise<unknown> => {
  const credentials = getVin17Credentials()
  const queryParams = new URLSearchParams(params)
  const queryString = queryParams.toString()
  const apiUrl = new URL(getVin17BaseUrl())
  const requestPath = `${apiUrl.pathname || "/"}?${queryString}`
  const token = buildVinSearchToken(
    credentials.username,
    credentials.password,
    requestPath,
  )

  queryParams.set("user", credentials.username)
  queryParams.set("token", token)
  apiUrl.search = queryParams.toString()

  const response = await fetch(apiUrl, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(VIN17_TIMEOUT_MS),
  })

  const payload = await response.json().catch(async () => ({
    error: "17VIN API did not return valid JSON",
    rawResponse: (await response.text().catch(() => "")).slice(0, 1200),
  }))

  if (!response.ok) {
    throw new Error(`17VIN API failed with status ${response.status}`)
  }

  assert17VinBusinessSuccess(payload)

  return payload
}

const mapPartCandidate = (item: unknown): Vin17PartCandidate | null => {
  if (!isObject(item)) {
    return null
  }

  const partNumber = readString(item, [
    "Partnumber",
    "Part_number",
    "part_number",
    "partNumber",
    "number",
    "oem",
    "oem_number",
    "query_part_number",
  ])

  return {
    sourcePartId: readString(item, [
      "Part_id",
      "Epc_id",
      "id",
      "part_id",
      "partId",
      "uid",
    ]),
    partNumber,
    partNumberOriginal:
      readString(item, ["Part_number_original", "part_number_original"]) ??
      partNumber,
    brandName: readString(item, [
      "Brand_name_en",
      "Brand_name_zh",
      "brand",
      "brand_name",
      "brandName",
      "manufacturer",
    ]),
    partName: readString(item, [
      "Part_name_en",
      "Part_name_zh",
      "name",
      "part_name",
      "partName",
      "description",
    ]),
    category: readString(item, ["category", "category_name", "group_name"]),
    groupId: readString(item, ["Group_id", "group_id", "groupId", "gid"]),
    groupName: readString(item, [
      "Group_name",
      "group_name",
      "groupName",
      "group",
    ]),
    imageUrl: readString(item, [
      "Part_img",
      "Image_address",
      "image",
      "image_url",
      "imageUrl",
      "photo",
    ]),
    raw: item,
  }
}

const mapVehicleCandidate = (item: unknown): Vin17VehicleCandidate | null => {
  if (!isObject(item)) {
    return null
  }

  return {
    vin17ModelId: readString(item, [
      "Id",
      "model_id",
      "modelId",
      "id",
      "vehicle_id",
    ]),
    brand: readString(item, ["Brand", "brand", "brand_name"]),
    make: readString(item, ["make", "make_name", "epc"]),
    model: readString(item, ["Model", "model", "model_name"]),
    series: readString(item, ["Series", "series", "variant", "trim"]),
    modelYear: readInt(item, ["Model_year", "model_year", "modelYear", "year"]),
    yearFrom: readInt(item, ["year_from", "yearFrom", "from_year"]),
    yearTo: readInt(item, ["year_to", "yearTo", "to_year"]),
    engine: readString(item, ["engine", "engine_name"]),
    engineNo: readString(item, ["Engine_no", "engine_no", "engineNo", "engine_code"]),
    cc: readString(item, ["CC", "Cc", "cc", "engine_cc"]),
    fuelType: readString(item, ["Fuel_type", "fuel", "fuel_type", "fuelType"]),
    transmission: readString(item, [
      "Transmission_detail",
      "transmission",
      "gearbox",
    ]),
    bodyType: readString(item, ["Body_type", "body", "body_type", "bodyType"]),
    dateBegin: readString(item, [
      "Date_begin",
      "date_begin",
      "dateBegin",
      "production_start",
    ]),
    dateEnd: readString(item, [
      "Date_end",
      "date_end",
      "dateEnd",
      "production_end",
    ]),
    raw: item,
  }
}

export function normalizePartNumber(value: string): string {
  return value.trim().toUpperCase().replace(/[\s.-]+/g, "")
}

export async function searchPartIn17Vin(
  partNumber: string,
): Promise<Vin17PartCandidate[]> {
  const payload = await fetch17Vin({
    action: "search_epc",
    query_part_number: partNumber,
    query_match_type: "exact",
  })

  return findList(payload)
    .map(mapPartCandidate)
    .filter((candidate): candidate is Vin17PartCandidate => candidate !== null)
}

export async function get17VinInterchanges(
  partNumber: string,
  groupId: string | number,
): Promise<Vin17InterchangeResult> {
  const payload = await fetch17Vin({
    action: "get_interchange_from_part_number_and_group_id_plus_zh",
    part_number: partNumber,
    group_id: String(groupId),
  })

  const part = mapPartCandidate(
    findValueAtPath(payload, ["data", "InterchangeInfo", "PartInfo"]) ??
      findValueAtPath(payload, ["data", "PartInfo"]),
  )
  const oeInterchanges = findListAtPath(payload, [
    "data",
    "InterchangeInfo",
    "OeInterchange",
  ])
    .map(mapPartCandidate)
    .filter((candidate): candidate is Vin17PartCandidate => candidate !== null)
  const factoryInterchanges = findListAtPath(payload, [
    "data",
    "InterchangeInfo",
    "FactoryInterchange",
  ])
    .map(mapPartCandidate)
    .filter((candidate): candidate is Vin17PartCandidate => candidate !== null)

  return { part, oeInterchanges, factoryInterchanges }
}

export async function get17VinApplicableModels(
  partNumber: string,
  groupId: string | number,
): Promise<Vin17VehicleCandidate[]> {
  const payload = await fetch17Vin({
    action: "get_modellist_from_part_number_and_group_id",
    part_number: partNumber,
    group_id: String(groupId),
  })

  return findListAtPath(payload, ["data", "ModelListStd"])
    .map(mapVehicleCandidate)
    .filter((candidate): candidate is Vin17VehicleCandidate => candidate !== null)
}
