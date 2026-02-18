import { supabaseAdmin } from "./supabase";
import { searchEbayParts } from "./ebay-parts";
import { getStaticPartPrice } from "./pricing/repair-costs";

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
  const { data: cached } = await supabaseAdmin
    .from("parts_price_cache")
    .select("*")
    .eq("cache_key", cacheKey)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (cached) {
    return {
      source: cached.source,
      price_low: cached.price_low || 0,
      price_median: cached.price_median || 0,
      price_high: cached.price_high || 0,
    };
  }

  // 2. Try eBay
  const ebayResult = await searchEbayParts(partName, year, make, model, trim);

  if (ebayResult && ebayResult.results_count >= 3) {
    // Cache the result
    await supabaseAdmin.from("parts_price_cache").upsert({
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
  return {
    source: "static",
    price_low: staticPrice.price_low,
    price_median: (staticPrice.price_low + staticPrice.price_high) / 2,
    price_high: staticPrice.price_high,
  };
}
