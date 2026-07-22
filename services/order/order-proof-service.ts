import { db } from "@/lib/database/prisma";

export async function findOrderProofKeyForUser(input: {
  orderId: string;
  userId: string;
}): Promise<string | null> {
  // FIX: Keep proof-of-delivery ownership lookup out of the route handler.
  const order = await db.order.findFirst({
    where: {
      OR: [{ id: input.orderId }, { publicId: input.orderId }],
      AND: [
        {
          OR: [{ buyerId: input.userId }, { supplierId: input.userId }],
        },
      ],
    },
    select: { proofOfDeliveryKey: true },
  });

  return order?.proofOfDeliveryKey ?? null;
}
