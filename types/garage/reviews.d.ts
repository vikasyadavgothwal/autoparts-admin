export type GarageServiceReviewRecord = {
  id: string
  garageId: string
  serviceId: string
  customerId: string
  bookingId: string | null
  serviceName: string
  customerName: string
  rating: number
  comment: string
  garageReply: string | null
  garageReplyAt: string | null
  createdAt: string
  updatedAt: string
}

export type GarageServiceReviewInput = {
  bookingId?: unknown
  serviceId?: unknown
  rating?: unknown
  comment?: unknown
}

export type GarageReviewReplyInput = {
  reply?: unknown
}
