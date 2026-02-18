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
  console.log("[Parts Cache] Checking cache for:", { cacheKey, partName, year, make, model });
  const { data: cached, error: cacheError } = await supabaseAdmin
    .from("parts_price_cache")
    .select("*")
    .eq("cache_key", cacheKey)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (cacheError && cacheError.code !== "PGRST116") {
    // PGRST116 is "not found" which is expected
    console.error("[Parts Cache] Cache lookup error:", cacheError);
  }

  if (cached) {
    console.log("[Parts Cache] Cache hit:", {
      cacheKey,
      source: cached.source,
      priceRange: `$${cached.price_low} - $${cached.price_high}`,
      expiresAt: cached.expires_at,
    });
    return {
      source: cached.source,
      price_low: cached.price_low || 0,
      price_median: cached.price_median || 0,
      price_high: cached.price_high || 0,
    };
  }

  console.log("[Parts Cache] Cache miss, fetching from eBay:", { cacheKey, partName });

  // 2. Try eBay
  const ebayResult = await searchEbayParts(partName, year, make, model, trim);

  if (ebayResult && ebayResult.results_count >= 3) {
    console.log("[Parts Cache] eBay result received, caching:", {
      cacheKey,
      resultsCount: ebayResult.results_count,
      priceRange: `$${ebayResult.price_low} - $${ebayResult.price_high}`,
    });

    // Cache the result
    const { error: upsertError } = await supabaseAdmin.from("parts_price_cache").upsert({
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

    if (upsertError) {
      console.error("[Parts Cache] Failed to cache eBay result:", upsertError);
    } else {
      console.log("[Parts Cache] Successfully cached eBay result:", { cacheKey });
    }

    return {
      source: "ebay",
      price_low: ebayResult.price_low,
      price_median: ebayResult.price_median,
      price_high: ebayResult.price_high,
    };
  }

  // 3. Fall back to static pricing
  console.log("[Parts Cache] Falling back to static pricing:", {
    cacheKey,
    reason: ebayResult ? `Insufficient results (${ebayResult.results_count} < 3)` : "eBay search failed",
  });
  const staticPrice = getStaticPartPrice(partName, year, make, model);
  return {
    source: "static",
    price_low: staticPrice.price_low,
    price_median: (staticPrice.price_low + staticPrice.price_high) / 2,
    price_high: staticPrice.price_high,
  };
}
