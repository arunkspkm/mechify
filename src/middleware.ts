import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Simple middleware that checks for the NextAuth session token cookie.
 * The actual auth validation happens in API routes and server components
 * via the full NextAuth config (with bcryptjs + Prisma).
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow auth API routes and login page
  if (pathname.startsWith("/api/auth") || pathname === "/login") {
    return NextResponse.next();
  }

  // Allow static assets and uploads
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/uploads") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // Check for session token cookie (set by NextAuth)
  const token =
    request.cookies.get("authjs.session-token") ??
    request.cookies.get("__Secure-authjs.session-token");

  if (!token) {
    // API routes: return 401 JSON instead of redirecting
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|uploads/).*)"],
};
