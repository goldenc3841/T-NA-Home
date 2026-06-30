import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "./server";

/**
 * Returns an authenticated Supabase client.
 * If the request contains an Authorization: Bearer <JWT> header (from Chrome Extension),
 * it returns a client configured with that JWT.
 * Otherwise, it falls back to the server component cookie-based client.
 */
export async function getSupabaseClient(request: Request) {
  const authHeader = request.headers.get("Authorization");
  
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    return createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        auth: {
          persistSession: false,
        },
      }
    );
  }

  // Fallback to cookie client
  return await createServerClient();
}
