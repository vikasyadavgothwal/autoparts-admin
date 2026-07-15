export type UserSavedPartProduct = {
  partUid: string
  title: string
  partNumber: string | null
  brandName: string | null
  category: string | null
  description: string
  image: string
  images: string[]
  offerCount: number
  totalStock: number
  minPrice: number | null
  currency: string
  savedAt: string
}

export type UserSavedPartsSummary = {
  totalSaved: number
  inStock: number
  totalValue: number
}

export type UserSavedPartsPayload = {
  parts: UserSavedPartProduct[]
  summary: UserSavedPartsSummary
}

export type SaveUserPartInput = {
  partUid?: unknown
}
