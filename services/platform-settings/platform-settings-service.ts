import { db } from "@/lib/database/prisma";

const GARAGE_ADVANCE_KEY = "garage_booking_advance_percentage";
const DEFAULT_GARAGE_ADVANCE_PERCENTAGE = 10;

const validPercentage = (value: unknown) => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) {
    throw new Error("Advance percentage must be a whole number from 0 to 100");
  }
  return parsed;
};

export async function getGarageBookingAdvancePercentage() {
  const setting = await db.platformSetting.findUnique({ where: { key: GARAGE_ADVANCE_KEY } });
  if (!setting) return DEFAULT_GARAGE_ADVANCE_PERCENTAGE;
  try { return validPercentage(setting.value); } catch { return DEFAULT_GARAGE_ADVANCE_PERCENTAGE; }
}

export async function setGarageBookingAdvancePercentage(value: unknown) {
  const percentage = validPercentage(value);
  await db.platformSetting.upsert({
    where: { key: GARAGE_ADVANCE_KEY },
    create: { key: GARAGE_ADVANCE_KEY, value: String(percentage) },
    update: { value: String(percentage) },
  });
  return percentage;
}
