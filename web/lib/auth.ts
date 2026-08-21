// Optional token gate. Visual DB is local-only by default (no auth). If VISUAL_DB_TOKEN
// is set, the web app requires it - which makes the tool safe to expose on a host.
// This decision is a pure function so it can be unit-tested; middleware.ts wires it up.

export type AuthDecision = "open" | "ok" | "deny";

// Constant-time-ish string compare (avoids trivial timing leaks on the token).
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function checkToken(
  configured: string | undefined,
  cookie: string | undefined,
  provided: string | undefined
): AuthDecision {
  if (!configured) return "open"; // no token set -> local mode, no gate
  if (cookie && safeEqual(cookie, configured)) return "ok";
  if (provided && safeEqual(provided, configured)) return "ok";
  return "deny";
}

export const AUTH_COOKIE = "vdb_auth";
