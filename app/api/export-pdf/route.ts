import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const inspectionId = searchParams.get("id");

  if (!inspectionId) {
    return NextResponse.json({ error: "Inspection ID required" }, { status: 400 });
  }

  try {
    // Fetch inspection data
  const { data: inspection, error: inspectionError } = await supabase
      .from("inspections")
      .select("*")
      .eq("id", inspectionId)
      .single();

    if (inspectionError || !inspection) {
      return NextResponse.json({ error: "Inspection not found" }, { status: 404 });
    }

    const { data: items, error: itemsError } = await supabase
      .from("estimate_items")
      .select("*")
      .eq("inspection_id", inspectionId)
      .eq("is_included", true)
      .order("created_at");

    if (itemsError) {
      return NextResponse.json({ error: "Failed to load items" }, { status: 500 });
    }

    // Generate simple HTML for PDF (client-side will use html2canvas + jsPDF)
    // For now, return JSON data that client can use
    return NextResponse.json({
      inspection,
      items: items || [],
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "PDF export failed" },
      { status: 500 }
    );
  }
}
