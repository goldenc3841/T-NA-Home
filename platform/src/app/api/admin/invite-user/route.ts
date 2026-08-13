import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();

    // 1. Verify requesting user authentication
    const userClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
        },
      }
    );

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Please log in first." }, { status: 401 });
    }

    const body = await request.json();
    const email = body.email;
    const role = body.role || "evaluator";
    const company_id = body.company_id || null;

    if (!email || !email.trim()) {
      return NextResponse.json({ error: "Email address is required." }, { status: 400 });
    }

    if (role === "client_viewer" && !company_id) {
      return NextResponse.json({ error: "Please select a client company for this client user." }, { status: 400 });
    }

    const targetEmail = email.trim().toLowerCase();

    // 2. Initialize Supabase Client for invitation using Service Role Key
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
      return NextResponse.json({
        error: "SUPABASE_SERVICE_ROLE_KEY is missing. Please add your Supabase service_role key (from Supabase Dashboard -> Project Settings -> API) to platform/.env.local and Vercel."
      }, { status: 400 });
    }

    const adminClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 3. Generate Single-Use Valid Invitation Link and User Account
    const origin = new URL(request.url).origin;
    const inviteOptions = {
      redirectTo: `${origin}/update-password`,
      data: {
        full_name: targetEmail,
        role: role,
        company_id: company_id,
      },
    };

    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: "invite",
      email: targetEmail,
      options: inviteOptions,
    });

    if (linkError) {
      return NextResponse.json({ error: linkError.message }, { status: 400 });
    }

    const actionLink = linkData.properties?.action_link || null;
    const inviteMessage = `Invitation generated for ${targetEmail}. Copy and share the invitation link below:`;

    return NextResponse.json({
      success: true,
      message: inviteMessage,
      action_link: actionLink,
      user: linkData.user || null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "An unexpected error occurred." }, { status: 500 });
  }
}
