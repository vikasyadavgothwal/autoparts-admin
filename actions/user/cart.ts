import {
  clearUserCart,
  getUserCart,
  replaceUserCart,
} from "@/services/user/cart-service"

const statusForError = (error: unknown) => {
  const message = error instanceof Error ? error.message : ""
  if (message.includes("Only User accounts")) return 403
  if (message.includes("inactive")) return 403
  if (message.includes("not found")) return 404
  if (message.includes("must be")) return 400
  return 400
}

export async function getUserCartAction(userId: string) {
  return getUserCart(userId)
}

export async function replaceUserCartAction(userId: string, items: unknown) {
  try {
    return {
      ok: true as const,
      statusCode: 200,
      ...(await replaceUserCart(userId, items)),
    }
  } catch (error) {
    return {
      ok: false as const,
      statusCode: statusForError(error),
      message: error instanceof Error ? error.message : "Unable to save cart",
    }
  }
}

export async function clearUserCartAction(userId: string) {
  try {
    return {
      ok: true as const,
      statusCode: 200,
      ...(await clearUserCart(userId)),
    }
  } catch (error) {
    return {
      ok: false as const,
      statusCode: statusForError(error),
      message: error instanceof Error ? error.message : "Unable to clear cart",
    }
  }
}
