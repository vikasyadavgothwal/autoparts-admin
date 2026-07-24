import { db } from "@/lib/database/prisma"
import { UserRole } from "@/lib/generated/prisma/client"
import type { InputJsonValue } from "@/lib/generated/prisma/internal/prismaNamespace"

const maxCartItems = 100

function normalizeQuantity(value: unknown) {
  const quantity = Number(value ?? 1)
  if (!Number.isFinite(quantity)) return 1
  return Math.min(999, Math.max(1, Math.floor(quantity)))
}

function normalizeCartItem(item: unknown) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null
  const value = item as Record<string, unknown>
  if (value.type !== "product" && value.type !== "service") return null
  return {
    ...value,
    quantity: normalizeQuantity(value.quantity),
  }
}

export function normalizeCartItems(items: unknown) {
  if (!Array.isArray(items)) throw new Error("Cart items must be an array")
  if (items.length > maxCartItems) {
    throw new Error(`A cart can contain up to ${maxCartItems} items`)
  }
  return items
    .map(normalizeCartItem)
    .filter(
      (item): item is Record<string, unknown> & { quantity: number } =>
        Boolean(item),
    )
}

async function assertUserCartOwner(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, activeRole: true, roles: true, isActive: true },
  })
  if (!user) throw new Error("User account was not found")
  if (!user.isActive) throw new Error("User account is inactive")
  if (user.activeRole !== UserRole.User || !user.roles.includes(UserRole.User)) {
    throw new Error("Only User accounts can manage a cart")
  }
}

export async function getUserCart(userId: string) {
  await assertUserCartOwner(userId)
  const cart = await db.userCart.findUnique({ where: { userId } })
  return { items: Array.isArray(cart?.items) ? cart.items : [] }
}

export async function replaceUserCart(userId: string, itemsInput: unknown) {
  await assertUserCartOwner(userId)
  const items = normalizeCartItems(itemsInput)
  const jsonItems = items as InputJsonValue
  const cart = await db.userCart.upsert({
    where: { userId },
    create: { userId, items: jsonItems },
    update: { items: jsonItems },
  })
  return { items: Array.isArray(cart.items) ? cart.items : items }
}

export async function clearUserCart(userId: string) {
  await assertUserCartOwner(userId)
  await db.userCart.deleteMany({ where: { userId } })
  return { items: [] }
}
