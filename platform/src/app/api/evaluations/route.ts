import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase/api";

export async function POST(request: Request) {
  try {
    const supabase = await getSupabaseClient(request);
    const body = await request.json();

    const {
      session_id,
      feature_id,
      rubric_version_id,
      session_name,
      prompt,
      response,
      source_url,
      turn_number,
      scores,
    } = body;

    // Validate essential inputs
    if (!prompt || !response) {
      return NextResponse.json({ error: "Prompt and response text are required" }, { status: 400 });
    }

    // Call atomic RPC function
    const { data: result, error } = await supabase.rpc("submit_evaluation_turn", {
      p_session_id: session_id || null,
      p_feature_id: feature_id || null,
      p_rubric_version_id: rubric_version_id || null,
      p_session_name: session_name || null,
      p_prompt: prompt,
      p_response: response,
      p_source_url: source_url || null,
      p_turn_number: turn_number || null,
      p_scores: scores || [],
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    const error = err as Error;
    console.error("POST Evaluation Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const supabase = await getSupabaseClient(request);
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("company_id");

    let query = supabase
      .from("sessions")
      .select(`
        id,
        name,
        created_at,
        updated_at,
        feature:features!inner (
          id,
          name,
          company:companies!inner (
            id,
            name
          )
        ),
        rubric_version:rubric_versions!inner (
          id,
          rubric:rubrics!inner (
            id,
            title
          )
        ),
        evaluator:profiles (
          id,
          full_name
        ),
        turns (
          id,
          prompt,
          response,
          source_url,
          turn_number,
          created_at,
          scores (
            id,
            value,
            notes,
            criterion:rubric_criteria (
              id,
              name,
              field_type
            )
          )
        )
      `);

    if (companyId) {
      query = query.eq("features.company_id", companyId);
    }

    // Order sessions by last modified
    const { data: sessions, error } = await query.order("updated_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(sessions);
  } catch (err: unknown) {
    const error = err as Error;
    console.error("GET Evaluations Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
