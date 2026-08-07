import { NextRequest, NextResponse } from "next/server";

import { readJsonBody } from "@/lib/auth/api-guards";
import { USER_AUTH } from "@/lib/user-auth/config";
import { changeUserPassword } from "@/services/user-auth/user-auth-service";
import { requireUserAuth } from "@/actions/user-auth/user-auth";

export const dynamic = "force-dynamic";

type ChangePasswordBody = {
  currentPassword?: unknown;
  newPassword?: unknown;
};

const readPassword = (value: unknown) =>
  typeof value === "string" ? value : "";

export async function POST(request: NextRequest) {
  const accessToken =
    request.cookies.get(USER_AUTH.accessCookieName)?.value ?? null;
  const auth = await requireUserAuth(accessToken);
  if (!auth) {
    return NextResponse.json(
      { ok: false, success: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  const parsed = await readJsonBody<ChangePasswordBody>(request);
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, success: false, message: parsed.message },
      { status: 400 },
    );
  }

  try {
    const result = await changeUserPassword({
      userId: auth.user.id,
      currentPassword: readPassword(parsed.body.currentPassword),
      newPassword: readPassword(parsed.body.newPassword),
      firebaseWebApiKey: request.headers.get("x-firebase-web-api-key"),
      firebaseAuthOrigin: request.headers.get("x-firebase-auth-origin"),
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        success: false,
        message:
          error instanceof Error ? error.message : "Unable to change password",
      },
      { status: 400 },
    );
  }
}
