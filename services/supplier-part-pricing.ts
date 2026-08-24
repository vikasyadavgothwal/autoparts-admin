const DEFAULT_VAT_PERCENT = 5

const supplierPartVatIsIncluded = (
  vat: string | null | undefined,
) => {
  const normalized = vat?.trim().toLowerCase()
  return Boolean(
    normalized &&
      /^(yes|y|true|1|5|5%|included?|inclusive|with vat|vat included)$/i.test(
        normalized,
      ),
  )
}

export const supplierPartVatIsExcluded = (
  vat: string | null | undefined,
) => {
  const normalized = vat?.trim().toLowerCase()
  return Boolean(
    normalized &&
      /^(excluded?|exclusive|not included|without vat)$/i.test(normalized),
  )
}

export const getSupplierPartVatPercent = (
  taxClass: string | null | undefined,
  vat: string | null | undefined,
) => {
  if (!supplierPartVatIsIncluded(vat) && !supplierPartVatIsExcluded(vat)) {
    return 0
  }

  const normalizedTaxClass = taxClass?.trim().toLowerCase()
  if (normalizedTaxClass && /zero|exempt/.test(normalizedTaxClass)) return 0

  const rate = normalizedTaxClass?.match(/\d+(?:\.\d+)?/)
  return rate ? Number(rate[0]) : DEFAULT_VAT_PERCENT
}

export const getSupplierPartPriceBreakdownCents = (part: {
  price?: number | null
  pricing?: {
    basePrice?: number | null
    discountPrice?: number | null
    taxClass?: string | null
    vat?: string | null
  } | null
}) => {
  const supplierUnitPrice =
    part.pricing?.discountPrice ?? part.pricing?.basePrice ?? part.price ?? 0
  const vatPercent = getSupplierPartVatPercent(
    part.pricing?.taxClass,
    part.pricing?.vat,
  )
  const vatExcluded = supplierPartVatIsExcluded(part.pricing?.vat)
  const vatAmount = vatExcluded
    ? Math.round((supplierUnitPrice * vatPercent) / 100)
    : supplierUnitPrice - Math.round(supplierUnitPrice / (1 + vatPercent / 100))
  const customerUnitPrice = vatExcluded
    ? supplierUnitPrice + vatAmount
    : supplierUnitPrice

  return {
    supplierUnitPrice: supplierUnitPrice - (vatExcluded ? 0 : vatAmount),
    vatPercent,
    vatAmount,
    customerUnitPrice,
    vatMode: part.pricing?.vat?.trim() || null,
  }
}

export const getSupplierPartEffectivePriceCents = (
  part: Parameters<typeof getSupplierPartPriceBreakdownCents>[0],
) => getSupplierPartPriceBreakdownCents(part).customerUnitPrice
