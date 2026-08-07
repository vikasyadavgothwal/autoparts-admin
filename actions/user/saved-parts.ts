import {
  listSavedPartsForUser,
  removeSavedPartForUser,
  getSavedPartStatus,
  savePartForUser,
} from "@/services/user/saved-parts-service"
import type { SaveUserPartInput } from "@/types/user/saved-parts"

const statusForError = (error: unknown) => {
  const message = error instanceof Error ? error.message : ""
  if (message.includes("Only User accounts")) return 403
  if (message.includes("inactive")) return 403
  if (message.includes("not available")) return 404
  if (message.includes("required")) return 400
  return 400
}

export async function listUserSavedPartsAction(userId: string) {
  return listSavedPartsForUser(userId)
}

export async function getUserSavedPartStatusAction(
  userId: string,
  partUid: string | null,
) {
  return getSavedPartStatus(userId, partUid ?? "")
}

export async function saveUserPartAction(
  userId: string,
  input: SaveUserPartInput,
) {
  try {
    return {
      ok: true as const,
      statusCode: 201,
      ...(await savePartForUser(userId, input.partUid, input)),
    }
  } catch (error) {
    return {
      ok: false as const,
      statusCode: statusForError(error),
      message: error instanceof Error ? error.message : "Unable to save part",
    }
  }
}

export async function removeUserSavedPartAction(
  userId: string,
  input: SaveUserPartInput,
) {
  try {
    return {
      ok: true as const,
      statusCode: 200,
      ...(await removeSavedPartForUser(userId, input.partUid)),
    }
  } catch (error) {
    return {
      ok: false as const,
      statusCode: statusForError(error),
      message:
        error instanceof Error ? error.message : "Unable to remove saved part",
    }
  }
}
