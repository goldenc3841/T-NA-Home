import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const isApi = request.nextUrl.pathname.startsWith("/api/");
  
  // CORS configuration for Chrome Extension
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  // Intercept and handle OPTIONS preflight checks immediately
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  if (isApi) {
    Object.entries(corsHeaders).forEach(([key, value]) => {
      supabaseResponse.headers.set(key, value);
    });
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          
          // Re-apply CORS headers to new response if request is API
          if (isApi) {
            Object.entries(corsHeaders).forEach(([key, value]) => {
              supabaseResponse.headers.set(key, value);
            });
          }
          
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Retrieve user session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isDashboardPath = request.nextUrl.pathname.startsWith("/dashboard");
  const isLoginPath = request.nextUrl.pathname.startsWith("/login");

  if (!user && isDashboardPath) {
    // Redirect unauthenticated users to login
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isLoginPath) {
    // Redirect logged-in users to the dashboard
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
