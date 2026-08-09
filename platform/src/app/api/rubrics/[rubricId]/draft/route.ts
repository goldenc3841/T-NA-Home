import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase/api";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ rubricId: string }> }
) {
  try {
    const { rubricId } = await params;
    const supabase = await getSupabaseClient(request);
    const { title } = await request.json();

    const { error } = await supabase
      .from("rubrics")
      .update({ title })
      .eq("id", rubricId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("POST Draft Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
