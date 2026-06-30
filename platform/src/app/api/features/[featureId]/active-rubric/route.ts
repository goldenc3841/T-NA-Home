import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase/api";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ featureId: string }> }
) {
  try {
    const { featureId } = await params;
    const supabase = await getSupabaseClient(request);

    // 1. Fetch feature to resolve company_id
    const { data: feature, error: featureError } = await supabase
      .from("features")
      .select("company_id")
      .eq("id", featureId)
      .single();

    if (featureError || !feature) {
      return NextResponse.json({ error: "Feature not found" }, { status: 404 });
    }

    // 2. Fetch the company's rubrics and filter for the active version
    const { data: rubrics, error: rubricError } = await supabase
      .from("rubrics")
      .select(`
        id,
        title,
        description,
        rubric_versions (
          id,
          version_number,
          is_active,
          rubric_criteria (
            id,
            name,
            description,
            field_type,
            field_options
          )
        )
      `)
      .eq("company_id", feature.company_id);

    if (rubricError || !rubrics || rubrics.length === 0) {
      return NextResponse.json({ error: "No rubric found for this company" }, { status: 404 });
    }

    // Find the active version across company rubrics
    let activeVersion: {
      id: string;
      version_number: number;
      rubric_criteria: unknown[];
    } | null = null;
    let rubricTitle = "";
    let rubricId = "";

    for (const r of (rubrics || [])) {
      const activeVer = (r.rubric_versions as Array<{
        id: string;
        version_number: number;
        is_active: boolean;
        rubric_criteria: unknown[];
      }>).find((v) => v.is_active);
      if (activeVer) {
        activeVersion = activeVer;
        rubricTitle = r.title;
        rubricId = r.id;
        break;
      }
    }

    if (!activeVersion) {
      return NextResponse.json({ error: "No active rubric version found" }, { status: 404 });
    }

    return NextResponse.json({
      rubric_id: rubricId,
      rubric_title: rubricTitle,
      id: activeVersion.id, // rubric_version_id
      version_number: activeVersion.version_number,
      criteria: activeVersion.rubric_criteria || [],
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("GET Active Rubric Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
