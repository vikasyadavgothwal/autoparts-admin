import { db } from "@/lib/database/prisma";
import type {
  UserAddressInput,
  UserAddressRecord,
} from "@/types/user-addresses/user-addresses";

const POSTAL_CODE_PATTERN = /^[A-Za-z0-9 -]{3,20}$/;
const PHONE_PATTERN = /^\+?[0-9][0-9\s()-]{6,24}$/;

const compactText = (value: unknown) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";

const requiredText = (value: unknown, label: string, maxLength: number) => {
  const normalized = compactText(value);
  if (!normalized) throw new Error(`${label} is required`);
  if (normalized.length > maxLength) {
    throw new Error(`${label} must be ${maxLength} characters or fewer`);
  }
  return normalized;
};

const optionalText = (value: unknown, maxLength: number) => {
  const normalized = compactText(value);
  if (!normalized) return null;
  if (normalized.length > maxLength) {
    throw new Error(`Value must be ${maxLength} characters or fewer`);
  }
  return normalized;
};

const normalizeInput = (input: UserAddressInput) => {
  const phone = requiredText(input.phone, "Phone", 32);
  const postalCode = requiredText(input.postalCode, "Postal code", 20);

  if (!PHONE_PATTERN.test(phone)) {
    throw new Error("Enter a valid phone number");
  }
  if (!POSTAL_CODE_PATTERN.test(postalCode)) {
    throw new Error("Enter a valid postal code");
  }

  return {
    label: requiredText(input.label, "Address label", 60),
    recipientName: requiredText(input.recipientName, "Recipient name", 120),
    phone,
    addressLine1: requiredText(input.addressLine1, "Address line 1", 255),
    addressLine2: optionalText(input.addressLine2, 255),
    landmark: optionalText(input.landmark, 160),
    city: requiredText(input.city, "City", 120),
    state: requiredText(input.state, "State", 120),
    postalCode,
    country: requiredText(input.country, "Country", 120),
    isDefault: Boolean(input.isDefault),
  };
};

const mapAddress = (address: {
  id: string;
  label: string;
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}): UserAddressRecord => ({
  ...address,
  createdAt: address.createdAt.toISOString(),
  updatedAt: address.updatedAt.toISOString(),
});

export async function listUserAddresses(userId: string) {
  let addresses = await db.userAddress.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  if (!addresses.length) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        companyName: true,
        phone: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        state: true,
        postalCode: true,
        country: true,
      },
    });

    if (
      user?.phone &&
      user.addressLine1 &&
      user.city &&
      user.state &&
      user.postalCode &&
      user.country
    ) {
      const recipientName =
        [user.firstName, user.lastName].filter(Boolean).join(" ") ||
        user.companyName ||
        "Customer";
      const address = await db.userAddress.create({
        data: {
          userId,
          label: "Default",
          recipientName,
          phone: user.phone,
          addressLine1: user.addressLine1,
          addressLine2: user.addressLine2,
          city: user.city,
          state: user.state,
          postalCode: user.postalCode,
          country: user.country,
          isDefault: true,
        },
      });
      addresses = [address];
    }
  }

  return addresses.map(mapAddress);
}

export async function createUserAddress(
  userId: string,
  input: UserAddressInput,
) {
  const data = normalizeInput(input);
  return db.$transaction(async (transaction) => {
    const existingCount = await transaction.userAddress.count({
      where: { userId },
    });
    const shouldBeDefault = data.isDefault || existingCount === 0;

    if (shouldBeDefault) {
      await transaction.userAddress.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const address = await transaction.userAddress.create({
      data: {
        ...data,
        isDefault: shouldBeDefault,
        userId,
      },
    });
    return mapAddress(address);
  });
}

export async function updateUserAddress(
  userId: string,
  addressId: string,
  input: UserAddressInput,
) {
  const data = normalizeInput(input);
  return db.$transaction(async (transaction) => {
    const existing = await transaction.userAddress.findFirst({
      where: { id: addressId, userId },
      select: { id: true },
    });
    if (!existing) throw new Error("Address was not found");

    if (data.isDefault) {
      await transaction.userAddress.updateMany({
        where: { userId, isDefault: true, NOT: { id: addressId } },
        data: { isDefault: false },
      });
    }

    const address = await transaction.userAddress.update({
      where: { id: addressId },
      data,
    });
    return mapAddress(address);
  });
}

export async function deleteUserAddress(userId: string, addressId: string) {
  return db.$transaction(async (transaction) => {
    const existing = await transaction.userAddress.findFirst({
      where: { id: addressId, userId },
      select: { id: true, isDefault: true },
    });
    if (!existing) throw new Error("Address was not found");

    await transaction.userAddress.delete({ where: { id: addressId } });

    if (existing.isDefault) {
      const nextAddress = await transaction.userAddress.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      if (nextAddress) {
        await transaction.userAddress.update({
          where: { id: nextAddress.id },
          data: { isDefault: true },
        });
      }
    }

    return { ok: true as const };
  });
}

export async function getUserAddressForCheckout(
  userId: string,
  addressId: string,
) {
  const address = await db.userAddress.findFirst({
    where: { id: addressId, userId },
  });
  if (!address) throw new Error("Select a delivery address before checkout");
  return address;
}
