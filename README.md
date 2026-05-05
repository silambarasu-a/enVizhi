# EnVizhi

Stock tracker, screener, and analysis SaaS — NSE / BSE / NYSE / NASDAQ. Quotes are 15-minute delayed; the product targets long-term investing and Peter Lynch–style screening, not day trading.

## Stack

Next.js 16 (App Router) · React 19 · shadcn/ui + Tailwind v4 · PostgreSQL + Prisma 7 · NextAuth v5 (Auth.js) · Inngest (later phases) · Resend.

## Phase 0 status

What's wired:

- Next.js 16 + Tailwind v4 + shadcn (`base-nova`)
- Prisma 7 schema with Auth.js tables (User, Account, Session, VerificationToken)
- NextAuth v5 with email magic link via SMTP (Nodemailer — works with Gmail, Workspace, Fastmail, etc.), with **dev fallback that logs the magic link to the terminal** when `SMTP_*` vars are unset
- Route protection via `src/proxy.ts` (Next 16 middleware)
- Marketing landing (`/`), sign-in (`/signin`), check-email confirmation, protected dashboard (`/dashboard`)
- Corporate dark-first theme (slate-navy + ice-blue accent), JetBrains Mono on numbers
- Sidebar shell with placeholders for Screener / Watchlists / Portfolio / Alerts (marked "soon" until those phases ship)

What's NOT wired yet (later phases):

- Stock universe + nightly fundamentals sync (Phase 1)
- Screener + filter DSL (Phase 2)
- Stock detail + Lynch analysis (Phase 3)
- Watchlists + alerts + email (Phase 4)
- Portfolio tracker (Phase 5)

Plan reference: `~/.claude/plans/i-like-to-create-lovely-meadow.md`.

## Setup

1. **Postgres** — create a Neon project (free), grab both the **pooled** and **direct** connection strings.
2. **Auth secret** — `openssl rand -base64 32`.
3. **SMTP (optional in dev)** — leave the `SMTP_*` vars blank and magic links print to your terminal. To send real email via Gmail:
   1. Enable 2-Step Verification on your Google account.
   2. Create an [App Password](https://myaccount.google.com/apppasswords) ("Mail" → "Other (Custom name)" → "EnVizhi") — copy the 16-char password.
   3. In `.env`: `SMTP_HOST="smtp.gmail.com"`, `SMTP_PORT="587"`, `SMTP_USER="<your gmail>"`, `SMTP_PASS="<16-char app password>"`.
   *Gmail limit:* ~500 emails/day (personal), ~2000/day (Workspace) — fine for beta, swap to a transactional provider before public launch. Any SMTP host works (just change `SMTP_HOST` + creds).
4. Copy `.env.example` → `.env`, fill in the values:
   ```bash
   cp .env.example .env
   ```
5. **Apply schema**:
   ```bash
   npm run db:push        # fast for dev; use db:migrate in production
   ```
6. **Run**:
   ```bash
   npm run dev
   ```
7. Open http://localhost:3000, click "Sign in", enter your email — the magic link will appear in the terminal (or your inbox if Gmail is configured).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server. |
| `npm run build` | `prisma generate` + production Next build. |
| `npm run db:push` | Sync the Prisma schema to the DB without writing a migration (dev-only). |
| `npm run db:migrate` | Create + apply a new migration (use this once you've got users). |
| `npm run db:studio` | Open Prisma Studio. |
| `npm run lint` | ESLint. |
| `npm run test` | Vitest (unit tests for Lynch + portfolio math, added in later phases). |

## Layout

```
src/
  app/
    (auth)/signin/         # public sign-in pages
    (app)/                 # auth-gated routes (dashboard, screener, etc.)
    api/auth/[...nextauth]/  # NextAuth handlers
    layout.tsx, page.tsx, globals.css
  components/
    providers.tsx          # SessionProvider + ThemeProvider
    app-sidebar.tsx
    ui/                    # shadcn primitives
  lib/
    auth.ts                # NextAuth config
    prisma.ts              # Prisma client (PrismaPg adapter, IPv4 fix, warm pool)
    format.ts              # Currency / pct / compact / delta-color formatters
    utils.ts               # cn()
  generated/prisma/        # Prisma client (gitignored)
  proxy.ts                 # Route protection (Next 16 middleware)
prisma/
  schema.prisma
prisma.config.ts
```
