import { NextResponse } from "next/server";
import { auth } from "./auth";
import { privateHeaders, unauthorized } from "./server/responses";
export default auth((request) => {
  const pathname = request.nextUrl.pathname;
  // Filesystem paths never have public routes, including for signed-in visitors.
  if (/^\/(?:private-data|private-media|data|src)(?:\/|$)/.test(pathname) || /\.json$/i.test(pathname) || pathname.startsWith("/photos/")) {
    return new NextResponse(null, { status: 404, headers: privateHeaders });
  }
  if (pathname === "/login" || pathname.startsWith("/api/auth/")) return NextResponse.next({ headers: privateHeaders });
  if (!request.auth?.user) {
    if (pathname === "/api" || pathname.startsWith("/api/")) return unauthorized();
    return NextResponse.redirect(new URL("/login", request.url), { headers: privateHeaders });
  }
  return NextResponse.next({ headers: privateHeaders });
});
export const config = { matcher: ["/((?!_next/static/).*)"] };
