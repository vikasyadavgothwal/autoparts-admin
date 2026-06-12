import { PrismaClient } from "@/lib/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import type { Prisma } from "@/lib/generated/prisma/client"

const globalForPrisma = globalThis as {
  prisma?: PrismaClient
}

/**
 * Returns a singleton PrismaClient instance for all server-side database work.
 */
export function getDatabaseClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL?.trim()
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is missing. Configure it before using DB features.")
  }

  if (!globalForPrisma.prisma) {
    let adapter: Prisma.PrismaClientOptions["adapter"]

    try {
      adapter = new PrismaPg({ connectionString: databaseUrl })
    } catch {
      throw new Error(
        "Prisma adapter package is missing. Install @prisma/adapter-pg and restart dev server.",
      )
    }

    globalForPrisma.prisma = new PrismaClient({
      adapter,
    })
  }

  return globalForPrisma.prisma
}

export const db = getDatabaseClient()
