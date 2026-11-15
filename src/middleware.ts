import { NextRequest, NextResponse } from "next/server";

/**
 * Guest identity: an opaque random server-issued token in an HttpOnly,
 * SameSite=Lax cookie (Secure in production). The same token is supplied to
 * the current request's handlers via a rewritten cookie header.
 */
export const GUEST_COOKIE = "rr_guest";

function newToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const TOKEN_RE = /^[A-Za-z0-9_-]{20,}$/;

export function middleware(req: NextRequest) {
  const existing = req.cookies.get(GUEST_COOKIE)?.value;
  if (existing && TOKEN_RE.test(existing)) {
    return NextResponse.next();
  }
  const token = newToken();
  const headers = new Headers(req.headers);
  const prior = req.headers.get("cookie");
  headers.set("cookie", (prior ? prior + "; " : "") + `${GUEST_COOKIE}=${token}`);
  const res = NextResponse.next({ request: { headers } });
  res.cookies.set(GUEST_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365 * 2,
  });
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|hint-images|favicon\\.ico).*)"],
};
