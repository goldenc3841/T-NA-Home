import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase/api";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ featureId: string }> }
) {
  try {
    const { featureId } = await params;
    const supabase = await getSupabaseClient(request);

    // Query sessions along with turns relation count
    const { data: sessions, error } = await supabase
      .from("sessions")
      .select(`
        id,
        name,
        created_at,
        turns (id)
      `)
      .eq("feature_id", featureId)
      .order("updated_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Map to include a clean turns count
    const formatted = (sessions || []).map((s: { 
      id: string; 
      name: string; 
      created_at: string; 
      turns: Array<{ id: string }> | null;
    }) => ({
      id: s.id,
      name: s.name,
      created_at: s.created_at,
      turns_count: s.turns ? s.turns.length : 0,
    }));

    return NextResponse.json(formatted);
  } catch (err: unknown) {
    const error = err as Error;
    console.error("GET Feature Sessions Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
