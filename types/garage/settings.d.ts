export type GarageProfileInput = {
  garageName?: unknown
  contactEmail?: unknown
  mobile?: unknown
  workingDays?: unknown
  workingHours?: unknown
  workingHoursByDay?: unknown
  garageImageUrl?: unknown
  garageImageKey?: unknown
  address?: unknown
  country?: unknown
  state?: unknown
  city?: unknown
  pincode?: unknown
  jobCompletedNumber?: unknown
  yearsExperience?: unknown
  responseTime?: unknown
  certifications?: unknown
  about?: unknown
  galleryImageUrls?: unknown
  galleryImageKeys?: unknown
}

export type GarageDayHours = {
  enabled: boolean
  open: string
  close: string
}

export type GarageProfileRecord = {
  id: string
  garageId: string
  garageName: string | null
  contactEmail: string | null
  contactEmailVerifiedAt: string | null
  mobile: string | null
  mobileVerifiedAt: string | null
  workingDays: string[]
  workingHours: string | null
  workingHoursByDay: Record<string, GarageDayHours>
  garageImageUrl: string | null
  garageImageKey: string | null
  address: string | null
  country: string | null
  state: string | null
  city: string | null
  pincode: string | null
  jobCompletedNumber: number
  yearsExperience: number
  responseTime: string | null
  certifications: string[]
  about: string | null
  galleryImageUrls: string[]
  galleryImageKeys: string[]
  createdAt: string
  updatedAt: string
}

export type GarageUploadedImage = {
  key: string
  url: string
}

export type GarageVerificationResponse = {
  ok: true
  message: string
  verificationLink?: string
  otp?: string
}
