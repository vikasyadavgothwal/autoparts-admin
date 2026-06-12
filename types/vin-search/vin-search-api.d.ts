export type VinSearchRequestPayload = {
  vin?: string
  partNumber?: string
}

export type VinSearchRequestPayloadInput = {
  vin?: unknown
  partNumber?: unknown
}

export type VinSearchErrorPayload = {
  error: string
}

export type VinSearchNormalizedResultPayload = {
  VIN: string
  "Model year": string
  "Make name": string
}

export type VinSearchParsedBodyResult =
  | {
      ok: true
      body: VinSearchRequestPayload
    }
  | {
      ok: false
      status: 400
      payload: VinSearchErrorPayload
    }

export type VinSearchQueryParamsResult =
  | {
      ok: true
      queryParams: URLSearchParams
      queryString: string
    }
  | {
      ok: false
      status: 400
      payload: VinSearchErrorPayload
    }

export type VinSearchUpstreamJsonResult =
  | { ok: true; data: unknown }
  | {
      ok: false
      data: {
        error: string
        rawResponse: string
      }
    }

export type VinSearchApiCallResult =
  | { ok: true; status: number; data: unknown }
  | { ok: false; status: number; data: unknown }

export type VinSearchNormalizedResult =
  | {
      ok: true
      status: number
      data: VinSearchNormalizedResultPayload
    }
  | {
      ok: false
      status: number
      error: string
    }
