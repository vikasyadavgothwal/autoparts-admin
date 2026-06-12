import type { AuthenticatedAdmin } from "@/types/admin-auth/admin-auth"

export type CreateFirstAdminApiBody = {
  email?: unknown
  password?: unknown
  firstAdminToken?: unknown
}

export type FirstAdminTokenContext = {
  firstAdminToken: string | null
}

export type CreateFirstAdminApiSuccessResponse = {
  ok: true
  admin: AuthenticatedAdmin
}

export type CreateFirstAdminApiErrorResponse = {
  ok: false
  message: string
}

export type CreateFirstAdminApiResponse =
  | CreateFirstAdminApiSuccessResponse
  | CreateFirstAdminApiErrorResponse

export type CreateFirstAdminApiResult =
  | CreateFirstAdminApiSuccessResponse
  | (CreateFirstAdminApiErrorResponse & {
      statusCode: 400 | 401 | 403 | 409 | 500
    })
