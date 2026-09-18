import { cookies } from "next/headers";
import { auth, authEnabled, IDLE_MINUTES } from "@/auth";
import { AUTH_COOKIE } from "@/lib/auth";
import { logout } from "@/lib/actions";
import AccountMenu from "./AccountMenu";

// Sidebar account block. Renders nothing in open local mode - there is no session to end.
export default async function Account() {
  const session = authEnabled ? await auth() : null;
  const token = !!process.env.VISUAL_DB_TOKEN && !!(await cookies()).get(AUTH_COOKIE);
  if (!session?.user && !token) return null;

  return (
    <AccountMenu
      label={session?.user?.email || session?.user?.name || "token session"}
      idleMinutes={IDLE_MINUTES}
      rolling={!!session?.user}
      logout={logout}
    />
  );
}
