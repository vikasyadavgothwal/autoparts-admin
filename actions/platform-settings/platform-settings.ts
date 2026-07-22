"use server";

import {
  getGarageBookingAdvancePercentage,
  setGarageBookingAdvancePercentage,
} from "@/services/platform-settings/platform-settings-service";

export const readGarageBookingAdvancePercentage = async () =>
  getGarageBookingAdvancePercentage();

export const updateGarageBookingAdvancePercentage = async (value: unknown) =>
  setGarageBookingAdvancePercentage(value);
