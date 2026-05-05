import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Phase 0: only /dashboard is protected. As phases land, add screener/watchlists/portfolio/alerts.
const PROTECTED_PATHS = [
  "/dashboard",
  "/screener",
  "/watchlists",
  "/portfolio",
  "/alerts",
  "/stock",
  "/profile",
];

const SESSION_COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
];

function hasSessionCookie(request: NextRequest) {
  return SESSION_COOKIE_NAMES.some((name) => request.cookies.has(name));
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );

  if (!isProtected) return NextResponse.next();

  if (hasSessionCookie(request)) return NextResponse.next();

  const signInUrl = new URL("/signin", request.url);
  signInUrl.searchParams.set("callbackUrl", pathname);
  return NextResponse.redirect(signInUrl);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
