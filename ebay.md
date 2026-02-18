# Cursor Prompt: Add Real Parts Pricing & Improved Cost Estimation

## Overview

We're upgrading the vehicle reconditioning estimator to produce accurate, market-based cost estimates. This involves three major changes:

1. **Two-step AI analysis** — separate damage detection from cost estimation
2. **eBay Browse API integration** — live aftermarket parts pricing with vehicle compatibility
3. **Static pricing tables with tier multipliers** — for labor costs and fallback parts pricing

---

## 1. Two-Step AI Analysis Architecture

Split the current single Claude API call into two distinct steps.

### Step 1: Damage Detection Only (Vision)

Create a new API route at `/api/analyze/detect` that sends photos to Claude and asks ONLY for damage identification — no pricing.

**System prompt for damage detection:**

```
You are an expert automotive appraiser performing a vehicle condition inspection. Your ONLY job is to identify and describe all visible damage, wear, and cosmetic issues. Do NOT estimate costs or recommend specific repairs.

Vehicle: {{year}} {{make}} {{model}} {{trim}}
Mileage: {{mileage}}

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
}
```

### Step 2: Cost Estimation (Deterministic + AI Hybrid)

Create a new API route at `/api/analyze/estimate` that takes the damage detection results and produces cost estimates. This route does NOT receive images — it works purely from the structured damage data.

The estimation logic should be:

1. For items where `requires_part_replacement` is true:
   - First, try eBay Browse API for live parts pricing (see Section 2 below)
   - If eBay returns results, use median price from top 5 lowest-priced new-condition results
   - If eBay returns nothing, fall back to static parts pricing table (see Section 3)
   - Add labor cost from static labor table based on repair type

2. For items where `requires_part_replacement` is false (repair only):
   - Use static repair pricing table (see Section 3)
   - No parts lookup needed

3. Apply vehicle tier multiplier to all labor costs (see Section 3)

4. Apply regional labor rate adjustment if the dealer has set one in their profile

The output of this step should match the existing `estimate_items` schema so the report page works as-is.

---

## 2. eBay Browse API Integration

### Setup

Register for an eBay Developer account at https://developer.ebay.com. You'll need:
- An Application (app) registered in the eBay Developer Program
- Client ID and Client Secret for OAuth
- Application access token (use Client Credentials Grant flow — no user login needed)

### Environment Variables

Add to `.env`:
```
EBAY_CLIENT_ID=
EBAY_CLIENT_SECRET=
EBAY_ENVIRONMENT=PRODUCTION
```

### Auth Helper — `lib/ebay.ts`

```typescript
interface EbayToken {
  access_token: string;
  expires_at: number;
}

let cachedToken: EbayToken | null = null;

export async function getEbayAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expires_at > Date.now() + 60000) {
    return cachedToken.access_token;
  }

  const credentials = Buffer.from(
    `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch(
    "https://api.ebay.com/identity/v1/oauth2/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${credentials}`,
      },
      body: "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope",
    }
  );

  const data = await response.json();

  cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };

  return cachedToken.access_token;
}
```

### Parts Search — `lib/ebay-parts.ts`

```typescript
interface EbayPartResult {
  title: string;
  price: number;
  currency: string;
  condition: string;
  itemUrl: string;
  imageUrl: string | null;
}

interface PartsPriceResult {
  source: "ebay";
  query: string;
  results_count: number;
  price_low: number;
  price_median: number;
  price_high: number;
  sample_listings: EbayPartResult[];
}

export async function searchEbayParts(
  partName: string,
  year: number,
  make: string,
  model: string,
  trim?: string
): Promise<PartsPriceResult | null> {
  const token = await getEbayAccessToken();

  // Build compatibility filter
  let compatFilter = `Year:${year};Make:${make};Model:${model}`;
  if (trim) {
    compatFilter += `;Trim:${trim}`;
  }

  const params = new URLSearchParams({
    q: partName,
    category_ids: "6030", // eBay Motors Parts & Accessories
    compatibility_filter: compatFilter,
    filter: "conditionIds:{1000}", // New parts only
    sort: "price",
    limit: "15",
  });

  const response = await fetch(
    `https://api.ebay.com/buy/browse/v1/item_summary/search?${params}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
        "X-EBAY-C-ENDUSERCTX":
          "contextualLocation=country=US,zip=37122", // Default to user location, make configurable
      },
    }
  );

  if (!response.ok) {
    console.error("eBay API error:", response.status, await response.text());
    return null;
  }

  const data = await response.json();

  if (!data.itemSummaries || data.itemSummaries.length === 0) {
    return null;
  }

  // Extract prices from results, filtering to exact compatibility matches
  const listings: EbayPartResult[] = data.itemSummaries
    .filter(
      (item: any) =>
        item.compatibilityMatch === "EXACT" ||
        item.compatibilityMatch === "COMPATIBLE"
    )
    .map((item: any) => ({
      title: item.title,
      price: parseFloat(item.price.value),
      currency: item.price.currency,
      condition: item.condition,
      itemUrl: item.itemWebUrl,
      imageUrl: item.thumbnailImages?.[0]?.imageUrl || null,
    }));

  if (listings.length === 0) return null;

  const prices = listings.map((l) => l.price).sort((a, b) => a - b);
  const medianIndex = Math.floor(prices.length / 2);

  return {
    source: "ebay",
    query: `${partName} ${year} ${make} ${model}`,
    results_count: listings.length,
    price_low: prices[0],
    price_median: prices[medianIndex],
    price_high: prices[prices.length - 1],
    sample_listings: listings.slice(0, 5), // Keep top 5 for display
  };
}
```

### Caching Layer — `lib/parts-cache.ts`

Cache eBay results in Supabase to avoid redundant API calls and respect rate limits.

```sql
-- Add to database schema
create table parts_price_cache (
  id uuid primary key default gen_random_uuid(),
  cache_key text unique not null, -- e.g., "front_bumper_cover:2019:honda:accord"
  part_name text not null,
  year int,
  make text,
  model text,
  source text not null, -- "ebay" | "static"
  price_low numeric,
  price_median numeric,
  price_high numeric,
  raw_data jsonb, -- full eBay response for debugging
  fetched_at timestamptz default now(),
  expires_at timestamptz default (now() + interval '7 days')
);

create index idx_parts_cache_key on parts_price_cache(cache_key);
create index idx_parts_cache_expires on parts_price_cache(expires_at);
```

```typescript
// lib/parts-cache.ts

import { supabase } from "./supabase";
import { searchEbayParts } from "./ebay-parts";

function buildCacheKey(
  partName: string,
  year: number,
  make: string,
  model: string
): string {
  return `${partName.toLowerCase().replace(/\s+/g, "_")}:${year}:${make.toLowerCase()}:${model.toLowerCase()}`;
}

export async function getPartPrice(
  partName: string,
  year: number,
  make: string,
  model: string,
  trim?: string
): Promise<{ source: string; price_low: number; price_median: number; price_high: number }> {
  const cacheKey = buildCacheKey(partName, year, make, model);

  // 1. Check cache
  const { data: cached } = await supabase
    .from("parts_price_cache")
    .select("*")
    .eq("cache_key", cacheKey)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (cached) {
    return {
      source: cached.source,
      price_low: cached.price_low,
      price_median: cached.price_median,
      price_high: cached.price_high,
    };
  }

  // 2. Try eBay
  const ebayResult = await searchEbayParts(partName, year, make, model, trim);

  if (ebayResult && ebayResult.results_count >= 3) {
    // Cache the result
    await supabase.from("parts_price_cache").upsert({
      cache_key: cacheKey,
      part_name: partName,
      year,
      make,
      model,
      source: "ebay",
      price_low: ebayResult.price_low,
      price_median: ebayResult.price_median,
      price_high: ebayResult.price_high,
      raw_data: ebayResult,
      fetched_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    return {
      source: "ebay",
      price_low: ebayResult.price_low,
      price_median: ebayResult.price_median,
      price_high: ebayResult.price_high,
    };
  }

  // 3. Fall back to static pricing
  const staticPrice = getStaticPartPrice(partName, year, make, model);
  return { source: "static", ...staticPrice };
}
```

---

## 3. Static Pricing Tables

### Vehicle Tier Multipliers — `lib/pricing/vehicle-tiers.ts`

```typescript
export type VehicleTier =
  | "economy"
  | "mainstream"
  | "premium"
  | "luxury"
  | "ultra_luxury";

const TIER_MAP: Record<string, VehicleTier> = {
  // Economy
  nissan: "economy",
  hyundai: "economy",
  kia: "economy",
  mitsubishi: "economy",
  suzuki: "economy",
  fiat: "economy",

  // Mainstream
  toyota: "mainstream",
  honda: "mainstream",
  ford: "mainstream",
  chevrolet: "mainstream",
  gmc: "mainstream",
  dodge: "mainstream",
  chrysler: "mainstream",
  jeep: "mainstream",
  ram: "mainstream",
  subaru: "mainstream",
  mazda: "mainstream",
  volkswagen: "mainstream",
  buick: "mainstream",

  // Premium
  acura: "premium",
  infiniti: "premium",
  volvo: "premium",
  lincoln: "premium",
  cadillac: "premium",
  mini: "premium",
  alfa_romeo: "premium",
  genesis: "premium",

  // Luxury
  bmw: "luxury",
  mercedes: "luxury",
  "mercedes-benz": "luxury",
  audi: "luxury",
  lexus: "luxury",
  tesla: "luxury",
  jaguar: "luxury",

  // Ultra Luxury
  porsche: "ultra_luxury",
  land_rover: "ultra_luxury",
  "range rover": "ultra_luxury",
  maserati: "ultra_luxury",
  bentley: "ultra_luxury",
  rolls_royce: "ultra_luxury",
  ferrari: "ultra_luxury",
  lamborghini: "ultra_luxury",
  aston_martin: "ultra_luxury",
};

const TIER_MULTIPLIERS: Record<VehicleTier, number> = {
  economy: 0.85,
  mainstream: 1.0,
  premium: 1.3,
  luxury: 1.6,
  ultra_luxury: 2.2,
};

export function getVehicleTier(make: string): VehicleTier {
  const normalized = make.toLowerCase().replace(/\s+/g, "_");
  return TIER_MAP[normalized] || "mainstream";
}

export function getTierMultiplier(make: string): number {
  return TIER_MULTIPLIERS[getVehicleTier(make)];
}
```

### Regional Labor Rate Adjustment

Add a `labor_rate_tier` column to the `profiles` table:

```sql
alter table profiles add column labor_rate_tier text default 'medium';
-- Values: 'low' | 'medium' | 'high'
```

```typescript
// lib/pricing/labor-rates.ts

const LABOR_RATE_MULTIPLIERS: Record<string, number> = {
  low: 0.8,    // Rural / low cost of living markets
  medium: 1.0, // Average US market
  high: 1.3,   // Major metros (NYC, SF, LA, etc.)
};

export function getLaborRateMultiplier(tier: string): number {
  return LABOR_RATE_MULTIPLIERS[tier] || 1.0;
}
```

### Repair Pricing Table — `lib/pricing/repair-costs.ts`

This is the core static pricing table. All costs are in USD for a "mainstream" tier vehicle at "medium" labor rates. Multipliers are applied on top.

```typescript
export interface RepairCost {
  repair_type: string;
  description: string;
  labor_low: number;
  labor_high: number;
  materials_low: number;
  materials_high: number;
}

// Repair-only operations (no part replacement needed)
export const REPAIR_COSTS: Record<string, RepairCost> = {
  // --- PAINT & SURFACE ---
  touch_up_paint: {
    repair_type: "touch_up_paint",
    description: "Touch-up paint for chips and small scratches",
    labor_low: 30,
    labor_high: 75,
    materials_low: 15,
    materials_high: 40,
  },
  scratch_buff_polish: {
    repair_type: "scratch_buff_polish",
    description: "Machine buff and polish to remove light scratches",
    labor_low: 50,
    labor_high: 150,
    materials_low: 10,
    materials_high: 30,
  },
  spot_respray_small: {
    repair_type: "spot_respray_small",
    description: "Spot respray for localized damage (< 6 inches)",
    labor_low: 100,
    labor_high: 250,
    materials_low: 40,
    materials_high: 80,
  },
  full_panel_respray: {
    repair_type: "full_panel_respray",
    description: "Full panel sand, prime, and respray",
    labor_low: 200,
    labor_high: 450,
    materials_low: 60,
    materials_high: 150,
  },
  blend_adjacent_panel: {
    repair_type: "blend_adjacent_panel",
    description: "Blend paint into adjacent panel for color match",
    labor_low: 100,
    labor_high: 200,
    materials_low: 30,
    materials_high: 60,
  },
  clear_coat_respray: {
    repair_type: "clear_coat_respray",
    description: "Clear coat repair for peeling or faded clear",
    labor_low: 150,
    labor_high: 350,
    materials_low: 40,
    materials_high: 100,
  },

  // --- BODY / DENT ---
  pdr_small: {
    repair_type: "pdr_small",
    description: "Paintless dent repair — small dent (< 2 inches)",
    labor_low: 75,
    labor_high: 150,
    materials_low: 0,
    materials_high: 0,
  },
  pdr_large: {
    repair_type: "pdr_large",
    description: "Paintless dent repair — large dent (2-5 inches)",
    labor_low: 150,
    labor_high: 300,
    materials_low: 0,
    materials_high: 0,
  },
  body_filler_repair: {
    repair_type: "body_filler_repair",
    description: "Body filler, sand, prime and paint for dent with paint damage",
    labor_low: 200,
    labor_high: 500,
    materials_low: 40,
    materials_high: 100,
  },
  bumper_repair_plastic: {
    repair_type: "bumper_repair_plastic",
    description: "Plastic bumper repair (crack/gouge fill and respray)",
    labor_low: 150,
    labor_high: 400,
    materials_low: 30,
    materials_high: 80,
  },
  rust_repair_spot: {
    repair_type: "rust_repair_spot",
    description: "Spot rust treatment, sand, prime and paint",
    labor_low: 100,
    labor_high: 300,
    materials_low: 20,
    materials_high: 60,
  },
  rust_repair_panel: {
    repair_type: "rust_repair_panel",
    description: "Panel rust repair with cutting, welding, and refinish",
    labor_low: 300,
    labor_high: 800,
    materials_low: 50,
    materials_high: 150,
  },

  // --- GLASS ---
  windshield_chip_repair: {
    repair_type: "windshield_chip_repair",
    description: "Windshield chip/crack repair (resin injection)",
    labor_low: 40,
    labor_high: 80,
    materials_low: 10,
    materials_high: 20,
  },

  // --- WHEELS ---
  curb_rash_repair: {
    repair_type: "curb_rash_repair",
    description: "Wheel curb rash sand, fill, and refinish (per wheel)",
    labor_low: 75,
    labor_high: 150,
    materials_low: 15,
    materials_high: 40,
  },

  // --- INTERIOR ---
  interior_detail_shampoo: {
    repair_type: "interior_detail_shampoo",
    description: "Full interior deep clean and shampoo",
    labor_low: 80,
    labor_high: 200,
    materials_low: 20,
    materials_high: 50,
  },
  leather_repair_small: {
    repair_type: "leather_repair_small",
    description: "Small leather/vinyl repair (tear, crack, or discoloration)",
    labor_low: 60,
    labor_high: 150,
    materials_low: 15,
    materials_high: 40,
  },
  leather_repair_large: {
    repair_type: "leather_repair_large",
    description: "Large leather panel repair or re-dye",
    labor_low: 150,
    labor_high: 350,
    materials_low: 30,
    materials_high: 80,
  },
  carpet_stain_removal: {
    repair_type: "carpet_stain_removal",
    description: "Carpet stain treatment and extraction",
    labor_low: 40,
    labor_high: 120,
    materials_low: 10,
    materials_high: 30,
  },
  headliner_repair: {
    repair_type: "headliner_repair",
    description: "Headliner sag repair or partial re-glue",
    labor_low: 100,
    labor_high: 250,
    materials_low: 20,
    materials_high: 50,
  },
  seat_burn_repair: {
    repair_type: "seat_burn_repair",
    description: "Cigarette burn or small hole repair in fabric/leather",
    labor_low: 50,
    labor_high: 125,
    materials_low: 10,
    materials_high: 30,
  },
  dashboard_repair: {
    repair_type: "dashboard_repair",
    description: "Dashboard crack or damage repair",
    labor_low: 75,
    labor_high: 200,
    materials_low: 15,
    materials_high: 40,
  },

  // --- LIGHTS ---
  headlight_restoration: {
    repair_type: "headlight_restoration",
    description: "Headlight lens restoration (sand, polish, UV seal)",
    labor_low: 30,
    labor_high: 80,
    materials_low: 10,
    materials_high: 25,
  },

  // --- MECHANICAL COSMETIC ---
  engine_bay_detail: {
    repair_type: "engine_bay_detail",
    description: "Engine bay cleaning and dressing",
    labor_low: 50,
    labor_high: 150,
    materials_low: 15,
    materials_high: 40,
  },
  exhaust_tip_polish: {
    repair_type: "exhaust_tip_polish",
    description: "Exhaust tip cleaning and polish",
    labor_low: 15,
    labor_high: 40,
    materials_low: 5,
    materials_high: 10,
  },

  // --- FULL VEHICLE ---
  full_exterior_detail: {
    repair_type: "full_exterior_detail",
    description: "Full exterior wash, clay bar, polish, and wax/sealant",
    labor_low: 100,
    labor_high: 250,
    materials_low: 30,
    materials_high: 60,
  },
};

// Labor costs for part INSTALLATION (used alongside parts pricing)
export const INSTALLATION_LABOR: Record<string, { labor_low: number; labor_high: number }> = {
  front_bumper_cover: { labor_low: 150, labor_high: 350 },
  rear_bumper_cover: { labor_low: 150, labor_high: 350 },
  fender: { labor_low: 200, labor_high: 400 },
  hood: { labor_low: 150, labor_high: 300 },
  trunk_lid: { labor_low: 150, labor_high: 300 },
  door_shell: { labor_low: 250, labor_high: 500 },
  side_mirror: { labor_low: 50, labor_high: 150 },
  headlight_assembly: { labor_low: 50, labor_high: 175 },
  tail_light_assembly: { labor_low: 40, labor_high: 125 },
  grille: { labor_low: 30, labor_high: 100 },
  windshield: { labor_low: 100, labor_high: 250 },
  rear_window: { labor_low: 100, labor_high: 250 },
  door_glass: { labor_low: 75, labor_high: 200 },
  wheel_rim: { labor_low: 25, labor_high: 60 },
  tire: { labor_low: 20, labor_high: 40 },
  rocker_panel: { labor_low: 200, labor_high: 450 },
  quarter_panel: { labor_low: 400, labor_high: 900 },
  radiator_support: { labor_low: 200, labor_high: 500 },
  bumper_reinforcement: { labor_low: 100, labor_high: 250 },
  fog_light: { labor_low: 30, labor_high: 80 },
  door_handle: { labor_low: 40, labor_high: 120 },
  antenna: { labor_low: 20, labor_high: 60 },
};

// Static fallback parts prices (when eBay has no results)
// Prices are for mainstream-tier vehicles
export const STATIC_PART_PRICES: Record<string, { price_low: number; price_high: number }> = {
  front_bumper_cover: { price_low: 80, price_high: 250 },
  rear_bumper_cover: { price_low: 80, price_high: 250 },
  fender: { price_low: 60, price_high: 200 },
  hood: { price_low: 150, price_high: 400 },
  trunk_lid: { price_low: 150, price_high: 400 },
  door_shell: { price_low: 200, price_high: 600 },
  side_mirror: { price_low: 30, price_high: 120 },
  headlight_assembly: { price_low: 50, price_high: 200 },
  tail_light_assembly: { price_low: 30, price_high: 150 },
  grille: { price_low: 30, price_high: 150 },
  windshield: { price_low: 150, price_high: 400 },
  rear_window: { price_low: 100, price_high: 300 },
  door_glass: { price_low: 60, price_high: 200 },
  wheel_rim: { price_low: 80, price_high: 250 },
  tire: { price_low: 80, price_high: 200 },
  rocker_panel: { price_low: 40, price_high: 150 },
  quarter_panel: { price_low: 100, price_high: 400 },
  radiator_support: { price_low: 60, price_high: 200 },
  bumper_reinforcement: { price_low: 40, price_high: 120 },
  fog_light: { price_low: 20, price_high: 80 },
  door_handle: { price_low: 10, price_high: 50 },
  antenna: { price_low: 10, price_high: 40 },
};
```

### Damage-to-Repair Mapping — `lib/pricing/damage-mapper.ts`

This maps the damage detection output to the appropriate repair type and determines whether to look up parts or use repair-only pricing.

```typescript
import { RepairCost, REPAIR_COSTS, INSTALLATION_LABOR, STATIC_PART_PRICES } from "./repair-costs";
import { getTierMultiplier } from "./vehicle-tiers";
import { getLaborRateMultiplier } from "./labor-rates";
import { getPartPrice } from "../parts-cache";

interface DamageItem {
  id: string;
  location: string;
  damage_type: string;
  severity: "minor" | "moderate" | "severe";
  size_estimate: string;
  requires_part_replacement: boolean;
  part_name: string | null;
}

interface EstimateLineItem {
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
  const tierMultiplier = getTierMultiplier(vehicle.make);
  const laborMultiplier = getLaborRateMultiplier(laborRateTier);

  const estimates: EstimateLineItem[] = [];

  for (const item of damageItems) {
    let partsLow = 0;
    let partsHigh = 0;
    let laborLow = 0;
    let laborHigh = 0;
    let pricingSource = "static";
    let repairDescription = "";

    if (item.requires_part_replacement && item.part_name) {
      // --- PART REPLACEMENT PATH ---
      // Get parts price (eBay → cache → static fallback)
      const partPrice = await getPartPrice(
        item.part_name,
        vehicle.year,
        vehicle.make,
        vehicle.model,
        vehicle.trim
      );

      pricingSource = partPrice.source;
      partsLow = partPrice.price_low;
      partsHigh = partPrice.price_high;

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
    }

    estimates.push({
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
      is_included: true,
      photo_index: item.photo_index || 0,
    });
  }

  return estimates;
}
```

---

## 4. Updated API Route — `/api/analyze/route.ts`

Replace the existing single-call analysis with the two-step flow:

```typescript
import { buildEstimate } from "@/lib/pricing/damage-mapper";

export async function POST(request: Request) {
  const { images, vehicle, laborRateTier } = await request.json();

  // STEP 1: Damage Detection (Claude Vision)
  const detectionResponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: DAMAGE_DETECTION_SYSTEM_PROMPT, // From Section 1 above
      messages: [
        {
          role: "user",
          content: [
            ...images.map((img: any, i: number) => ([
              { type: "text", text: `Photo ${i + 1}: ${img.station}` },
              {
                type: "image",
                source: { type: "base64", media_type: "image/jpeg", data: img.base64 },
              },
            ])).flat(),
            {
              type: "text",
              text: `Vehicle: ${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim || ""}\nMileage: ${vehicle.mileage}\n\nAnalyze all photos and identify every instance of damage or wear.`,
            },
          ],
        },
      ],
    }),
  });

  const detectionData = await detectionResponse.json();
  const detectionText = detectionData.content[0].text;
  const detection = JSON.parse(detectionText.replace(/```json|```/g, "").trim());

  // STEP 2: Cost Estimation (Deterministic + eBay)
  const estimateItems = await buildEstimate(
    detection.items,
    vehicle,
    laborRateTier || "medium"
  );

  // Build final response
  const totalLow = estimateItems.reduce((sum, item) => sum + item.cost_low, 0);
  const totalHigh = estimateItems.reduce((sum, item) => sum + item.cost_high, 0);

  const result = {
    vehicle,
    exterior_condition: detection.exterior_condition,
    interior_condition: detection.interior_condition,
    mechanical_indicators: detection.mechanical_indicators,
    items: estimateItems,
    summary: {
      total_items: estimateItems.length,
      total_cost_low: totalLow,
      total_cost_high: totalHigh,
      ebay_priced_items: estimateItems.filter((i) => i.pricing_source === "ebay").length,
      static_priced_items: estimateItems.filter((i) => i.pricing_source === "static").length,
    },
  };

  // Store in Supabase (same as before)
  // ...

  return Response.json(result);
}
```

---

## 5. Updated Database Schema

```sql
-- Update estimate_items table to include new fields
alter table estimate_items add column parts_cost_low numeric default 0;
alter table estimate_items add column parts_cost_high numeric default 0;
alter table estimate_items add column labor_cost_low numeric default 0;
alter table estimate_items add column labor_cost_high numeric default 0;
alter table estimate_items add column pricing_source text default 'static';

-- Add labor rate tier to profiles
alter table profiles add column labor_rate_tier text default 'medium';
alter table profiles add column region text;
```

---

## 6. UI Updates

### Report Page Updates

Update the report at `/report/[id]/page.tsx`:

- Each line item should now show **parts** and **labor** cost breakdowns side by side, not just a single cost range
- Add a badge showing pricing source: green "Live Market Price" badge for eBay-sourced items, gray "Estimated" badge for static-priced items
- For eBay-priced replacement parts, show a "View on eBay" link that opens the search results page so dealers can actually purchase the part
- Add a summary footer showing: "X of Y items priced with live market data"

### Settings Page Updates

Add a settings section at `/settings` or in the profile page:

- **Labor Market** dropdown: "Low Cost Market", "Average Market", "High Cost Market" — this sets the `labor_rate_tier`
- **Dealer ZIP Code** — used for eBay location-based results and future shipping estimates
- **Default Parts Preference** dropdown: "Aftermarket (lowest cost)", "OEM equivalent", "Certified OEM" — for future use

### Analyzing Screen Updates

Update `/analyzing/page.tsx` to show the two-step process:
- Step 1: "Identifying damage..." with a progress indicator
- Step 2: "Looking up parts pricing..." with a count of parts being priced
- Step 3: "Building estimate..."

---

## 7. File Structure Changes

```
src/
├── lib/
│   ├── ebay.ts                         # NEW: eBay OAuth helper
│   ├── ebay-parts.ts                   # NEW: eBay Browse API parts search
│   ├── parts-cache.ts                  # NEW: Caching layer for parts prices
│   ├── pricing/
│   │   ├── vehicle-tiers.ts            # NEW: Make → tier mapping + multipliers
│   │   ├── labor-rates.ts              # NEW: Regional labor rate multipliers
│   │   ├── repair-costs.ts             # NEW: Static repair + parts pricing tables
│   │   └── damage-mapper.ts            # NEW: Orchestrates damage → estimate
│   ├── supabase.ts
│   ├── anthropic.ts
│   ├── vin.ts
│   └── types.ts                        # UPDATE: Add new interfaces
├── app/
│   ├── api/
│   │   ├── analyze/
│   │   │   ├── route.ts                # UPDATE: Two-step flow
│   │   │   ├── detect/route.ts         # NEW: Damage detection only (optional separate endpoint)
│   │   │   └── estimate/route.ts       # NEW: Cost estimation only (optional separate endpoint)
│   │   └── ...
│   ├── report/[id]/page.tsx            # UPDATE: Parts/labor breakdown, pricing source badges
│   ├── analyzing/page.tsx              # UPDATE: Multi-step progress
│   └── settings/page.tsx               # NEW: Labor rate, ZIP code, preferences
└── ...
```

---

## 8. Build Order

1. Create the pricing module (`lib/pricing/`) with all static tables and mapping logic
2. Update the Claude prompt and create the two-step API flow — test without eBay first using only static pricing
3. Register for eBay Developer Program and get API credentials
4. Build the eBay integration (`lib/ebay.ts`, `lib/ebay-parts.ts`)
5. Build the caching layer (`lib/parts-cache.ts`) and add the `parts_price_cache` table
6. Wire eBay into the estimation pipeline
7. Update the report UI with parts/labor breakdown and pricing source badges
8. Add the settings page for labor rate and ZIP code
9. Update the analyzing screen to show multi-step progress
10. Test end-to-end with real vehicles

---

## 9. Key Implementation Notes

- **eBay rate limits:** The Browse API has daily call limits. With caching (7-day TTL), you should stay well within limits. Monitor usage and extend cache TTL if needed.
- **eBay category ID 6030** is the parent category for "eBay Motors Parts & Accessories" in the US marketplace. You may need to experiment with subcategories for better results on specific part types.
- **Parallel parts lookups:** When building an estimate with multiple replacement parts, run the eBay lookups in parallel with `Promise.all()` to avoid sequential latency.
- **Graceful degradation:** If eBay is down or rate-limited, the entire system should fall back to static pricing seamlessly. Never let a parts lookup failure block an estimate.
- **Parts name normalization:** The damage detection prompt uses standardized part names. The mapper normalizes these to match the `INSTALLATION_LABOR` and `STATIC_PART_PRICES` keys. If Claude returns an unrecognized part name, fall back to a generic "body panel" or "trim piece" category.
- **Future: Dealer feedback loop.** Add a "Was this estimate accurate?" prompt after the dealer completes reconditioning. Store actual vs. estimated costs. Use this data to calibrate multipliers and identify systematic over/under-estimation by repair type.
