"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { usePathname, useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight, Pencil, Plus, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"

import {
  createCategoryAction,
  deleteCategoryAction,
  updateCategoryAction,
} from "@/actions/admin-dashboard/categories/categories"
import { PageHeading } from "@/components/admin-dashboard/shared/page-heading"
import { StatusBadge } from "@/components/admin-dashboard/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type {
  CategoryFormMode,
  CategoryInput,
  CategoryPageResult,
  CategoryRecord,
  CategoryStatus,
} from "@/types/admin-dashboard/categories/categories"

type CategoriesPageProps = {
  result: CategoryPageResult
}

const EMPTY_FORM: CategoryInput = {
  name: "",
  status: "ACTIVE",
}

const getStatusTone = (status: CategoryStatus) =>
  status === "ACTIVE" ? "success" : "neutral"

const getVisiblePages = (page: number, totalPages: number): number[] => {
  const start = Math.max(1, Math.min(page - 2, totalPages - 4))
  const end = Math.min(totalPages, start + 4)

  return Array.from({ length: end - start + 1 }, (_, index) => start + index)
}

export function CategoriesPage({ result }: CategoriesPageProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [isNavigating, startNavigation] = useTransition()
  const [query, setQuery] = useState(result.query)
  const [formMode, setFormMode] = useState<CategoryFormMode>("create")
  const [formOpen, setFormOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<CategoryRecord | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<CategoryInput>(EMPTY_FORM)

  const navigateToPage = useCallback(
    (page: number, searchQuery = result.query) => {
      const params = new URLSearchParams()
      const normalizedQuery = searchQuery.trim()

      if (normalizedQuery) {
        params.set("q", normalizedQuery)
      }

      if (page > 1) {
        params.set("page", String(page))
      }

      const href = params.size ? `${pathname}?${params.toString()}` : pathname
      startNavigation(() => router.replace(href, { scroll: false }))
    },
    [pathname, result.query, router],
  )

  useEffect(() => {
    if (query.trim() === result.query) {
      return
    }

    const timer = window.setTimeout(() => {
      navigateToPage(1, query)
    }, 400)

    return () => window.clearTimeout(timer)
  }, [navigateToPage, query, result.query])

  const openCreate = () => {
    setFormMode("create")
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  const openEdit = (category: CategoryRecord) => {
    setFormMode("edit")
    setEditingId(category.id)
    setForm({
      name: category.name,
      status: category.status,
    })
    setFormOpen(true)
  }

  const submitCategory = () => {
    startTransition(async () => {
      const actionResult =
        formMode === "create"
          ? await createCategoryAction(form)
          : await updateCategoryAction(editingId ?? "", form)

      if (!actionResult.ok) {
        toast.error(actionResult.message)
        return
      }

      toast.success(actionResult.message)
      setFormOpen(false)
      router.refresh()
    })
  }

  const confirmDelete = () => {
    if (!deleteTarget) {
      return
    }

    startTransition(async () => {
      const actionResult = await deleteCategoryAction(deleteTarget.id)

      if (!actionResult.ok) {
        toast.error(actionResult.message)
        return
      }

      toast.success(actionResult.message)
      setDeleteTarget(null)
      router.refresh()
    })
  }

  const { page, pageSize, totalItems, totalPages } = result.pagination
  const firstVisibleItem = totalItems === 0 ? 0 : (page - 1) * pageSize + 1
  const lastVisibleItem = Math.min(page * pageSize, totalItems)
  const visiblePages = getVisiblePages(page, totalPages)

  return (
    <div className="space-y-6">
      <PageHeading
        title="Categories"
        subtitle="Create and manage part categories, status, and linked part assignments."
        action={
          <Button onClick={openCreate}>
            <Plus />
            Add Category
          </Button>
        }
      />

      <Card className="border border-dashboard-panel-border">
        <CardHeader className="border-b border-dashboard-panel-border sm:flex sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-dashboard-muted">
              {result.categories.length} categor{result.categories.length === 1 ? "y" : "ies"}
            </p>
          </div>
          <div className="relative mt-3 w-full sm:mt-0 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dashboard-muted" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search categories"
              className="h-9 pl-9"
            />
            {isNavigating && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-dashboard-muted">
                Searching...
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-4">Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Linked Parts</TableHead>
                <TableHead className="px-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.categories.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-32 text-center text-dashboard-muted"
                  >
                    {result.query
                      ? `No categories found for "${result.query}".`
                      : "No categories found."}
                  </TableCell>
                </TableRow>
              ) : (
                result.categories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell className="px-4 font-medium">{category.name}</TableCell>
                    <TableCell>{category.slug}</TableCell>
                    <TableCell>
                      <StatusBadge
                        label={category.status === "ACTIVE" ? "Active" : "Inactive"}
                        tone={getStatusTone(category.status)}
                      />
                    </TableCell>
                    <TableCell>{category.linkedPartsCount}</TableCell>
                    <TableCell className="px-4">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="icon-sm"
                          variant="outline"
                          aria-label={`Edit ${category.name}`}
                          onClick={() => openEdit(category)}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="destructive"
                          aria-label={`Delete ${category.name}`}
                          onClick={() => setDeleteTarget(category)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <div className="flex flex-col gap-3 border-t border-dashboard-panel-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-dashboard-muted">
              Showing {firstVisibleItem}–{lastVisibleItem} of {totalItems}
            </p>
            <div className="flex flex-wrap items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigateToPage(page - 1)}
                disabled={page <= 1 || isNavigating}
              >
                <ChevronLeft />
                Previous
              </Button>
              {visiblePages.map((pageNumber) => (
                <Button
                  key={pageNumber}
                  size="icon-sm"
                  variant={pageNumber === page ? "default" : "outline"}
                  aria-label={`Go to page ${pageNumber}`}
                  aria-current={pageNumber === page ? "page" : undefined}
                  onClick={() => navigateToPage(pageNumber)}
                  disabled={isNavigating}
                >
                  {pageNumber}
                </Button>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigateToPage(page + 1)}
                disabled={page >= totalPages || isNavigating}
              >
                Next
                <ChevronRight />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {formMode === "create" ? "Add category" : "Edit category"}
            </DialogTitle>
            <DialogDescription>
              Slug is generated automatically from the category name.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="category-name">Name</Label>
              <Input
                id="category-name"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Brake System"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category-status">Status</Label>
              <Select
                value={form.status}
                onValueChange={(value: CategoryStatus) =>
                  setForm((current) => ({ ...current, status: value }))
                }
              >
                <SelectTrigger id="category-status" className="w-full">
                  <SelectValue placeholder="Choose a status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFormOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={submitCategory} disabled={isPending}>
              {isPending
                ? "Saving..."
                : formMode === "create"
                  ? "Create"
                  : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete category?</DialogTitle>
            <DialogDescription>
              {deleteTarget?.linkedPartsCount
                ? `${deleteTarget.name} still has ${deleteTarget.linkedPartsCount} linked part${deleteTarget.linkedPartsCount === 1 ? "" : "s"}. Reassign them before deleting this category.`
                : `Delete ${deleteTarget?.name}? This action cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={isPending || Boolean(deleteTarget?.linkedPartsCount)}
            >
              {isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
