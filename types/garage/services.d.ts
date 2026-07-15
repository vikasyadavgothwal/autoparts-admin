export type GarageServiceStatus = "active" | "inactive"

export type GarageServiceInput = {
  name?: unknown
  category?: unknown
  durationMinutes?: unknown
  price?: unknown
  currency?: unknown
  bookingsCount?: unknown
  status?: unknown
}

export type GarageServiceRecord = {
  id: string
  publicId: string
  garageId: string
  name: string
  category: string
  durationMinutes: number
  price: number
  currency: string
  bookingsCount: number
  ratingAverage?: number
  reviewCount?: number
  reviews?: Array<{
    id: string
    customerName: string
    rating: number
    comment: string
    garageReply: string | null
    createdAt: string
    updatedAt: string
  }>
  status: GarageServiceStatus
  createdAt: string
  updatedAt: string
}
