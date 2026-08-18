import { randomBytes, randomUUID, createHash } from "node:crypto";

import { db } from "@/lib/database/prisma";
import { verifyFirebaseIdToken } from "@/lib/firebase/admin";
import { Prisma } from "@/lib/generated/prisma/client";
import { assertMobileNumberAvailable } from "@/services/user-auth/mobile-availability-service";
import type {
  UserProfileInput,
  UserProfileRecord,
  UserVerificationResponse,
} from "@/types/user/settings";

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

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_PATTERN = /^\+\d{8,18}$/;
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

async function mapUserProfile(userId: string): Promise<UserProfileRecord> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      publicId: true,
      companyName: true,
      firstName: true,
      lastName: true,
      email: true,
      emailVerifiedAt: true,
      phone: true,
      firebaseUid: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      state: true,
      postalCode: true,
      country: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) throw new Error("User account was not found");

  const mobileVerifiedAt =
    (await getMobileVerifiedAt(user.id, user.phone)) ??
    (user.phone && user.firebaseUid ? user.updatedAt : null);

  return {
    id: user.id,
    publicId: user.publicId,
    companyName: user.companyName,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    phone: user.phone,
    mobileVerifiedAt: mobileVerifiedAt?.toISOString() ?? null,
    addressLine1: user.addressLine1,
    addressLine2: user.addressLine2,
    city: user.city,
    state: user.state,
    postalCode: user.postalCode,
    country: user.country,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export async function getUserProfile(userId: string) {
  return mapUserProfile(userId);
}

export async function updateUserProfile(
  userId: string,
  input: UserProfileInput,
) {
  const companyName = nullableText(input.companyName, 160);
  const firstName = nullableText(input.firstName, 100);
  const lastName = nullableText(input.lastName, 100);
  const email = nullableText(input.email, 254)?.toLowerCase() ?? null;
  const phone = nullableText(input.phone, 40);
  const postalCode = nullableText(input.postalCode, 40);

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
    where: { id: userId },
    select: { email: true, phone: true },
  });
  if (!current) throw new Error("User account was not found");

  await db.user.update({
    where: { id: userId },
    data: {
      companyName,
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

  return getUserProfile(userId);
}

export async function requestUserEmailVerification(
  userId: string,
  requestedEmail: unknown,
  origin: string,
  verificationBaseUrl?: string | null,
): Promise<UserVerificationResponse> {
  const email = nullableText(requestedEmail, 254)?.toLowerCase() ?? null;
  if (!email) throw new Error("Add an email before verification");
  if (!EMAIL_PATTERN.test(email))
    throw new Error("Enter a valid email address");

  const existing = await db.user.findFirst({
    where: { email, NOT: { id: userId } },
    select: { id: true },
  });
  if (existing)
    throw new Error("This email is already used by another account");

  const profile = await getUserProfile(userId);
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
      ${userId},
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
    ? `${cleanVerificationBaseUrl}/api/settings/verify-email?token=${token}`
    : `${origin.replace(/\/+$/, "")}/api/v1/user/settings/verify-email?token=${token}`;
  const sent = await sendWebhook(
    process.env.USER_EMAIL_VERIFICATION_WEBHOOK_URL ??
      process.env.FLEET_EMAIL_VERIFICATION_WEBHOOK_URL ??
      process.env.GARAGE_EMAIL_VERIFICATION_WEBHOOK_URL,
    {
      to: email,
      verificationLink,
      accountType: "User",
    },
  );

  return {
    ok: true,
    message: sent
      ? "Verification link sent"
      : "Verification link created. Configure USER_EMAIL_VERIFICATION_WEBHOOK_URL to send it automatically.",
    ...(process.env.NODE_ENV !== "production" ? { verificationLink } : {}),
  };
}

export async function verifyUserEmail(token: string) {
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

export async function verifyUserMobileWithFirebase(
  userId: string,
  firebaseIdToken: string,
) {
  const decodedToken = await verifyFirebaseIdToken(firebaseIdToken);
  const phone = phoneText(decodedToken.phone_number);
  if (!phone) {
    throw new Error("Firebase token does not include a verified mobile number");
  }

  await assertMobileNumberAvailable(userId, phone);

  await db.user.update({
    where: { id: userId },
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
      ${userId},
      'mobile'::"GarageVerificationTarget",
      ${phone},
      ${hashSecret(phone)},
      CURRENT_TIMESTAMP + INTERVAL '10 minutes',
      CURRENT_TIMESTAMP
    )
  `;

  return getUserProfile(userId);
}
