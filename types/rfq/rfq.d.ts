import type { FleetVehicleStatus, RfqSource } from "@/lib/generated/prisma/client"

export type FleetVehicleInput = {
  vehicleName: string
  vin: string
  mileage: number | string
  driver?: string | null
  status?: FleetVehicleStatus | string
  year: number | string
  make: string
  model: string
  trim?: string | null
  isPrimary?: boolean
}

export type RfqPartInput = {
  partName: string
  partNumber?: string | null
  quantity: number | string
  targetPrice?: number | string | null
  notes?: string | null
}

export type CreateRfqInput = {
  source: RfqSource | "fleet" | "user"
  fleetVehicleId?: string | null
  userVehicleId?: string | null
  projectName: string
  description?: string | null
  responseDeadline: string
  deliveryRequirement: string
  paymentTerms: string
  companyName: string
  contactName: string
  email: string
  phone: string
  vehicle?: {
    vin?: string | null
    year?: number | string | null
    make?: string | null
    model?: string | null
    trim?: string | null
  }
  parts: RfqPartInput[]
}

export type RfqAttachment = {
  key: string
  url: string
  name: string
  mimeType: string
  size: number
}
