import type { NextRequest } from "next/server";
import { handlers } from "@/auth";

// Auth.js stamps the session cookie with an Expires date, so it survives a browser
// restart. Strip that off the session token: the cookie then lives only for the browser
// session, and closing the browser signs you out. The JWT inside still carries the idle
// expiry (auth.ts), so an abandoned tab expires on its own too.
const SESSION_COOKIE = /^(__Secure-)?authjs\.session-token(\.\d+)?=/;

function browserSessionCookies(res: Response): Response {
  const cookies = res.headers.getSetCookie();
  if (!cookies.some((c) => SESSION_COOKIE.test(c))) return res;
  const headers = new Headers(res.headers);
  headers.delete("set-cookie");
  for (const c of cookies) {
    // leave sign-out's deletion cookie (empty value, Expires in the past) alone
    const strip = SESSION_COOKIE.test(c) && !/^[^=]+=;/.test(c);
    headers.append("set-cookie", strip ? c.replace(/;\s*(Expires|Max-Age)=[^;]*/gi, "") : c);
  }
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

export async function GET(req: NextRequest) {
  return browserSessionCookies(await handlers.GET(req));
}

export async function POST(req: NextRequest) {
  return browserSessionCookies(await handlers.POST(req));
}
