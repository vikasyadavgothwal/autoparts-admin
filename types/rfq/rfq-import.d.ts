export type ImportedRfqPart = {
  vin: string
  partName: string
  partNumber: string
  quantity: number
  targetPrice: string
}

export type ImportedRfqWorkbook = {
  vin: string
  vins: string[]
  parts: ImportedRfqPart[]
  vehicles: Array<{
    vin: string
    year: number
    make: string
    model: string
    vehicleName: string
    trim: string
  }>
}
