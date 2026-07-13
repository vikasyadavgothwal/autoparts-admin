import {
  businessQueryIpHash,
  createBusinessQuery,
  deleteBusinessQuery,
  listBusinessQueries,
} from "@/services/business-queries/business-query-service"
import type {
  BusinessQueryInput,
  BusinessQueryListParams,
} from "@/types/business-queries/business-queries"

export function createPublicBusinessQuery(input: BusinessQueryInput) {
  return createBusinessQuery(input)
}

export function getBusinessQueryIpHash(ip: string | null) {
  return businessQueryIpHash(ip)
}

export function listAdminBusinessQueries(params: BusinessQueryListParams) {
  return listBusinessQueries(params)
}

export function deleteAdminBusinessQuery(id: string) {
  return deleteBusinessQuery(id)
}
