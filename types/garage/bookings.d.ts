export type GarageBookingStatus =
  | "pending"
  | "pending_slot_selection"
  | "confirmed"
  | "completed"
  | "cancelled"

export type GarageBookingInput = {
  garageId?: unknown
  serviceId?: unknown
  customerName?: unknown
  customerEmail?: unknown
  customerPhone?: unknown
  vehicleYear?: unknown
  vehicleMake?: unknown
  vehicleModel?: unknown
  vehicleVin?: unknown
  notes?: unknown
  bookingDate?: unknown
  bookingTime?: unknown
}

export type GarageOfflineBookingInput = Omit<GarageBookingInput, "garageId">

export type GarageBookingRecord = {
  id: string
  publicId: string
  garageId: string
  customerId: string | null
  serviceId: string | null
  serviceName: string
  customerName: string
  customerEmail: string | null
  customerPhone: string
  vehicleYear: string | null
  vehicleMake: string | null
  vehicleModel: string | null
  vehicleVin: string | null
  notes: string | null
  cancellationReason: string | null
  bookingDate: string | null
  bookingTime: string | null
  durationMinutes: number
  price: number
  currency: string
  status: GarageBookingStatus
  linkedOrderId: string | null
  canSelectSlot?: boolean
  createdAt: string
  updatedAt: string
}

export type UserGarageBookingRecord = GarageBookingRecord & {
  garageName: string | null
  reviewId: string | null
  reviewRating: number | null
  reviewComment: string | null
  reviewGarageReply: string | null
}
