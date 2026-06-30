import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase/api";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const supabase = await getSupabaseClient(request);

    const { data: features, error } = await supabase
      .from("features")
      .select("id, name, description, created_at")
      .eq("company_id", companyId)
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(features);
  } catch (err: unknown) {
    const error = err as Error;
    console.error("GET Features Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
