import { NextRequest, NextResponse } from "next/server";
import { auth, authEnabled } from "@/auth";
import { checkToken, AUTH_COOKIE } from "@/lib/auth";

// Access model, first match wins:
//   1. Google session (owner allowlist via ALLOWED_EMAILS) - the human path when
//      AUTH_GOOGLE_ID/SECRET are configured (e.g. the Vercel deployment).
//   2. VISUAL_DB_TOKEN - the agent/API path (Bearer, x-visual-db-token, or ?token=).
//   3. Neither configured -> open local mode (localhost dev against your own DB).
async function gate(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const isApi = url.pathname.startsWith("/api");

  // token gate (works with or without Google auth - lets agents call the API)
  const configured = process.env.VISUAL_DB_TOKEN;
  if (configured) {
    const cookie = req.cookies.get(AUTH_COOKIE)?.value;
    const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const provided =
      url.searchParams.get("token") || req.headers.get("x-visual-db-token") || bearer || undefined;
    if (checkToken(configured, cookie, provided) === "ok") {
      if (!isApi && !cookie && url.searchParams.has("token")) {
        url.searchParams.delete("token");
        const res = NextResponse.redirect(url);
        res.cookies.set(AUTH_COOKIE, configured, { httpOnly: true, sameSite: "lax", path: "/" });
        return res;
      }
      return NextResponse.next();
    }
  }

  // Google session gate
  if (authEnabled) {
    const session = await auth();
    if (session?.user) return NextResponse.next();
    if (isApi) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const signin = new URL("/api/auth/signin", req.url);
    signin.searchParams.set("callbackUrl", url.pathname + url.search);
    return NextResponse.redirect(signin);
  }

  // no Google auth configured
  if (configured) {
    // token-only mode and the token did not match
    if (isApi) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    return new NextResponse(
      "Visual DB is locked. Append ?token=YOUR_TOKEN to the URL to unlock.",
      { status: 401, headers: { "content-type": "text/plain" } }
    );
  }
  return NextResponse.next(); // open local mode
}

export function middleware(req: NextRequest) {
  // the auth endpoints themselves must stay reachable to sign in
  if (new URL(req.url).pathname.startsWith("/api/auth")) return NextResponse.next();
  return gate(req);
}

// run on everything except Next internals + the favicon
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
