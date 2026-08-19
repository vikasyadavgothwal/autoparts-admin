"use server";

import {
  getAdminSupportNotificationEmails,
  getGarageBookingAdvanceSetting,
  setAdminSupportNotificationEmails,
  setGarageBookingAdvanceSetting,
} from "@/services/platform-settings/platform-settings-service";
import {
  getMainWebsiteSiteSettings,
  setMainWebsiteSiteSettings,
} from "@/services/platform-settings/main-website-site-settings";

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

export const readMainWebsiteSiteSettings = async () =>
  getMainWebsiteSiteSettings();

export const updateMainWebsiteSiteSettings = async (input: unknown) =>
  setMainWebsiteSiteSettings(input);
