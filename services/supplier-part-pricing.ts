export const supplierPartVatApplies = (value: string | null | undefined) => {
  const normalized = value?.trim().toLowerCase()
  if (!normalized) return false
  if (/^(no|n|false|0|none|excluded?|not included|without vat)$/i.test(normalized)) {
    return false
  }
  return /^(yes|y|true|1|5|5%|included?|inclusive|with vat|vat included)$/i.test(
    normalized,
  )
}

export const applySupplierPartVat = (
  cents: number,
  vat: string | null | undefined,
) => {
  if (!supplierPartVatApplies(vat)) return cents
  return Math.round(cents * 1.05)
}

export const getSupplierPartEffectivePriceCents = (part: {
  price?: number | null
  pricing?: {
    basePrice?: number | null
    discountPrice?: number | null
    vat?: string | null
  } | null
}) => {
  const basePrice =
    part.pricing?.discountPrice ?? part.pricing?.basePrice ?? part.price ?? 0
  return applySupplierPartVat(basePrice, part.pricing?.vat)
}
