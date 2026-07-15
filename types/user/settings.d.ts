export type UserProfileInput = {
  companyName?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  email?: unknown;
  phone?: unknown;
  addressLine1?: unknown;
  addressLine2?: unknown;
  city?: unknown;
  state?: unknown;
  postalCode?: unknown;
  country?: unknown;
};

export type UserProfileRecord = {
  id: string;
  publicId: string;
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  emailVerifiedAt: string | null;
  phone: string | null;
  mobileVerifiedAt: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UserVerificationResponse = {
  ok: true;
  message: string;
  verificationLink?: string;
};
