import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

// Owner-gated Google sign-in. Only emails in ALLOWED_EMAILS (comma-separated) may
// sign in - everyone else is rejected at the callback. Auth is ACTIVE whenever the
// Google credentials are configured; without them the app falls back to the
// VISUAL_DB_TOKEN gate / local-only mode (see middleware.ts).
const allowed = (process.env.ALLOWED_EMAILS || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

// Sessions are deliberately short-lived. The JWT carries its own expiry, so a tab that
// is closed - or simply left alone - stops refreshing it and the session dies on its own.
// Tune with IDLE_TIMEOUT_MINUTES (default 15).
export const IDLE_MINUTES = Math.max(1, Number(process.env.IDLE_TIMEOUT_MINUTES) || 15);

export const authEnabled = !!(
  (process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID) &&
  (process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET)
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true, // Vercel sets this automatically; needed for localhost/self-hosted
  pages: { signIn: "/signin" }, // branded page; the Auth.js default breaks under our CSP
  // idle window; the cookie itself is downgraded to a browser-session cookie in
  // app/api/auth/[...nextauth]/route.ts so closing the browser also ends the session
  session: { strategy: "jwt", maxAge: IDLE_MINUTES * 60 },

  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    signIn({ profile }) {
      const email = profile?.email?.toLowerCase();
      return !!email && allowed.includes(email);
    },
  },
});
