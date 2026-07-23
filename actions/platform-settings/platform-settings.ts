"use server";

import {
  getGarageBookingAdvanceSetting,
  setGarageBookingAdvanceSetting,
} from "@/services/platform-settings/platform-settings-service";

export const readGarageBookingAdvanceSetting = async () =>
  getGarageBookingAdvanceSetting();

export const updateGarageBookingAdvanceSetting = async (input: {
  mode?: unknown;
  value?: unknown;
}) => setGarageBookingAdvanceSetting(input);
