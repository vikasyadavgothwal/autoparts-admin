import { db } from "@/lib/database/prisma";
import type {
  SupplierProfileInput,
  SupplierProfileRecord,
} from "@/types/supplier/settings";

const POSTAL_CODE_PATTERN = /^[A-Za-z0-9 -]*$/;

const text = (value: unknown) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";

const nullableText = (value: unknown, maxLength = 255) => {
  const normalized = text(value);
  if (!normalized) return null;
  if (normalized.length > maxLength) {
    throw new Error(`Value must be ${maxLength} characters or fewer`);
  }
  return normalized;
};

async function mapSupplierProfile(
  supplierId: string,
): Promise<SupplierProfileRecord> {
  const supplier = await db.user.findUnique({
    where: { id: supplierId },
    select: {
      id: true,
      publicId: true,
      supplierPublicId: true,
      companyName: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      state: true,
      postalCode: true,
      country: true,
      supplierApprovalStatus: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!supplier) throw new Error("Supplier account was not found");

  return {
    ...supplier,
    createdAt: supplier.createdAt.toISOString(),
    updatedAt: supplier.updatedAt.toISOString(),
  };
}

export async function getSupplierProfile(supplierId: string) {
  return mapSupplierProfile(supplierId);
}

export async function updateSupplierProfile(
  supplierId: string,
  input: SupplierProfileInput,
) {
  const postalCode = nullableText(input.postalCode, 40);
  if (postalCode && !POSTAL_CODE_PATTERN.test(postalCode)) {
    throw new Error("Postal code contains invalid characters");
  }

  await db.user.update({
    where: { id: supplierId },
    data: {
      companyName: nullableText(input.companyName, 160),
      firstName: nullableText(input.firstName, 100),
      lastName: nullableText(input.lastName, 100),
      phone: nullableText(input.phone, 40),
      addressLine1: nullableText(input.addressLine1, 255),
      addressLine2: nullableText(input.addressLine2, 255),
      city: nullableText(input.city, 120),
      state: nullableText(input.state, 120),
      postalCode,
      country: nullableText(input.country, 120),
    },
  });

  return getSupplierProfile(supplierId);
}
