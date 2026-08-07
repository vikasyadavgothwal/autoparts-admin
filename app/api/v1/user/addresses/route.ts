import { NextRequest } from "next/server";

import {
  apiCreated,
  apiError,
  apiErrorMessage,
  apiOk,
  readJsonBody,
  withCustomerApiRoute,
} from "@/lib/auth/api-guards";
import {
  createUserAddress,
  listUserAddresses,
} from "@/services/user-addresses/user-address-service";
import type { UserAddressInput } from "@/types/user-addresses/user-addresses";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return withCustomerApiRoute(request, async (user) =>
    apiOk({ addresses: await listUserAddresses(user.id) }),
  );
}

export async function POST(request: NextRequest) {
  return withCustomerApiRoute(request, async (user) => {
    const parsed = await readJsonBody<UserAddressInput>(request);
    if (!parsed.ok) return apiError(parsed.message);

    try {
      return apiCreated({
        address: await createUserAddress(user.id, parsed.body),
      });
    } catch (error) {
      return apiError(apiErrorMessage(error, "Unable to save address"));
    }
  });
}
