import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase/api";

export async function GET(request: Request) {
  try {
    const supabase = await getSupabaseClient(request);
    
    const { data: companies, error } = await supabase
      .from("companies")
      .select("id, name, created_at")
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(companies);
  } catch (err: unknown) {
    const error = err as Error;
    console.error("GET Companies Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
