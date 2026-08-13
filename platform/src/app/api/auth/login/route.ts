import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    
    // Authenticate user
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (!data.session) {
      return NextResponse.json({ error: "No active session found" }, { status: 401 });
    }

    // Retrieve corresponding evaluator profile details
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", data.user.id)
      .single();

    const userEmail = (data.user.email || "").toLowerCase();
    const isAdminEmail = ["goldenc5310@gmail.com", "pisurajc@gmail.com"].includes(userEmail);
    const resolvedRole = isAdminEmail ? "admin" : (profile?.role || "evaluator");

    return NextResponse.json({
      token: data.session.access_token,
      user: {
        email: data.user.email,
        name: profile?.full_name || data.user.email,
        role: resolvedRole,
      },
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("Login API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
