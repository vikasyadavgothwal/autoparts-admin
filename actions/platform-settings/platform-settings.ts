"use server";

import {
  getAdminSupportNotificationEmails,
  getGarageBookingAdvanceSetting,
  setAdminSupportNotificationEmails,
  setGarageBookingAdvanceSetting,
} from "@/services/platform-settings/platform-settings-service";

export const readGarageBookingAdvanceSetting = async () =>
  getGarageBookingAdvanceSetting();

export const updateGarageBookingAdvanceSetting = async (input: {
  mode?: unknown;
  value?: unknown;
}) => setGarageBookingAdvanceSetting(input);

export const readAdminSupportNotificationEmails = async () =>
  getAdminSupportNotificationEmails();

export const updateAdminSupportNotificationEmails = async (input: unknown) =>
  setAdminSupportNotificationEmails(input);
