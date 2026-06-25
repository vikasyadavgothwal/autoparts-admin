"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { getCurrentAdminSession } from "@/actions/admin-auth/me"
import { appRoutes } from "@/lib/routes"
import {
  createCategory,
  deleteCategory,
  getCategoryById,
  getCategoryCatalog,
  updateCategory,
} from "@/services/admin-dashboard/categories/category-service"
import type {
  CategoryActionResult,
  CategoryInput,
  CategoryPageResult,
  CategoryRecord,
  CategorySearchInput,
} from "@/types/admin-dashboard/categories/categories"

const CATEGORIES_PATH = "/categories"
const VEHICLES_PATH = "/vehicles"

const requireActiveAdmin = async (options?: { redirectOnFail?: boolean }) => {
  const session = await getCurrentAdminSession()

  if (!session.ok || !session.admin.isActive) {
    if (options?.redirectOnFail) {
      redirect(appRoutes.login)
    }

    throw new Error("Unauthorized")
  }
}

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    if (error.message.includes("Record to update not found")) {
      return "Category not found"
    }

    if (error.message.includes("Record to delete does not exist")) {
      return "Category not found"
    }

    if (error.message.includes("Foreign key constraint")) {
      return "This category still has linked parts and cannot be deleted."
    }

    return error.message
  }

  return "Unable to complete the request"
}

const revalidateCategoryScreens = () => {
  revalidatePath(CATEGORIES_PATH)
  revalidatePath(VEHICLES_PATH)
}

export async function fetchCategories(
  input: CategorySearchInput = {},
): Promise<CategoryPageResult> {
  await requireActiveAdmin({ redirectOnFail: true })
  return getCategoryCatalog(input)
}

export async function fetchCategory(id: string): Promise<CategoryRecord> {
  await requireActiveAdmin({ redirectOnFail: true })
  return getCategoryById(id)
}

export async function createCategoryAction(
  input: CategoryInput,
): Promise<CategoryActionResult> {
  try {
    await requireActiveAdmin()
    await createCategory(input)
    revalidateCategoryScreens()
    return { ok: true, message: "Category created" }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) }
  }
}

export async function updateCategoryAction(
  id: string,
  input: CategoryInput,
): Promise<CategoryActionResult> {
  try {
    await requireActiveAdmin()
    await updateCategory(id, input)
    revalidateCategoryScreens()
    return { ok: true, message: "Category updated" }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) }
  }
}

export async function deleteCategoryAction(
  id: string,
): Promise<CategoryActionResult> {
  try {
    await requireActiveAdmin()
    await deleteCategory(id)
    revalidateCategoryScreens()
    return { ok: true, message: "Category deleted" }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) }
  }
}
