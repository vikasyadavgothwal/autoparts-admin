import { db } from "@/lib/database/prisma";

const GARAGE_ADVANCE_KEY = "garage_booking_advance_percentage";
const ADMIN_SUPPORT_EMAILS_KEY = "admin_support_notification_emails";
const DEFAULT_GARAGE_ADVANCE_SETTING: GarageBookingAdvanceSetting = {
  mode: "percentage",
  value: 10,
};

export type GarageBookingAdvanceMode = "percentage" | "fixed";

export type GarageBookingAdvanceSetting = {
  mode: GarageBookingAdvanceMode;
  value: number;
};

const validPercentage = (value: unknown) => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) {
    throw new Error("Advance percentage must be a whole number from 0 to 100");
  }
  return parsed;
};

const validFixedAmount = (value: unknown) => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100000) {
    throw new Error("Advance amount must be from AED 0 to AED 100,000");
  }
  return Math.round(parsed * 100) / 100;
};

const parseGarageBookingAdvanceSetting = (
  value: string,
): GarageBookingAdvanceSetting => {
  const legacyPercentage = Number(value);
  if (Number.isFinite(legacyPercentage)) {
    return { mode: "percentage", value: validPercentage(legacyPercentage) };
  }

  const parsed = JSON.parse(value) as { mode?: unknown; value?: unknown };
  if (parsed.mode === "fixed") {
    return { mode: "fixed", value: validFixedAmount(parsed.value) };
  }
  return { mode: "percentage", value: validPercentage(parsed.value) };
};

export function calculateGarageBookingAdvanceAmount(
  servicePriceMinor: number,
  setting: GarageBookingAdvanceSetting,
) {
  if (setting.mode === "fixed") {
    return Math.min(servicePriceMinor, Math.round(setting.value * 100));
  }
  return Math.round((servicePriceMinor * setting.value) / 100);
}

export async function getGarageBookingAdvanceSetting() {
  const setting = await db.platformSetting.findUnique({ where: { key: GARAGE_ADVANCE_KEY } });
  if (!setting) return DEFAULT_GARAGE_ADVANCE_SETTING;
  try {
    return parseGarageBookingAdvanceSetting(setting.value);
  } catch {
    return DEFAULT_GARAGE_ADVANCE_SETTING;
  }
}

export async function setGarageBookingAdvanceSetting(input: {
  mode?: unknown;
  value?: unknown;
}) {
  const mode = input.mode === "fixed" ? "fixed" : "percentage";
  const setting: GarageBookingAdvanceSetting = {
    mode,
    value:
      mode === "fixed"
        ? validFixedAmount(input.value)
        : validPercentage(input.value),
  };
  await db.platformSetting.upsert({
    where: { key: GARAGE_ADVANCE_KEY },
    create: { key: GARAGE_ADVANCE_KEY, value: JSON.stringify(setting) },
    update: { value: JSON.stringify(setting) },
  });
  return setting;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function getAdminSupportNotificationEmails() {
  const setting = await db.platformSetting.findUnique({
    where: { key: ADMIN_SUPPORT_EMAILS_KEY },
  });
  if (!setting?.value) return [];
  try {
    const parsed = JSON.parse(setting.value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export async function setAdminSupportNotificationEmails(input: unknown) {
  const values = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input.split(/[,\n]/)
      : [];
  const emails = Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean),
    ),
  ).slice(0, 5);

  const invalidEmail = emails.find((email) => !EMAIL_PATTERN.test(email));
  if (invalidEmail) throw new Error(`Invalid support email: ${invalidEmail}`);

  await db.platformSetting.upsert({
    where: { key: ADMIN_SUPPORT_EMAILS_KEY },
    create: { key: ADMIN_SUPPORT_EMAILS_KEY, value: JSON.stringify(emails) },
    update: { value: JSON.stringify(emails) },
  });
  return emails;
}
