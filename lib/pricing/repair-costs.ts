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

// Helper function to get static part price
export function getStaticPartPrice(
  partName: string,
  year: number,
  make: string,
  model: string
): { price_low: number; price_high: number } {
  const normalized = partName.toLowerCase().replace(/\s+/g, "_");
  return STATIC_PART_PRICES[normalized] || { price_low: 50, price_high: 200 };
}
