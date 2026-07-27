import { Buffer } from "node:buffer";
import { createHash, randomBytes, randomUUID } from "node:crypto";

import { db } from "@/lib/database/prisma";
import { verifyFirebaseIdToken } from "@/lib/firebase/admin";
import { Prisma } from "@/lib/generated/prisma/client";
import {
  createSignedS3ObjectUrl,
  deleteObjectFromS3,
  getS3ObjectKeyFromUrl,
  uploadObjectToS3,
} from "@/lib/storage/s3";
import type {
  SupplierProfileInput,
  SupplierProfileRecord,
  SupplierVerificationResponse,
} from "@/types/supplier/settings";

type VerificationRow = {
  id: string;
  garageId: string;
  target: "email" | "mobile";
  targetValue: string;
  tokenHash: string | null;
  otpHash: string | null;
  expiresAt: Date;
  consumedAt: Date | null;
};

type MobileVerificationRow = {
  consumedAt: Date;
};

type AvatarUploadInput = {
  contentType: string;
  body: Buffer;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_PATTERN = /^\+\d{8,18}$/;
const POSTAL_CODE_PATTERN = /^[A-Za-z0-9 -]*$/;
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const AVATAR_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

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

const nullableHttpUrl = (value: unknown) => {
  const normalized = nullableText(value, 2_048);
  if (!normalized) return null;
  try {
    const url = new URL(normalized);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error();
    }
  } catch {
    throw new Error("Document image URL must be a valid HTTP or HTTPS URL");
  }
  return normalized;
};

const phoneText = (value: unknown) => text(value).replace(/[^\d+]/g, "");

const hashSecret = (value: string) =>
  createHash("sha256").update(value).digest("hex");

async function sendWebhook(
  url: string | undefined,
  payload: Record<string, unknown>,
) {
  if (!url) return false;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  return response.ok;
}

async function getMobileVerifiedAt(userId: string, phone: string | null) {
  if (!phone) return null;
  const [verification] = await db.$queryRaw<MobileVerificationRow[]>`
    SELECT "consumedAt"
    FROM "garage_verification_requests"
    WHERE
      "garageId" = ${userId}
      AND "target" = 'mobile'::"GarageVerificationTarget"
      AND "targetValue" = ${phone}
      AND "consumedAt" IS NOT NULL
    ORDER BY "consumedAt" DESC
    LIMIT 1
  `;
  return verification?.consumedAt ?? null;
}

async function publicImageUrl(imageUrl: string | null) {
  if (!imageUrl) return null;
  try {
    const key = getS3ObjectKeyFromUrl(imageUrl);
    return key ? await createSignedS3ObjectUrl(key, 60 * 60) : imageUrl;
  } catch {
    return imageUrl;
  }
}

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
      emailVerifiedAt: true,
      phone: true,
      tradeLicenseNumber: true,
      supplierContactPerson: true,
      supplierDesignation: true,
      tradeLicenseImageUrl: true,
      vatTrnNumber: true,
      vatTrnImageUrl: true,
      emiratesIdPassportUrl: true,
      bankIban: true,
      bankAccountProofUrl: true,
      marketplaceAgreementAcceptedAt: true,
      firebaseUid: true,
      avatarUrl: true,
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

  const mobileVerifiedAt =
    (await getMobileVerifiedAt(supplier.id, supplier.phone)) ??
    (supplier.phone && supplier.firebaseUid ? supplier.updatedAt : null);

  return {
    id: supplier.id,
    publicId: supplier.publicId,
    supplierPublicId: supplier.supplierPublicId,
    companyName: supplier.companyName,
    firstName: supplier.firstName,
    lastName: supplier.lastName,
    email: supplier.email,
    emailVerifiedAt: supplier.emailVerifiedAt?.toISOString() ?? null,
    phone: supplier.phone,
    tradeLicenseNumber: supplier.tradeLicenseNumber,
    contactPerson: supplier.supplierContactPerson,
    designation: supplier.supplierDesignation,
    tradeLicenseImageUrl: await publicImageUrl(supplier.tradeLicenseImageUrl),
    vatTrnNumber: supplier.vatTrnNumber,
    vatTrnImageUrl: await publicImageUrl(supplier.vatTrnImageUrl),
    emiratesIdPassportUrl: await publicImageUrl(supplier.emiratesIdPassportUrl),
    bankIban: supplier.bankIban,
    bankAccountProofUrl: await publicImageUrl(supplier.bankAccountProofUrl),
    marketplaceAgreementAcceptedAt:
      supplier.marketplaceAgreementAcceptedAt?.toISOString() ?? null,
    mobileVerifiedAt: mobileVerifiedAt?.toISOString() ?? null,
    avatarUrl: await publicImageUrl(supplier.avatarUrl),
    addressLine1: supplier.addressLine1,
    addressLine2: supplier.addressLine2,
    city: supplier.city,
    state: supplier.state,
    postalCode: supplier.postalCode,
    country: supplier.country,
    supplierApprovalStatus: supplier.supplierApprovalStatus,
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
  const companyName = nullableText(input.companyName, 160);
  const firstName = nullableText(input.firstName, 100);
  const lastName = nullableText(input.lastName, 100);
  const email = nullableText(input.email, 254)?.toLowerCase() ?? null;
  const phone = nullableText(input.phone, 40);
  const postalCode = nullableText(input.postalCode, 40);
  const tradeLicenseNumber = nullableText(input.tradeLicenseNumber, 100);
  const contactPerson = nullableText(input.contactPerson, 160);
  const designation = nullableText(input.designation, 120);
  const tradeLicenseImageUrl = nullableHttpUrl(input.tradeLicenseImageUrl);
  const vatTrnNumber = nullableText(input.vatTrnNumber, 100);
  const vatTrnImageUrl = nullableHttpUrl(input.vatTrnImageUrl);
  const emiratesIdPassportUrl = nullableHttpUrl(input.emiratesIdPassportUrl);
  const bankIban = nullableText(input.bankIban, 80);
  const bankAccountProofUrl = nullableHttpUrl(input.bankAccountProofUrl);
  const marketplaceAgreementAccepted =
    input.marketplaceAgreementAccepted === true ||
    input.marketplaceAgreementAccepted === "true" ||
    input.marketplaceAgreementAccepted === "on";

  if (email && !EMAIL_PATTERN.test(email)) {
    throw new Error("Enter a valid email address");
  }
  if (phone && !MOBILE_PATTERN.test(phone)) {
    throw new Error("Enter a valid mobile number");
  }
  if (postalCode && !POSTAL_CODE_PATTERN.test(postalCode)) {
    throw new Error("Postal code contains invalid characters");
  }

  const current = await db.user.findUnique({
    where: { id: supplierId },
    select: { email: true, phone: true, marketplaceAgreementAcceptedAt: true },
  });
  if (!current) throw new Error("Supplier account was not found");

  await db.user.update({
    where: { id: supplierId },
    data: {
      companyName,
      tradeLicenseNumber,
      supplierContactPerson: contactPerson,
      supplierDesignation: designation,
      tradeLicenseImageUrl,
      vatTrnNumber,
      vatTrnImageUrl,
      emiratesIdPassportUrl,
      bankIban,
      bankAccountProofUrl,
      marketplaceAgreementAcceptedAt: marketplaceAgreementAccepted
        ? current.marketplaceAgreementAcceptedAt ?? new Date()
        : null,
      firstName,
      lastName,
      addressLine1: nullableText(input.addressLine1, 255),
      addressLine2: nullableText(input.addressLine2, 255),
      city: nullableText(input.city, 120),
      state: nullableText(input.state, 120),
      postalCode,
      country: nullableText(input.country, 120),
      ...(email === current.email ? { email } : {}),
      ...(phone === current.phone ? { phone } : {}),
    },
  });

  return getSupplierProfile(supplierId);
}

export async function requestSupplierEmailVerification(
  supplierId: string,
  requestedEmail: unknown,
  origin: string,
  verificationBaseUrl?: string | null,
): Promise<SupplierVerificationResponse> {
  const email = nullableText(requestedEmail, 254)?.toLowerCase() ?? null;
  if (!email) throw new Error("Add an email before verification");
  if (!EMAIL_PATTERN.test(email)) throw new Error("Enter a valid email address");

  const existing = await db.user.findFirst({
    where: { email, NOT: { id: supplierId } },
    select: { id: true },
  });
  if (existing) {
    throw new Error("This email is already used by another account");
  }

  const profile = await getSupplierProfile(supplierId);
  if (profile.email === email && profile.emailVerifiedAt) {
    return { ok: true, message: "Email is already verified" };
  }

  const token = randomBytes(32).toString("hex");
  await db.$executeRaw`
    INSERT INTO "garage_verification_requests" (
      "id",
      "garageId",
      "target",
      "targetValue",
      "tokenHash",
      "expiresAt"
    )
    VALUES (
      ${randomUUID()},
      ${supplierId},
      'email'::"GarageVerificationTarget",
      ${email},
      ${hashSecret(token)},
      CURRENT_TIMESTAMP + INTERVAL '1 hour'
    )
  `;

  const cleanVerificationBaseUrl = verificationBaseUrl
    ?.trim()
    .replace(/\/+$/, "");
  const verificationLink = cleanVerificationBaseUrl
    ? `${cleanVerificationBaseUrl}/api/supplier/settings/verify-email?token=${token}`
    : `${origin.replace(/\/+$/, "")}/api/v1/supplier/settings/verify-email?token=${token}`;
  const sent = await sendWebhook(
    process.env.SUPPLIER_EMAIL_VERIFICATION_WEBHOOK_URL ??
      process.env.USER_EMAIL_VERIFICATION_WEBHOOK_URL ??
      process.env.FLEET_EMAIL_VERIFICATION_WEBHOOK_URL ??
      process.env.GARAGE_EMAIL_VERIFICATION_WEBHOOK_URL,
    {
      to: email,
      verificationLink,
      accountType: "Supplier",
    },
  );

  return {
    ok: true,
    message: sent
      ? "Verification link sent"
      : "Verification link created. Configure SUPPLIER_EMAIL_VERIFICATION_WEBHOOK_URL to send it automatically.",
    ...(process.env.NODE_ENV !== "production" ? { verificationLink } : {}),
  };
}

export async function verifySupplierEmail(token: string) {
  const tokenHash = hashSecret(token);
  const rows = await db.$queryRaw<VerificationRow[]>`
    UPDATE "garage_verification_requests"
    SET "consumedAt" = CURRENT_TIMESTAMP
    WHERE "id" = (
      SELECT "id"
      FROM "garage_verification_requests"
      WHERE
        "target" = 'email'::"GarageVerificationTarget"
        AND "tokenHash" = ${tokenHash}
        AND "consumedAt" IS NULL
        AND "expiresAt" > CURRENT_TIMESTAMP
      ORDER BY "createdAt" DESC
      LIMIT 1
    )
    RETURNING "id", "garageId", "target", "targetValue", "tokenHash", "otpHash", "expiresAt", "consumedAt"
  `;
  const request = rows[0];
  if (!request) throw new Error("Verification link is invalid or expired");

  try {
    await db.user.update({
      where: { id: request.garageId },
      data: {
        email: request.targetValue,
        emailVerifiedAt: new Date(),
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new Error("This email is already used by another account");
    }
    throw error;
  }

  return { ok: true as const, message: "Email verified successfully" };
}

export async function verifySupplierMobileWithFirebase(
  supplierId: string,
  firebaseIdToken: string,
) {
  const decodedToken = await verifyFirebaseIdToken(firebaseIdToken);
  const phone = phoneText(decodedToken.phone_number);
  if (!phone) {
    throw new Error("Firebase token does not include a verified mobile number");
  }

  const existing = await db.user.findFirst({
    where: { phone, NOT: { id: supplierId } },
    select: { id: true },
  });
  if (existing) {
    throw new Error("This mobile number is already used by another account");
  }

  await db.user.update({
    where: { id: supplierId },
    data: { phone },
  });

  await db.$executeRaw`
    INSERT INTO "garage_verification_requests" (
      "id",
      "garageId",
      "target",
      "targetValue",
      "otpHash",
      "expiresAt",
      "consumedAt"
    )
    VALUES (
      ${randomUUID()},
      ${supplierId},
      'mobile'::"GarageVerificationTarget",
      ${phone},
      ${hashSecret(phone)},
      CURRENT_TIMESTAMP + INTERVAL '10 minutes',
      CURRENT_TIMESTAMP
    )
  `;

  return getSupplierProfile(supplierId);
}

export async function uploadSupplierAvatar(
  supplierId: string,
  input: AvatarUploadInput,
) {
  const extension = AVATAR_EXTENSIONS[input.contentType];
  if (!extension || input.body.byteLength > MAX_AVATAR_SIZE) {
    throw new Error("Image must be JPG, PNG, or WebP and no larger than 5 MB");
  }

  const current = await db.user.findUnique({
    where: { id: supplierId },
    select: { avatarUrl: true },
  });
  if (!current) throw new Error("Supplier account was not found");

  const key = `supplier-profiles/${supplierId}/avatar/${Date.now()}-${randomUUID()}.${extension}`;
  const uploaded = await uploadObjectToS3({
    key,
    body: input.body,
    contentType: input.contentType,
  });

  await db.user.update({
    where: { id: supplierId },
    data: { avatarUrl: uploaded.objectUrl },
  });

  const oldKey = current.avatarUrl
    ? getS3ObjectKeyFromUrl(current.avatarUrl)
    : null;
  if (oldKey?.startsWith(`supplier-profiles/${supplierId}/avatar/`)) {
    await deleteObjectFromS3(oldKey).catch(() => undefined);
  }

  return getSupplierProfile(supplierId);
}
