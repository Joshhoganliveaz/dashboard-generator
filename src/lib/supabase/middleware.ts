import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export function createClient(request: NextRequest) {
  // Start with a NextResponse that carries the original request headers
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Write cookies to the request so downstream Server Components
          // can read the refreshed token within the same request cycle.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );

          // Recreate the response with the updated request cookies,
          // then write the cookies to the response for the browser.
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  return { supabase, response: supabaseResponse };
}
