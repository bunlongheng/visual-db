"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authEnabled, signOut } from "@/auth";
import { AUTH_COOKIE } from "@/lib/auth";

// One sign-out for both access paths: the Google session (Auth.js) and the shared-token
// cookie a browser was unlocked with. Called by the sidebar button and by the idle timer.
export async function logout(formData: FormData) {
  const idle = formData.get("reason") === "idle";
  (await cookies()).delete(AUTH_COOKIE);

  // token-only mode has no sign-in page - middleware shows the locked notice at /
  if (!authEnabled) redirect("/");
  await signOut({ redirectTo: `/signin?reason=${idle ? "idle" : "signout"}` });
}
