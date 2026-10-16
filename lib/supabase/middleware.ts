
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const redirect = (pathname: string) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = "";
    const result = NextResponse.redirect(url);
    response.cookies.getAll().forEach(cookie => result.cookies.set(cookie));
    result.headers.set("Cache-Control", "private, no-store");
    return result;
  };

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Get the current request path
  const path = request.nextUrl.pathname;

  // Public routes accessible without login
  const publicRoute =
    path === "/login" ||
    path === "/forgot-password" ||
    path === "/reset-password" ||
    path.startsWith("/auth/");

  // Verify the current user
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // Redirect unauthenticated users to login
  if ((!user || error) && !publicRoute) {
    return redirect("/login");
  }

  // Redirect logged-in users away from login
  if (user && path === "/login") {
    return redirect("/");
  }

  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
