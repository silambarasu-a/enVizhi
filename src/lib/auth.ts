import NextAuth from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { compare } from "bcryptjs";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { sendMagicLinkEmail } from "@/lib/auth-email";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const MAIL_FROM = process.env.MAIL_FROM ?? (SMTP_USER ? `EnVizhi <${SMTP_USER}>` : undefined);

const hasSmtpCreds = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

// ─── Email magic-link provider ──────────────────────────────────────────────

const devLogProvider = Nodemailer({
  server: { host: "localhost", port: 25, auth: { user: "dev", pass: "dev" } },
  from: "EnVizhi <dev@localhost>",
  async sendVerificationRequest({ identifier, url }) {
    console.log("\n────────────────────────────────────────────────────────────");
    console.log(`🔗 [vizhi dev] magic link for ${identifier}`);
    console.log(`   ${url}`);
    console.log("────────────────────────────────────────────────────────────\n");
  },
});

const liveProviderServer = {
  host: SMTP_HOST!,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: { user: SMTP_USER!, pass: SMTP_PASS! },
};

const liveProvider = Nodemailer({
  server: liveProviderServer,
  from: MAIL_FROM,
  async sendVerificationRequest({ identifier, url }) {
    await sendMagicLinkEmail({
      identifier,
      url,
      provider: { server: liveProviderServer, from: MAIL_FROM },
    });
  },
});

// ─── Google OAuth provider (optional) ───────────────────────────────────────

const hasGoogleCreds = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

const googleProvider = hasGoogleCreds
  ? Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // Trust Google's email-verified flag and link to an existing User by email.
      // Safe because Google verifies before allowing OAuth, so the holder of the
      // Google account demonstrably owns the email.
      allowDangerousEmailAccountLinking: true,
    })
  : null;

export const isGoogleEnabled = hasGoogleCreds;

// ─── Credentials (email + password) provider ────────────────────────────────

const credentialsProvider = Credentials({
  name: "credentials",
  credentials: {
    email: { label: "Email", type: "email" },
    password: { label: "Password", type: "password" },
  },
  async authorize(credentials) {
    const email = String(credentials?.email ?? "").trim().toLowerCase();
    const password = String(credentials?.password ?? "");
    if (!email || !password) return null;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) return null;

    const ok = await compare(password, user.passwordHash);
    if (!ok) return null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      baseCurrency: user.baseCurrency,
    };
  },
});

// ─── NextAuth config ────────────────────────────────────────────────────────
// Sessions are JWT — required because Credentials provider doesn't support
// database sessions. The PrismaAdapter is still used for User / Account /
// VerificationToken management; only Session table goes unused.

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/signin",
    verifyRequest: "/signin/check-email",
    error: "/signin",
  },
  providers: [
    hasSmtpCreds ? liveProvider : devLogProvider,
    credentialsProvider,
    ...(googleProvider ? [googleProvider] : []),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.baseCurrency = (user as typeof user & { baseCurrency?: string }).baseCurrency ?? "USD";
      }
      // Hydrate from DB for magic-link sign-ins (Auth.js doesn't pass `user.id` cleanly otherwise).
      if (!token.id && token.email) {
        const u = await prisma.user.findUnique({
          where: { email: String(token.email) },
          select: { id: true, baseCurrency: true },
        });
        if (u) {
          token.id = u.id;
          token.baseCurrency = u.baseCurrency;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        if (token.id) session.user.id = String(token.id);
        if (token.baseCurrency) session.user.baseCurrency = String(token.baseCurrency);
        else session.user.baseCurrency = "USD";
      }
      return session;
    },
  },
  events: {
    /**
     * Auto-mark `emailVerified` for OAuth providers that have already verified
     * the email themselves (Google requires email verification before issuing
     * an OAuth code). Fires on every sign-in but is a single-row no-op when
     * already verified — so existing accounts get fixed up on their next
     * Google sign-in.
     */
    async signIn({ user, account }) {
      if (!user?.id || !account) return;
      const TRUSTED_PROVIDERS = new Set(["google"]);
      if (!TRUSTED_PROVIDERS.has(account.provider)) return;
      try {
        await prisma.user.updateMany({
          where: { id: user.id, emailVerified: null },
          data: { emailVerified: new Date() },
        });
      } catch (err) {
        console.error("[auth] failed to auto-mark emailVerified:", err);
      }
    },
  },
});
