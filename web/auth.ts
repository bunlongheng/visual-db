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

export const authEnabled = !!(
  (process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID) &&
  (process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET)
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true, // Vercel sets this automatically; needed for localhost/self-hosted
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
