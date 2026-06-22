"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import {
  createVehicleAction,
  deleteVehicleAction,
  importVehiclesAction,
  updateVehicleAction,
} from "@/actions/admin-dashboard/vehicles/vehicles";
import { PageHeading } from "@/components/admin-dashboard/shared/page-heading";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useVehicleSheet } from "@/hooks/admin-dashboard/vehicles/use-vehicle-sheet";
import type {
  VehicleFormMode,
  VehicleInput,
  VehiclePageResult,
  VehicleRecord,
} from "@/types/admin-dashboard/vehicles/vehicles";

type VehiclesPageProps = {
  result: VehiclePageResult;
};

const EMPTY_FORM: VehicleInput = {
  brand: "",
  carName: "",
  variant: "",
  modelYear: null,
};

const MAX_MODEL_YEAR = new Date().getFullYear() + 2;

const getVisiblePages = (page: number, totalPages: number): number[] => {
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const end = Math.min(totalPages, start + 4);

  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
};

export function VehiclesPage({ result }: VehiclesPageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [isNavigating, startNavigation] = useTransition();
  const [query, setQuery] = useState(result.query);
  const [formMode, setFormMode] = useState<VehicleFormMode>("create");
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<VehicleRecord | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<VehicleInput>(EMPTY_FORM);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { isParsing, parseFile, downloadDummyCsv } = useVehicleSheet();

  const navigateToPage = useCallback(
    (page: number, searchQuery = result.query) => {
      const params = new URLSearchParams();
      const normalizedQuery = searchQuery.trim();

      if (normalizedQuery) {
        params.set("q", normalizedQuery);
      }

      if (page > 1) {
        params.set("page", String(page));
      }

      const href = params.size ? `${pathname}?${params.toString()}` : pathname;
      startNavigation(() => router.replace(href, { scroll: false }));
    },
    [pathname, result.query, router],
  );

  useEffect(() => {
    if (query.trim() === result.query) {
      return;
    }

    const timer = window.setTimeout(() => {
      navigateToPage(1, query);
    }, 400);

    return () => window.clearTimeout(timer);
  }, [navigateToPage, query, result.query]);

  const openCreate = () => {
    setFormMode("create");
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (vehicle: VehicleRecord) => {
    setFormMode("edit");
    setEditingId(vehicle.id);
    setForm({
      brand: vehicle.brand,
      carName: vehicle.carName,
      variant: vehicle.variant ?? "",
      modelYear: vehicle.modelYear,
    });
    setFormOpen(true);
  };

  const submitVehicle = () => {
    startTransition(async () => {
      const result =
        formMode === "create"
          ? await createVehicleAction(form)
          : await updateVehicleAction(editingId ?? "", form);

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      setFormOpen(false);
      router.refresh();
    });
  };

  const confirmDelete = () => {
    if (!deleteTarget) {
      return;
    }

    startTransition(async () => {
      const result = await deleteVehicleAction(deleteTarget.id);

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      setDeleteTarget(null);
      router.refresh();
    });
  };

  const submitImport = () => {
    if (!selectedFile) {
      toast.error("Choose a CSV or XLSX file");
      return;
    }

    startTransition(async () => {
      const parsed = await parseFile(selectedFile);

      if (parsed.errors.length > 0) {
        toast.error(parsed.errors.slice(0, 3).join(". "));
        return;
      }

      const result = await importVehiclesAction(parsed.rows);

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(
        result.skipped
          ? `${result.message}; ${result.skipped} duplicate rows skipped`
          : result.message,
      );
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setImportOpen(false);
      router.refresh();
    });
  };

  const { page, pageSize, totalItems, totalPages } = result.pagination;
  const firstVisibleItem = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastVisibleItem = Math.min(page * pageSize, totalItems);
  const visiblePages = getVisiblePages(page, totalPages);

  return (
    <div className="space-y-6">
      <PageHeading
        title="All Cars"
        subtitle="Manage brands, cars, optional variants, model years, and their linked parts."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={downloadDummyCsv}>
              <Download />
              Download dummy CSV
            </Button>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload />
              Bulk import
            </Button>
            <Button onClick={openCreate}>
              <Plus />
              Add car
            </Button>
          </div>
        }
      />
      <Card className="border border-dashboard-panel-border">
        <CardHeader className="border-b border-dashboard-panel-border sm:flex sm:flex-row sm:items-center sm:justify-between">
          <div></div>
          <div className="relative mt-3 w-full sm:mt-0 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dashboard-muted" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search brand, car, variant, year"
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
                <TableHead className="px-4">Brand</TableHead>
                <TableHead>Car name</TableHead>
                <TableHead>Variant</TableHead>
                <TableHead>Model year</TableHead>
                <TableHead>Parts</TableHead>
                <TableHead className="px-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.vehicles.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-32 text-center text-dashboard-muted"
                  >
                    {result.query
                      ? `No vehicles found for "${result.query}".`
                      : "No vehicles found."}
                  </TableCell>
                </TableRow>
              ) : (
                result.vehicles.map((vehicle) => (
                  <TableRow key={vehicle.id}>
                    <TableCell className="px-4 font-medium">
                      {vehicle.brand}
                    </TableCell>
                    <TableCell>{vehicle.carName}</TableCell>
                    <TableCell>{vehicle.variant || "—"}</TableCell>
                    <TableCell>{vehicle.modelYear ?? "—"}</TableCell>
                    <TableCell>{vehicle.partCount}</TableCell>

                    <TableCell className="px-4">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="icon-sm"
                          variant="outline"
                          aria-label={`Edit ${vehicle.carName}`}
                          onClick={() => openEdit(vehicle)}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="destructive"
                          aria-label={`Delete ${vehicle.carName}`}
                          onClick={() => setDeleteTarget(vehicle)}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {formMode === "create" ? "Add car" : "Edit car"}
            </DialogTitle>
            <DialogDescription>
              Variant and model year are optional. Add one row for each distinct
              combination.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="vehicle-brand">Brand</Label>
              <Input
                id="vehicle-brand"
                value={form.brand}
                onChange={(event) =>
                  setForm((value) => ({ ...value, brand: event.target.value }))
                }
                placeholder="Toyota"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehicle-name">Car name</Label>
              <Input
                id="vehicle-name"
                value={form.carName}
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    carName: event.target.value,
                  }))
                }
                placeholder="Corolla"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehicle-variant">Variant (optional)</Label>
              <Input
                id="vehicle-variant"
                value={form.variant ?? ""}
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    variant: event.target.value,
                  }))
                }
                placeholder="GLI"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehicle-model-year">Model year (optional)</Label>
              <Input
                id="vehicle-model-year"
                type="number"
                min={1886}
                max={MAX_MODEL_YEAR}
                step={1}
                value={form.modelYear ?? ""}
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    modelYear: event.target.value
                      ? Number(event.target.value)
                      : null,
                  }))
                }
                placeholder="2025"
              />
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
            <Button onClick={submitVehicle} disabled={isPending}>
              {isPending
                ? "Saving..."
                : formMode === "create"
                  ? "Create"
                  : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk import cars</DialogTitle>
            <DialogDescription>
              Upload CSV, XLS, or XLSX with columns: brand, carName, variant,
              modelYear. Variant and modelYear may be empty.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xls,.xlsx"
              onChange={(event) =>
                setSelectedFile(event.target.files?.[0] ?? null)
              }
              className="h-auto py-2"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setImportOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={submitImport} disabled={isPending || isParsing}>
              {isPending || isParsing ? "Importing..." : "Import sheet"}
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
            <DialogTitle>Delete vehicle?</DialogTitle>
            <DialogDescription>
              This removes {deleteTarget?.brand} {deleteTarget?.carName}
              {deleteTarget?.variant ? ` ${deleteTarget.variant}` : ""} and all
              linked parts.
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
              disabled={isPending}
            >
              {isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
