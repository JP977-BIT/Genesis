import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  // Start with a mutable copy of headers
  // Strip any client-provided x-user-id — prevents forgery
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("x-user-id");

  // Collect cookies that getUser() wants to refresh
  // We apply them after, so we can build one clean response at the end
  const pendingCookies: Array<{
    name: string;
    value: string;
    options: Record<string, unknown>;
  }> = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          // Collect instead of building a response here
          pendingCookies.push(...cookiesToSet);
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Stamp the verified user ID — route handlers read this instead of calling getUser()
  if (user) {
    requestHeaders.set("x-user-id", user.id);
  }

  // Build one clean response with the stamped headers
  const supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Apply any session-refresh cookies collected above
  pendingCookies.forEach(({ name, value, options }) =>
    supabaseResponse.cookies.set(name, value, options),
  );

  const isLoginPage = request.nextUrl.pathname.startsWith("/login");

  if (!user && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/company-select";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
