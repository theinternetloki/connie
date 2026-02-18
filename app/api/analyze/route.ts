import { NextRequest, NextResponse } from "next/server";
import { anthropic } from "@/lib/anthropic";
import { supabaseAdmin } from "@/lib/supabase";
import { DamageDetectionResult } from "@/lib/types";
import { createServerClient } from "@supabase/ssr";
import { buildEstimate } from "@/lib/pricing/damage-mapper";

// Increase body size limit for image uploads (default is 1MB, we need more for compressed images)
export const maxDuration = 90; // 90 seconds for two-step AI processing + parts lookup
export const runtime = 'nodejs';

const DAMAGE_DETECTION_SYSTEM_PROMPT = `You are an expert automotive appraiser performing a vehicle condition inspection. Your ONLY job is to identify and describe all visible damage, wear, and cosmetic issues. Do NOT estimate costs or recommend specific repairs.

For each issue found, provide:
- location: specific panel or area (e.g., "front bumper cover", "driver side fender", "rear bumper", "hood", "driver seat cushion", "windshield", "front passenger wheel")
- damage_type: one of ["scratch", "deep_scratch", "dent_small", "dent_large", "paint_chip", "paint_fade", "clear_coat_peel", "rust_spot", "rust_heavy", "crack", "hole", "tear", "stain", "burn", "curb_rash", "broken", "missing", "foggy", "discolored"]
- severity: "minor" | "moderate" | "severe"
- size_estimate: approximate size in inches (e.g., "2 inch", "6 inch", "full panel")
- description: 1-2 sentence description of what you observe
- requires_part_replacement: true | false (true if the part needs replacing rather than repairing)
- part_name: if requires_part_replacement is true, the common aftermarket part name for search purposes (e.g., "front bumper cover", "fender", "headlight assembly", "tail light assembly", "side mirror", "hood", "grille", "wheel rim"). Use standard part naming that would appear in parts catalogs. null if repair only.
- photo_index: which photo this was found in (0-indexed)

Also assess:
- exterior_condition: "excellent" | "good" | "fair" | "poor"
- interior_condition: "excellent" | "good" | "fair" | "poor"
- mechanical_indicators: any visible mechanical issues (fluid leaks, worn belts, tire wear, exhaust damage, etc.)

Be thorough. Check every panel, every wheel, all glass, all lights, mirrors, trim pieces, interior surfaces, and dashboard.

Respond ONLY in JSON:
{
  "exterior_condition": "string",
  "interior_condition": "string",
  "mechanical_indicators": ["string"],
  "items": [
    {
      "id": "string (uuid)",
      "location": "string",
      "damage_type": "string",
      "severity": "minor" | "moderate" | "severe",
      "size_estimate": "string",
      "description": "string",
      "requires_part_replacement": boolean,
      "part_name": "string | null",
      "photo_index": number
    }
  ]
}`;

export async function POST(request: NextRequest) {
  try {
    // Verify authentication first
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set() {
          // No-op for read-only operations
        },
        remove() {
          // No-op for read-only operations
        },
      },
    });

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized - Please log in to use this feature" },
        { status: 401 }
      );
    }

    const { photos, vehicle, userId } = await request.json();

    // Verify that the userId in the request matches the authenticated user
    if (userId !== user.id) {
      return NextResponse.json(
        { error: "Unauthorized - User ID mismatch" },
        { status: 403 }
      );
    }

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

    // Ensure profile exists before creating inspection
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, labor_rate_tier")
      .eq("id", user.id)
      .single();

    if (!existingProfile) {
      // Create profile if it doesn't exist
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .insert({
          id: user.id,
          dealership_name: user.user_metadata?.dealership_name || "",
        });

      if (profileError) {
        console.error("Profile creation error:", profileError);
        return NextResponse.json(
          { error: "Failed to create user profile. Please contact support." },
          { status: 500 }
        );
      }
    }

    const laborRateTier = existingProfile?.labor_rate_tier || "medium";

    // ============================================
    // STEP 1: Damage Detection (Claude Vision)
    // ============================================
    const imageContents = photos.map((photo: { base64: string; station: string }, index: number) => ({
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: "image/jpeg",
        data: photo.base64.split(",")[1], // Remove data:image/jpeg;base64, prefix
      },
    }));

    const userMessage = `Analyze all photos and identify every instance of damage or wear.

Vehicle: ${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim || ""}
Mileage: ${vehicle.mileage}`;

    const detectionMessage = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 4096,
      system: DAMAGE_DETECTION_SYSTEM_PROMPT,
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
    let detectionText = "";
    if (detectionMessage.content[0].type === "text") {
      detectionText = detectionMessage.content[0].text;
    }

    // Clean up markdown code fences if present
    detectionText = detectionText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let detection: DamageDetectionResult;
    try {
      detection = JSON.parse(detectionText);
      
      // Ensure all items have UUIDs
      detection.items = detection.items.map((item) => ({
        ...item,
        id: item.id || crypto.randomUUID(),
      }));
    } catch (error) {
      console.error("Failed to parse Claude detection response:", detectionText);
      return NextResponse.json(
        { error: "Failed to parse AI response" },
        { status: 500 }
      );
    }

    // ============================================
    // STEP 2: Cost Estimation (Deterministic + eBay)
    // ============================================
    const estimateItems = await buildEstimate(
      detection.items,
      vehicle,
      laborRateTier
    );

    // Calculate totals
    const totalLow = estimateItems.reduce((sum, item) => sum + item.cost_low, 0);
    const totalHigh = estimateItems.reduce((sum, item) => sum + item.cost_high, 0);

    // ============================================
    // Store in Supabase
    // ============================================
    const { data: inspection, error: inspectionError } = await supabaseAdmin
      .from("inspections")
      .insert({
        user_id: user.id,
        vin: vehicle.vin,
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        trim: vehicle.trim,
        mileage: vehicle.mileage,
        exterior_condition: detection.exterior_condition,
        interior_condition: detection.interior_condition,
        total_cost_low: totalLow,
        total_cost_high: totalHigh,
        ai_analysis: {
          vehicle,
          exterior_condition: detection.exterior_condition,
          interior_condition: detection.interior_condition,
          mechanical_indicators: detection.mechanical_indicators,
          items: detection.items,
          summary: {
            total_items: estimateItems.length,
            total_cost_low: totalLow,
            total_cost_high: totalHigh,
            top_priority_repairs: estimateItems
              .filter((i) => i.severity === "severe")
              .slice(0, 3)
              .map((i) => i.recommended_repair),
            notes: `Analysis completed with ${estimateItems.filter((i) => i.pricing_source === "ebay").length} items priced from live market data.`,
          },
        },
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
        const fileName = `${inspection.id}/photo_${index + 1}.jpg`;
        
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
          .from("inspection-photos")
          .upload(fileName, buffer, {
            contentType: "image/jpeg",
          });

        if (!uploadError && uploadData) {
          // Save photo record
          await supabaseAdmin.from("inspection_photos").insert({
            inspection_id: inspection.id,
            station: photo.station || `photo_${index + 1}`,
            storage_path: fileName,
            sort_order: index,
          });
        }

        return { fileName, error: uploadError };
      })
    );

    // Create estimate items with new fields
    await supabaseAdmin.from("estimate_items").insert(
      estimateItems.map((item) => ({
        inspection_id: inspection.id,
        location: item.location,
        damage_type: item.damage_type,
        severity: item.severity,
        description: item.description,
        recommended_repair: item.recommended_repair,
        cost_low: item.cost_low,
        cost_high: item.cost_high,
        parts_cost_low: item.parts_cost_low,
        parts_cost_high: item.parts_cost_high,
        labor_cost_low: item.labor_cost_low,
        labor_cost_high: item.labor_cost_high,
        pricing_source: item.pricing_source,
        is_included: item.is_included,
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
