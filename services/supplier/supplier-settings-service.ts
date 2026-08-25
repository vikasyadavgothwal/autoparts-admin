import { Buffer } from "node:buffer"
import { createHash, randomBytes, randomUUID } from "node:crypto"

import { db } from "@/lib/database/prisma";
import { verifyFirebaseIdToken } from "@/lib/firebase/admin";
import {
  BusinessAccountType,
  BusinessMemberStatus,
  Prisma,
  SupplierApprovalStatus,
} from "@/lib/generated/prisma/client"
import { sendSmtpMail } from "@/lib/email/smtp"
import { logError } from "@/lib/logger"
import {
  deleteObjectFromS3,
  getS3ImageDisplayUrl,
  getS3ObjectKeyFromUrl,
  uploadObjectToS3,
} from "@/lib/storage/s3"
import {
  activeAdminRecipientIds,
  createNotificationsSafely,
  type CreateNotificationInput,
} from "@/services/notifications/notification-service"
import { assertMobileNumberAvailable } from "@/services/user-auth/mobile-availability-service"
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

type DocumentUploadInput = AvatarUploadInput & {
  kind: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_PATTERN = /^\+\d{8,18}$/;
const ADDRESS_LINE_PATTERN = /^[A-Za-z0-9\s.,#'’/&()-]*$/;
const PLACE_NAME_PATTERN = /^[A-Za-z\s.'’()-]*$/;
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const MAX_DOCUMENT_SIZE = 5 * 1024 * 1024;
const MAX_PDF_DOCUMENT_SIZE = 10 * 1024 * 1024;
const TRADE_LICENSE_MIN_LENGTH = 6;
const TRADE_LICENSE_MAX_LENGTH = 30;
const VAT_TRN_MIN_LENGTH = 10;
const VAT_TRN_MAX_LENGTH = 20;
const BANK_IBAN_MAX_LENGTH = 34;
const AVATAR_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const DOCUMENT_EXTENSIONS: Record<string, string> = {
  ...AVATAR_EXTENSIONS,
  "application/pdf": "pdf",
};
const IDENTITY_DOCUMENT_TYPES = new Set(["emirates_id", "passport"]);

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
    throw new Error("Document URL must be a valid HTTP or HTTPS URL");
  }
  return normalized;
};

const normalizeStoredDocumentUrl = (value: unknown) => {
  const normalized = nullableHttpUrl(value);
  if (!normalized) return null;

  const key = getS3ObjectKeyFromUrl(normalized);
  if (!key) return normalized;

  try {
    const url = new URL(normalized);
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return normalized;
  }
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
    return getS3ImageDisplayUrl(imageUrl);
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
      supplierContactPhone: true,
      tradeLicenseImageUrl: true,
      vatTrnNumber: true,
      vatTrnImageUrl: true,
      supplierIdentityDocumentType: true,
      emiratesIdPassportUrl: true,
      emiratesIdBackUrl: true,
      passportAddressUrl: true,
      passportVisaFrontUrl: true,
      bankIban: true,
      bankAccountProofUrl: true,
      marketplaceAgreementAcceptedAt: true,
      firebaseUid: true,
      avatarUrl: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      state: true,
      country: true,
      supplierApprovalStatus: true,
      supplierApprovalRejectionReason: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!supplier) throw new Error("Supplier account was not found");

  const mobileVerifiedAt =
    (await getMobileVerifiedAt(supplier.id, supplier.phone)) ??
    (supplier.phone && supplier.firebaseUid ? supplier.updatedAt : null);
  const supplierContactPhoneVerifiedAt = await getMobileVerifiedAt(
    supplier.id,
    supplier.supplierContactPhone,
  );

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
    supplierContactPhone: supplier.supplierContactPhone,
    supplierContactPhoneVerifiedAt:
      supplierContactPhoneVerifiedAt?.toISOString() ?? null,
    tradeLicenseImageUrl: await publicImageUrl(supplier.tradeLicenseImageUrl),
    vatTrnNumber: supplier.vatTrnNumber,
    vatTrnImageUrl: await publicImageUrl(supplier.vatTrnImageUrl),
    supplierIdentityDocumentType: supplier.supplierIdentityDocumentType,
    emiratesIdPassportUrl: await publicImageUrl(supplier.emiratesIdPassportUrl),
    emiratesIdBackUrl: await publicImageUrl(supplier.emiratesIdBackUrl),
    passportAddressUrl: await publicImageUrl(supplier.passportAddressUrl),
    passportVisaFrontUrl: await publicImageUrl(supplier.passportVisaFrontUrl),
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
    country: supplier.country,
    supplierApprovalStatus: supplier.supplierApprovalStatus,
    supplierApprovalRejectionReason: supplier.supplierApprovalRejectionReason,
    createdAt: supplier.createdAt.toISOString(),
    updatedAt: supplier.updatedAt.toISOString(),
  };
}

export async function getSupplierProfile(supplierId: string) {
  const supplierAccountMembership = await db.businessAccountMember.findFirst({
    where: {
      userId: supplierId,
      status: BusinessMemberStatus.Active,
      businessAccount: {
        type: BusinessAccountType.Supplier,
        isActive: true,
      },
    },
    select: {
      businessAccount: {
        select: { ownerUserId: true },
      },
    },
  })

  const profile = await mapSupplierProfile(supplierId)
  const ownerUserId = supplierAccountMembership?.businessAccount.ownerUserId
  if (!ownerUserId || ownerUserId === supplierId) return profile

  const owner = await db.user.findUnique({
    where: { id: ownerUserId },
    select: {
      supplierApprovalStatus: true,
      supplierApprovalRejectionReason: true,
    },
  })

  return {
    ...profile,
    supplierApprovalStatus:
      owner?.supplierApprovalStatus ?? profile.supplierApprovalStatus,
    supplierApprovalRejectionReason:
      owner?.supplierApprovalRejectionReason ??
      profile.supplierApprovalRejectionReason,
  }
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
  const addressLine1 = nullableText(input.addressLine1, 255);
  const addressLine2 = nullableText(input.addressLine2, 255);
  const city = nullableText(input.city, 120);
  const state = nullableText(input.state, 120);
  const country = nullableText(input.country, 120);
  const tradeLicenseNumber = nullableText(input.tradeLicenseNumber, 100);
  const contactPerson = nullableText(input.contactPerson, 160);
  const designation = nullableText(input.designation, 120);
  const supplierContactPhone = nullableText(input.supplierContactPhone, 40);
  const tradeLicenseImageUrl = normalizeStoredDocumentUrl(input.tradeLicenseImageUrl);
  const vatTrnNumber = nullableText(input.vatTrnNumber, 100);
  const vatTrnImageUrl = normalizeStoredDocumentUrl(input.vatTrnImageUrl);
  const supplierIdentityDocumentType = nullableText(
    input.supplierIdentityDocumentType,
    40,
  );
  const emiratesIdPassportUrl = normalizeStoredDocumentUrl(input.emiratesIdPassportUrl);
  const emiratesIdBackUrl = normalizeStoredDocumentUrl(input.emiratesIdBackUrl);
  const passportAddressUrl = normalizeStoredDocumentUrl(input.passportAddressUrl);
  const passportVisaFrontUrl = normalizeStoredDocumentUrl(input.passportVisaFrontUrl);
  const bankIban = nullableText(input.bankIban, BANK_IBAN_MAX_LENGTH);
  const bankAccountProofUrl = normalizeStoredDocumentUrl(input.bankAccountProofUrl);
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
  if (supplierContactPhone && !MOBILE_PATTERN.test(supplierContactPhone)) {
    throw new Error("Enter a valid supplier contact number");
  }
  if (
    tradeLicenseNumber &&
    (tradeLicenseNumber.length < TRADE_LICENSE_MIN_LENGTH ||
      tradeLicenseNumber.length > TRADE_LICENSE_MAX_LENGTH)
  ) {
    throw new Error(
      `Trade license number must be ${TRADE_LICENSE_MIN_LENGTH}-${TRADE_LICENSE_MAX_LENGTH} characters`,
    );
  }
  if (
    vatTrnNumber &&
    (vatTrnNumber.length < VAT_TRN_MIN_LENGTH ||
      vatTrnNumber.length > VAT_TRN_MAX_LENGTH)
  ) {
    throw new Error(
      `VAT TRN must be ${VAT_TRN_MIN_LENGTH}-${VAT_TRN_MAX_LENGTH} characters`,
    );
  }
  if (addressLine1 && !ADDRESS_LINE_PATTERN.test(addressLine1)) {
    throw new Error("Address line 1 contains invalid characters");
  }
  if (addressLine2 && !ADDRESS_LINE_PATTERN.test(addressLine2)) {
    throw new Error("Address line 2 contains invalid characters");
  }
  if (city && !PLACE_NAME_PATTERN.test(city)) {
    throw new Error("City contains invalid characters");
  }
  if (state && !PLACE_NAME_PATTERN.test(state)) {
    throw new Error("State contains invalid characters");
  }
  if (country && !PLACE_NAME_PATTERN.test(country)) {
    throw new Error("Country contains invalid characters");
  }
  if (bankIban && bankIban.length > BANK_IBAN_MAX_LENGTH) {
    throw new Error(`Bank Account IBAN must be ${BANK_IBAN_MAX_LENGTH} characters or fewer`);
  }
  if (
    supplierIdentityDocumentType &&
    !IDENTITY_DOCUMENT_TYPES.has(supplierIdentityDocumentType)
  ) {
    throw new Error("Choose Emirates ID or Passport as identity document");
  }

  const current = await db.user.findUnique({
    where: { id: supplierId },
    select: {
      email: true,
      phone: true,
      supplierContactPhone: true,
      marketplaceAgreementAcceptedAt: true,
      supplierApprovalStatus: true,
      companyName: true,
      supplierContactPerson: true,
      tradeLicenseImageUrl: true,
      vatTrnImageUrl: true,
      emiratesIdPassportUrl: true,
      emiratesIdBackUrl: true,
      passportAddressUrl: true,
      passportVisaFrontUrl: true,
      bankAccountProofUrl: true,
    },
  });
  if (!current) throw new Error("Supplier account was not found");

  if (phone && phone !== current.phone) {
    const existingPhoneOwner = await db.user.findFirst({
      where: { phone, NOT: { id: supplierId } },
      select: { id: true },
    });
    if (existingPhoneOwner) {
      throw new Error("This authorized phone number is already used by another account");
    }
  }
  if (supplierContactPhone !== current.supplierContactPhone) {
    throw new Error("Verify the supplier contact number with OTP before saving");
  }

  const documentsSubmitted =
    tradeLicenseNumber &&
    tradeLicenseImageUrl &&
    vatTrnNumber &&
    vatTrnImageUrl &&
    supplierIdentityDocumentType &&
    emiratesIdPassportUrl &&
    bankIban &&
    bankAccountProofUrl &&
    marketplaceAgreementAccepted;
  const shouldSubmitForReview =
    Boolean(documentsSubmitted) &&
    current.supplierApprovalStatus !== SupplierApprovalStatus.Approved;

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
      supplierIdentityDocumentType,
      emiratesIdPassportUrl,
      emiratesIdBackUrl,
      passportAddressUrl,
      passportVisaFrontUrl,
      bankIban,
      bankAccountProofUrl,
      marketplaceAgreementAcceptedAt: marketplaceAgreementAccepted
        ? current.marketplaceAgreementAcceptedAt ?? new Date()
        : null,
      firstName,
      lastName,
      addressLine1,
      addressLine2,
      city,
      state,
      country,
      ...(email === current.email ? { email } : {}),
      phone,
      ...(shouldSubmitForReview
        ? {
            supplierApprovalStatus: SupplierApprovalStatus.Pending,
            supplierApprovalRejectionReason: null,
            supplierReviewedAt: null,
            supplierReviewedByAdminId: null,
          }
        : {}),
    },
  });

  await deleteReplacedSupplierDocuments(supplierId, current, {
    tradeLicenseImageUrl,
    vatTrnImageUrl,
    emiratesIdPassportUrl,
    emiratesIdBackUrl,
    passportAddressUrl,
    passportVisaFrontUrl,
    bankAccountProofUrl,
  });

  if (shouldSubmitForReview) {
    await notifyAdminsSupplierDocumentsSubmitted({
      supplierId,
      supplierName:
        companyName ?? current.companyName ?? current.supplierContactPerson ?? "Supplier",
      supplierEmail: email ?? current.email,
    });
  }

  return getSupplierProfile(supplierId);
}

export async function updateSupplierDeveloperProfile(
  supplierId: string,
  input: Record<string, unknown>,
) {
  const field = (name: string, maxLength: number) =>
    Object.hasOwn(input, name) ? nullableText(input[name], maxLength) : undefined;
  const addressLine1 = field("addressLine1", 255);
  const addressLine2 = field("addressLine2", 255);
  const city = field("city", 120);
  const state = field("state", 120);
  const country = field("country", 120);

  if (addressLine1 && !ADDRESS_LINE_PATTERN.test(addressLine1)) {
    throw new Error("Address line 1 contains invalid characters");
  }
  if (addressLine2 && !ADDRESS_LINE_PATTERN.test(addressLine2)) {
    throw new Error("Address line 2 contains invalid characters");
  }
  for (const [label, value] of [["City", city], ["State", state], ["Country", country]] as const) {
    if (value && !PLACE_NAME_PATTERN.test(value)) {
      throw new Error(`${label} contains invalid characters`);
    }
  }

  await db.user.update({
    where: { id: supplierId },
    data: {
      companyName: field("companyName", 160),
      firstName: field("firstName", 100),
      lastName: field("lastName", 100),
      supplierContactPerson: field("contactPerson", 160),
      supplierDesignation: field("designation", 120),
      addressLine1,
      addressLine2,
      city,
      state,
      country,
    },
  });

  return getSupplierProfile(supplierId);
}

type SupplierDocumentUrlField =
  | "tradeLicenseImageUrl"
  | "vatTrnImageUrl"
  | "emiratesIdPassportUrl"
  | "emiratesIdBackUrl"
  | "passportAddressUrl"
  | "passportVisaFrontUrl"
  | "bankAccountProofUrl";

async function deleteReplacedSupplierDocuments(
  supplierId: string,
  current: Record<SupplierDocumentUrlField, string | null>,
  next: Record<SupplierDocumentUrlField, string | null>,
) {
  await Promise.all(
    (Object.keys(next) as SupplierDocumentUrlField[]).map(async (field) => {
      const previousUrl = current[field];
      const nextUrl = next[field];
      if (!previousUrl) return;

      const previousKey = getS3ObjectKeyFromUrl(previousUrl);
      const nextKey = nextUrl ? getS3ObjectKeyFromUrl(nextUrl) : null;
      if (previousKey && previousKey === nextKey) return;

      if (previousKey?.startsWith(`supplier-profiles/${supplierId}/documents/`)) {
        await deleteObjectFromS3(previousKey).catch(() => undefined);
      }
    }),
  );
}

async function notifyAdminsSupplierDocumentsSubmitted(input: {
  supplierId: string;
  supplierName: string;
  supplierEmail: string | null;
}) {
  const [admins, adminIds] = await Promise.all([
    db.admin.findMany({
      where: { isActive: true },
      select: { email: true },
    }),
    activeAdminRecipientIds(),
  ]);
  const recipients = admins.map((admin) => admin.email).filter(Boolean);
  const body = `${input.supplierName} submitted verification documents for admin review.`;

  const notifications: CreateNotificationInput[] = adminIds.map((adminId) => ({
    recipientAdminId: adminId,
    actorUserId: input.supplierId,
    type: "supplier.documents.submitted",
    title: "New supplier documents submitted",
    body,
    linkUrl: "/suppliers",
    entityType: "supplier",
    entityId: input.supplierId,
  }));

  await createNotificationsSafely(notifications);
  if (recipients.length === 0) return;

  await Promise.all(
    recipients.map((to) =>
      sendSmtpMail({
        to,
        subject: "New supplier documents submitted for review",
        text: `A supplier has uploaded verification documents and is waiting for admin review.\n\nSupplier: ${input.supplierName}\nSupplier email: ${input.supplierEmail ?? "Not added"}\nSupplier ID: ${input.supplierId}\n\nPlease check the Supplier Management area in AutoParts Pro Admin.`,
      }).catch((error) => {
        logError("Unable to send supplier document submission email", error);
      }),
    ),
  );
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

  await assertMobileNumberAvailable(supplierId, phone);

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

export async function assertSupplierContactPhoneAvailable(
  supplierId: string,
  value: unknown,
) {
  const phone = phoneText(value);
  if (!phone || !MOBILE_PATTERN.test(phone)) {
    throw new Error("Enter a valid supplier contact number");
  }

  await assertMobileNumberAvailable(supplierId, phone);

  return phone;
}

export async function verifySupplierContactPhoneWithFirebase(
  supplierId: string,
  firebaseIdToken: string,
) {
  const decodedToken = await verifyFirebaseIdToken(firebaseIdToken);
  const phone = phoneText(decodedToken.phone_number);
  if (!phone) {
    throw new Error("Firebase token does not include a verified mobile number");
  }

  await assertSupplierContactPhoneAvailable(supplierId, phone);

  await db.user.update({
    where: { id: supplierId },
    data: { supplierContactPhone: phone },
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

export async function uploadSupplierDocument(
  supplierId: string,
  input: DocumentUploadInput,
) {
  const extension = DOCUMENT_EXTENSIONS[input.contentType];
  const maximumSize =
    input.contentType === "application/pdf"
      ? MAX_PDF_DOCUMENT_SIZE
      : MAX_DOCUMENT_SIZE;
  if (!extension || input.body.byteLength > maximumSize) {
    throw new Error(
      "Document must be JPG, PNG, WebP up to 5 MB, or PDF up to 10 MB",
    );
  }

  const supplier = await db.user.findUnique({
    where: { id: supplierId },
    select: { id: true },
  });
  if (!supplier) throw new Error("Supplier account was not found");

  const cleanKind =
    input.kind.trim().replace(/[^a-z0-9_-]/gi, "-").toLowerCase() ||
    "document";
  const key = `supplier-profiles/${supplierId}/documents/${cleanKind}-${Date.now()}-${randomUUID()}.${extension}`;
  const uploaded = await uploadObjectToS3({
    key,
    body: input.body,
    contentType: input.contentType,
  });

  return { documentUrl: uploaded.objectUrl };
}
