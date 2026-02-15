import { NextRequest, NextResponse } from "next/server";
import { anthropic } from "@/lib/anthropic";
import { supabaseAdmin } from "@/lib/supabase";
import { AIAnalysis } from "@/lib/types";

// Increase body size limit for image uploads (default is 1MB, we need more for compressed images)
export const maxDuration = 60; // 60 seconds for AI processing
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { photos, vehicle, userId } = await request.json();

    if (!photos || photos.length === 0) {
      return NextResponse.json(
        { error: "No photos provided" },
        { status: 400 }
      );
    }

    if (!vehicle) {
      return NextResponse.json(
        { error: "Vehicle information required" },
        { status: 400 }
      );
    }

    // Prepare images for Claude
    const imageContents = photos.map((photo: { base64: string; station: string }, index: number) => ({
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: "image/jpeg",
        data: photo.base64.split(",")[1], // Remove data:image/jpeg;base64, prefix
      },
    }));

    // Create user message with labeled images
    const photoLabels = photos.map(
      (photo: { station: string }, index: number) =>
        `Photo ${index + 1}: ${photo.station.replace(/_/g, " ")}`
    );

    const userMessage = `Please analyze these vehicle photos:

${photoLabels.join("\n")}

Vehicle: ${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim || ""}
Mileage: ${vehicle.mileage}`;

    // System prompt
    const systemPrompt = `You are an expert automotive appraiser and reconditioning cost estimator for auto dealers. You are analyzing photos of a used vehicle to identify all visible damage, wear, and cosmetic issues, then estimating reconditioning costs.

Analyze all provided photos carefully. For each issue found, provide:
- Location (e.g., "front bumper", "driver seat", "rear passenger door")
- Damage type (e.g., "scratch", "dent", "paint chip", "stain", "tear", "curb rash", "crack", "fading", "rust")
- Severity: minor | moderate | severe
- Recommended repair (e.g., "touch-up paint", "PDR", "sand and respray panel", "replace bumper cover", "interior shampoo", "leather repair", "windshield replacement")
- Estimated cost range (low and high, in USD)

Also assess overall vehicle condition:
- Exterior condition: excellent | good | fair | poor
- Interior condition: excellent | good | fair | poor
- Estimated total reconditioning cost (low and high)

Be specific and realistic with costs based on typical US dealer reconditioning rates. Account for the vehicle's make/model — luxury brands cost more.

Respond ONLY in the following JSON format, no markdown, no preamble:
{
  "vehicle": {
    "year": number,
    "make": "string",
    "model": "string",
    "trim": "string",
    "mileage": number
  },
  "exterior_condition": "excellent" | "good" | "fair" | "poor",
  "interior_condition": "excellent" | "good" | "fair" | "poor",
  "items": [
    {
      "id": "string (uuid)",
      "location": "string",
      "damage_type": "string",
      "severity": "minor" | "moderate" | "severe",
      "description": "string (1-2 sentence description of what you see)",
      "recommended_repair": "string",
      "cost_low": number,
      "cost_high": number,
      "photo_index": number
    }
  ],
  "summary": {
    "total_items": number,
    "total_cost_low": number,
    "total_cost_high": number,
    "top_priority_repairs": ["string", "string", "string"],
    "notes": "string (any overall observations or recommendations)"
  }
}`;

    // Call Claude API
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            ...imageContents,
            {
              type: "text" as const,
              text: userMessage,
            },
          ],
        },
      ],
    });

    // Extract JSON from response
    let analysisText = "";
    if (message.content[0].type === "text") {
      analysisText = message.content[0].text;
    }

    // Clean up markdown code fences if present
    analysisText = analysisText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let analysis: AIAnalysis;
    try {
      analysis = JSON.parse(analysisText);
    } catch (error) {
      console.error("Failed to parse Claude response:", analysisText);
      return NextResponse.json(
        { error: "Failed to parse AI response" },
        { status: 500 }
      );
    }

    // Store in Supabase
    const { data: inspection, error: inspectionError } = await supabaseAdmin
      .from("inspections")
      .insert({
        user_id: userId,
        vin: vehicle.vin,
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        trim: vehicle.trim,
        mileage: vehicle.mileage,
        exterior_condition: analysis.exterior_condition,
        interior_condition: analysis.interior_condition,
        total_cost_low: analysis.summary.total_cost_low,
        total_cost_high: analysis.summary.total_cost_high,
        ai_analysis: analysis,
      })
      .select()
      .single();

    if (inspectionError) {
      console.error("Supabase error:", inspectionError);
      return NextResponse.json(
        { error: "Failed to save inspection" },
        { status: 500 }
      );
    }

    // Upload photos to Supabase Storage
    const photoUploads = await Promise.all(
      photos.map(async (photo: { base64: string; station: string }, index: number) => {
        const base64Data = photo.base64.split(",")[1];
        const buffer = Buffer.from(base64Data, "base64");
        const fileName = `${inspection.id}/${photo.station}_${index}.jpg`;
        
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
          .from("inspection-photos")
          .upload(fileName, buffer, {
            contentType: "image/jpeg",
          });

        if (!uploadError && uploadData) {
          // Save photo record
          await supabaseAdmin.from("inspection_photos").insert({
            inspection_id: inspection.id,
            station: photo.station,
            storage_path: fileName,
            sort_order: index,
          });
        }

        return { fileName, error: uploadError };
      })
    );

    // Create estimate items
    await supabaseAdmin.from("estimate_items").insert(
      analysis.items.map((item) => ({
        inspection_id: inspection.id,
        location: item.location,
        damage_type: item.damage_type,
        severity: item.severity,
        description: item.description,
        recommended_repair: item.recommended_repair,
        cost_low: item.cost_low,
        cost_high: item.cost_high,
        is_included: true,
        photo_index: item.photo_index,
      }))
    );

    return NextResponse.json({ inspectionId: inspection.id });
  } catch (error: any) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      { error: error.message || "Analysis failed" },
      { status: 500 }
    );
  }
}
