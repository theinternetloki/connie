/**
 * Helper functions to generate product links for cleaning/touch-up products
 * based on repair type
 */

export interface ProductLink {
  url: string;
  label: string;
  source: "amazon" | "ebay";
}

/**
 * Generates product links for cleaning/touch-up products based on repair type
 */
export function getCleaningProductLink(repairType: string, location: string): ProductLink | null {
  const repairLower = repairType.toLowerCase();
  const locationLower = location.toLowerCase();

  // Paint touch-up products
  if (repairLower.includes("touch_up") || repairLower.includes("paint_chip")) {
    return {
      url: "https://www.amazon.com/s?k=automotive+touch+up+paint+pen",
      label: "View Touch-Up Paint Products",
      source: "amazon",
    };
  }

  // Scratch removal/buffing products
  if (repairLower.includes("buff") || repairLower.includes("polish") || repairLower.includes("scratch")) {
    return {
      url: "https://www.amazon.com/s?k=car+scratch+remover+compound",
      label: "View Scratch Removal Products",
      source: "amazon",
    };
  }

  // Interior cleaning products
  if (
    repairLower.includes("shampoo") ||
    repairLower.includes("detail") ||
    repairLower.includes("stain") ||
    locationLower.includes("interior") ||
    locationLower.includes("seat") ||
    locationLower.includes("carpet")
  ) {
    return {
      url: "https://www.amazon.com/s?k=automotive+interior+cleaner+shampoo",
      label: "View Interior Cleaning Products",
      source: "amazon",
    };
  }

  // Leather repair products
  if (repairLower.includes("leather") || repairLower.includes("tear") || repairLower.includes("burn")) {
    return {
      url: "https://www.amazon.com/s?k=leather+repair+kit+automotive",
      label: "View Leather Repair Products",
      source: "amazon",
    };
  }

  // Headlight restoration products
  if (repairLower.includes("headlight") || repairLower.includes("restoration") || repairLower.includes("foggy")) {
    return {
      url: "https://www.amazon.com/s?k=headlight+restoration+kit",
      label: "View Headlight Restoration Kits",
      source: "amazon",
    };
  }

  // Wheel/rim cleaning products
  if (repairLower.includes("curb_rash") || repairLower.includes("wheel") || locationLower.includes("wheel")) {
    return {
      url: "https://www.amazon.com/s?k=wheel+cleaner+rim+cleaner",
      label: "View Wheel Cleaning Products",
      source: "amazon",
    };
  }

  // General car cleaning products
  if (repairLower.includes("detail") || repairLower.includes("clean")) {
    return {
      url: "https://www.amazon.com/s?k=automotive+detailing+products",
      label: "View Detailing Products",
      source: "amazon",
    };
  }

  return null;
}

/**
 * Generates an eBay search URL for a replacement part
 */
export function getEbaySearchUrl(partName: string, year: number, make: string, model: string): string {
  const searchQuery = encodeURIComponent(`${partName} ${year} ${make} ${model}`);
  return `https://www.ebay.com/sch/i.html?_nkw=${searchQuery}&_sacat=6030`;
}
