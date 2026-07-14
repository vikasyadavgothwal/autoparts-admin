export type UserAddressInput = {
  label?: unknown;
  recipientName?: unknown;
  phone?: unknown;
  addressLine1?: unknown;
  addressLine2?: unknown;
  landmark?: unknown;
  city?: unknown;
  state?: unknown;
  postalCode?: unknown;
  country?: unknown;
  isDefault?: unknown;
};

export type UserAddressRecord = {
  id: string;
  label: string;
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};
