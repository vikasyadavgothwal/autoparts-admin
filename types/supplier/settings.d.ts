export type SupplierProfileInput = {
  companyName?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  phone?: unknown;
  addressLine1?: unknown;
  addressLine2?: unknown;
  city?: unknown;
  state?: unknown;
  postalCode?: unknown;
  country?: unknown;
};

export type SupplierProfileRecord = {
  id: string;
  publicId: string;
  supplierPublicId: string | null;
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  supplierApprovalStatus: string;
  createdAt: string;
  updatedAt: string;
};
