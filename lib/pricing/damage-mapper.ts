import { REPAIR_COSTS, INSTALLATION_LABOR } from "./repair-costs";
import { getTierMultiplier } from "./vehicle-tiers";
import { getLaborRateMultiplier } from "./labor-rates";
import { getPartPrice } from "../parts-cache";
import { getCleaningProductLink } from "../product-links";

export interface DamageItem {
  id: string;
  location: string;
  damage_type: string;
  severity: "minor" | "moderate" | "severe";
  size_estimate: string;
  description: string;
  requires_part_replacement: boolean;
  part_name: string | null;
  photo_index: number;
}

export interface EstimateLineItem {
  id: string;
  location: string;
  damage_type: string;
  severity: string;
  description: string;
  recommended_repair: string;
  parts_cost_low: number;
  parts_cost_high: number;
  labor_cost_low: number;
  labor_cost_high: number;
  cost_low: number;
  cost_high: number;
  pricing_source: string; // "ebay" | "static"
  product_link?: string; // Link to replacement part (eBay) or cleaning product (Amazon)
  product_link_label?: string; // Label for the product link
  is_included: boolean;
  photo_index: number;
}

// Maps damage_type + severity to the appropriate repair operation
function getRepairType(damageType: string, severity: string, location: string): string {
  const mapping: Record<string, Record<string, string>> = {
    scratch: {
      minor: "scratch_buff_polish",
      moderate: "spot_respray_small",
      severe: "full_panel_respray",
    },
    deep_scratch: {
      minor: "spot_respray_small",
      moderate: "full_panel_respray",
      severe: "full_panel_respray",
    },
    dent_small: {
      minor: "pdr_small",
      moderate: "pdr_small",
      severe: "pdr_large",
    },
    dent_large: {
      minor: "pdr_large",
      moderate: "body_filler_repair",
      severe: "body_filler_repair",
    },
    paint_chip: {
      minor: "touch_up_paint",
      moderate: "touch_up_paint",
      severe: "spot_respray_small",
    },
    paint_fade: {
      minor: "scratch_buff_polish",
      moderate: "full_panel_respray",
      severe: "full_panel_respray",
    },
    clear_coat_peel: {
      minor: "clear_coat_respray",
      moderate: "clear_coat_respray",
      severe: "full_panel_respray",
    },
    rust_spot: {
      minor: "rust_repair_spot",
      moderate: "rust_repair_spot",
      severe: "rust_repair_panel",
    },
    rust_heavy: {
      minor: "rust_repair_panel",
      moderate: "rust_repair_panel",
      severe: "rust_repair_panel",
    },
    crack: {
      minor: "bumper_repair_plastic",
      moderate: "bumper_repair_plastic",
      severe: "bumper_repair_plastic", // will likely need replacement, handled by requires_part_replacement
    },
    tear: {
      minor: "leather_repair_small",
      moderate: "leather_repair_large",
      severe: "leather_repair_large",
    },
    stain: {
      minor: "carpet_stain_removal",
      moderate: "interior_detail_shampoo",
      severe: "interior_detail_shampoo",
    },
    burn: {
      minor: "seat_burn_repair",
      moderate: "seat_burn_repair",
      severe: "leather_repair_large",
    },
    curb_rash: {
      minor: "curb_rash_repair",
      moderate: "curb_rash_repair",
      severe: "curb_rash_repair", // severe may need wheel replacement, handled by requires_part_replacement
    },
    foggy: {
      minor: "headlight_restoration",
      moderate: "headlight_restoration",
      severe: "headlight_restoration",
    },
    discolored: {
      minor: "scratch_buff_polish",
      moderate: "interior_detail_shampoo",
      severe: "full_panel_respray",
    },
  };

  return mapping[damageType]?.[severity] || "spot_respray_small";
}

export async function buildEstimate(
  damageItems: DamageItem[],
  vehicle: { year: number; make: string; model: string; trim?: string },
  laborRateTier: string = "medium"
): Promise<EstimateLineItem[]> {
  console.log("[Damage Mapper] Building estimate:", {
    itemCount: damageItems.length,
    vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
    laborRateTier,
  });

  // Log items that require part replacement
  const itemsNeedingParts = damageItems.filter(
    (item) => item.requires_part_replacement && item.part_name
  );
  console.log("[Damage Mapper] Items requiring part replacement:", {
    count: itemsNeedingParts.length,
    items: itemsNeedingParts.map((item) => ({
      location: item.location,
      part_name: item.part_name,
      damage_type: item.damage_type,
      severity: item.severity,
    })),
  });

  const tierMultiplier = getTierMultiplier(vehicle.make);
  const laborMultiplier = getLaborRateMultiplier(laborRateTier);

  const estimates: EstimateLineItem[] = [];

  // Process items in parallel for better performance
  const estimatePromises = damageItems.map(async (item) => {
    let partsLow = 0;
    let partsHigh = 0;
    let laborLow = 0;
    let laborHigh = 0;
    let pricingSource = "static";
    let repairDescription = "";

    // Generate product link
    let productLink: string | undefined;
    let productLinkLabel: string | undefined;

    if (item.requires_part_replacement && item.part_name) {
      console.log("[Damage Mapper] Processing part replacement:", {
        location: item.location,
        part_name: item.part_name,
        vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
      });
      // --- PART REPLACEMENT PATH ---
      // Get parts price (eBay → cache → static fallback)
      const partPrice = await getPartPrice(
        item.part_name,
        vehicle.year,
        vehicle.make,
        vehicle.model,
        vehicle.trim
      );

      console.log("[Damage Mapper] Part price received:", {
        part_name: item.part_name,
        source: partPrice.source,
        price_low: partPrice.price_low,
        price_high: partPrice.price_high,
        price_median: partPrice.price_median,
        hasProductLink: !!partPrice.product_link,
      });

      pricingSource = partPrice.source;
      partsLow = partPrice.price_low;
      partsHigh = partPrice.price_high;
      productLink = partPrice.product_link;
      productLinkLabel = "View Replacement Part on eBay";

      // Apply tier multiplier to static parts only (eBay prices already reflect market)
      if (partPrice.source === "static") {
        partsLow = Math.round(partsLow * tierMultiplier);
        partsHigh = Math.round(partsHigh * tierMultiplier);
      }

      // Get installation labor
      const normalizedPart = item.part_name.toLowerCase().replace(/\s+/g, "_");
      const installLabor = INSTALLATION_LABOR[normalizedPart] || {
        labor_low: 100,
        labor_high: 250,
      };

      laborLow = Math.round(installLabor.labor_low * tierMultiplier * laborMultiplier);
      laborHigh = Math.round(installLabor.labor_high * tierMultiplier * laborMultiplier);

      // Add paint labor if body panel
      const paintableParts = [
        "front_bumper_cover", "rear_bumper_cover", "fender", "hood",
        "trunk_lid", "door_shell", "quarter_panel", "rocker_panel",
      ];
      if (paintableParts.includes(normalizedPart)) {
        const paintCost = REPAIR_COSTS["full_panel_respray"];
        laborLow += Math.round(paintCost.labor_low * tierMultiplier * laborMultiplier);
        laborHigh += Math.round(paintCost.labor_high * tierMultiplier * laborMultiplier);
        partsLow += paintCost.materials_low;
        partsHigh += paintCost.materials_high;
      }

      repairDescription = `Replace ${item.part_name}${paintableParts.includes(normalizedPart) ? " + prime/paint" : ""}`;
    } else {
      // --- REPAIR-ONLY PATH ---
      const repairType = getRepairType(item.damage_type, item.severity, item.location);
      const repairCost = REPAIR_COSTS[repairType];

      if (repairCost) {
        laborLow = Math.round(repairCost.labor_low * tierMultiplier * laborMultiplier);
        laborHigh = Math.round(repairCost.labor_high * tierMultiplier * laborMultiplier);
        partsLow = repairCost.materials_low;
        partsHigh = repairCost.materials_high;
        repairDescription = repairCost.description;
      }

      // For repairs, get cleaning/touch-up product link
      const cleaningLink = getCleaningProductLink(repairType, item.location);
      if (cleaningLink) {
        productLink = cleaningLink.url;
        productLinkLabel = cleaningLink.label;
      }
    }

    // Only auto-include moderate and severe items (minor items are optional)
    const isIncluded = item.severity !== "minor";

    return {
      id: item.id,
      location: item.location,
      damage_type: item.damage_type,
      severity: item.severity,
      description: item.description || "",
      recommended_repair: repairDescription,
      parts_cost_low: partsLow,
      parts_cost_high: partsHigh,
      labor_cost_low: laborLow,
      labor_cost_high: laborHigh,
      cost_low: partsLow + laborLow,
      cost_high: partsHigh + laborHigh,
      pricing_source: pricingSource,
      product_link: productLink,
      product_link_label: productLinkLabel,
      is_included: isIncluded,
      photo_index: item.photo_index || 0,
    };
  });

  const results = await Promise.all(estimatePromises);

  // Log summary
  const ebayCount = results.filter((r) => r.pricing_source === "ebay").length;
  const staticCount = results.filter((r) => r.pricing_source === "static").length;
  console.log("[Damage Mapper] Estimate building complete:", {
    totalItems: results.length,
    ebayPriced: ebayCount,
    staticPriced: staticCount,
    itemsNeedingParts: itemsNeedingParts.length,
  });

  return results;
}
