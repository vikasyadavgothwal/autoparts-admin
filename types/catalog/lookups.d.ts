export type CategoryLookupRow = {
  id: string;
  name: string;
  parentId: string | null;
};

export type VehicleLookupRow = {
  id: string;
  make: string;
  model: string;
  tierLabel: string | null;
};

export type BrandLookupRow = {
  id: string;
  brandName: string;
  categoryNames: string[];
  tierLabel: string | null;
};

export type GradeLookupRow = {
  customerFacingLabel: string;
  description: string | null;
};

export type CatalogLookupWorkbookData = {
  categories: CategoryLookupRow[];
  vehicles: VehicleLookupRow[];
  brands: BrandLookupRow[];
  grades: GradeLookupRow[];
};
