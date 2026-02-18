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
