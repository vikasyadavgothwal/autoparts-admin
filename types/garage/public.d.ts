import type { GarageDayHours } from "@/types/garage/settings"

export type PublicGarageService = {
  id: string
  name: string
  category: string
  durationMinutes: number
  price: number
  currency: string
}

export type PublicGarageReview = {
  id: string
  customerName: string
  serviceName: string
  rating: number
  comment: string
  garageReply: string | null
  date: string
}

export type PublicGarageSummary = {
  id: string
  name: string
  email: string | null
  mobile: string | null
  address: string | null
  country: string | null
  state: string | null
  city: string | null
  image: string | null
  imageKey: string | null
  jobCompletedNumber: number
  yearsExperience: number
  responseTime: string | null
  certifications: string[]
  specialties: string[]
  startingPrice: number | null
  currency: string
  ratingAverage: number
  reviewCount: number
  planPriority: number
  availableToday: boolean
  availableThisWeek: boolean
}

export type PublicGarageDetail = PublicGarageSummary & {
  about: string | null
  workingDays: string[]
  workingHours: string | null
  workingHoursByDay: Record<string, GarageDayHours>
  galleryImages: string[]
  galleryImageKeys: string[]
  services: PublicGarageService[]
  reviews: PublicGarageReview[]
}

export type PublicGarageListResponse = {
  ok: true
  garages: PublicGarageSummary[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}
