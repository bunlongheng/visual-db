import { NextRequest, NextResponse } from "next/server";
import { checkToken, AUTH_COOKIE } from "@/lib/auth";

// If VISUAL_DB_TOKEN is unset, this is a no-op (local mode). If it is set, every request
// must carry the token. A browser unlocks once by visiting /?token=YOUR_TOKEN - the token
// is moved into an httpOnly cookie and stripped from the URL. API clients may pass it as
// `Authorization: Bearer`, an `x-visual-db-token` header, or `?token=`.
export function middleware(req: NextRequest) {
  const configured = process.env.VISUAL_DB_TOKEN;
  if (!configured) return NextResponse.next();

  const url = new URL(req.url);
  const isApi = url.pathname.startsWith("/api");
  const cookie = req.cookies.get(AUTH_COOKIE)?.value;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const provided =
    url.searchParams.get("token") || req.headers.get("x-visual-db-token") || bearer || undefined;

  const decision = checkToken(configured, cookie, provided);

  if (decision === "ok") {
    // page navigation unlocked via ?token=... : set the cookie and clean the URL
    if (!isApi && !cookie && url.searchParams.has("token")) {
      url.searchParams.delete("token");
      const res = NextResponse.redirect(url);
      res.cookies.set(AUTH_COOKIE, configured, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
      return res;
    }
    return NextResponse.next();
  }

  if (isApi) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return new NextResponse(
    "Visual DB is locked. Append ?token=YOUR_TOKEN to the URL to unlock.",
    { status: 401, headers: { "content-type": "text/plain" } }
  );
}

// run on everything except Next internals + the favicon
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
