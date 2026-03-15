import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes without authentication
  if (
    pathname === "/login" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/d/") || // published dashboards are public
    pathname.endsWith(".html")
  ) {
    return NextResponse.next();
  }

  const { supabase, response } = createClient(request);

  // IMPORTANT: use getClaims() not getSession() -- getClaims() validates
  // the JWT signature server-side, while getSession() does not revalidate.
  const { data: claims, error } = await supabase.auth.getClaims();

  if (error || !claims) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Return the supabase response which carries refreshed session cookies
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
