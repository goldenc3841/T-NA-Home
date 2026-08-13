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

    // 3. Send User Invitation via Email and ALWAYS Generate Direct Invite Link
    const origin = new URL(request.url).origin;
    const inviteOptions = {
      redirectTo: `${origin}/auth/callback?next=/update-password`,
      data: {
        full_name: targetEmail,
        role: role,
        company_id: company_id,
      },
    };

    let actionLink: string | null = null;
    let inviteMessage = `Invitation created for ${targetEmail}`;

    // 3a. Generate direct invitation link
    const { data: linkData } = await adminClient.auth.admin.generateLink({
      type: "invite",
      email: targetEmail,
      options: inviteOptions,
    });

    if (linkData?.properties?.action_link) {
      actionLink = linkData.properties.action_link;
    }

    // 3b. Attempt sending automated invite email via Supabase SMTP
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      targetEmail,
      inviteOptions
    );

    if (inviteError) {
      inviteMessage = `Direct invitation link generated for ${targetEmail}. (Email notice: ${inviteError.message})`;
    } else {
      inviteMessage = `Invitation email sent to ${targetEmail}. You can also copy the direct invitation link below:`;
    }

    return NextResponse.json({
      success: true,
      message: inviteMessage,
      action_link: actionLink,
      user: inviteData?.user || linkData?.user || null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "An unexpected error occurred." }, { status: 500 });
  }
}
