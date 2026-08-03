export type AdminVinDecodeSource = "local_db" | "17vin"

export type AdminVinDecodedVehicle = {
  vin: string
  source: AdminVinDecodeSource
  title: string
  market: string
  year: number
  make: string
  model: string
  platform: string | null
  engine: string | null
  engineCapacity: string | null
  transmission: string | null
  trim: string | null
  confidence: number
}

export type AdminVinDecodeState = {
  ok: boolean
  message?: string
  result?: AdminVinDecodedVehicle
}
