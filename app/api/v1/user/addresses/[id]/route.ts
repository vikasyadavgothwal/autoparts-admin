import { NextRequest } from "next/server";

import {
  apiError,
  apiErrorMessage,
  apiOk,
  readJsonBody,
  withCustomerApiRoute,
} from "@/lib/auth/api-guards";
import {
  deleteUserAddress,
  updateUserAddress,
} from "@/services/user-addresses/user-address-service";
import type { UserAddressInput } from "@/types/user-addresses/user-addresses";

export const dynamic = "force-dynamic";

type AddressContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: AddressContext) {
  return withCustomerApiRoute(request, async (user) => {
    const parsed = await readJsonBody<UserAddressInput>(request);
    if (!parsed.ok) return apiError(parsed.message);

    try {
      const { id } = await context.params;
      return apiOk({
        address: await updateUserAddress(user.id, id, parsed.body),
      });
    } catch (error) {
      return apiError(apiErrorMessage(error, "Unable to update address"));
    }
  });
}

export async function DELETE(request: NextRequest, context: AddressContext) {
  return withCustomerApiRoute(request, async (user) => {
    try {
      const { id } = await context.params;
      return apiOk(await deleteUserAddress(user.id, id));
    } catch (error) {
      return apiError(apiErrorMessage(error, "Unable to delete address"));
    }
  });
}
