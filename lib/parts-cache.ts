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
): Promise<{ 
  source: string; 
  price_low: number; 
  price_median: number; 
  price_high: number;
  product_link?: string; // eBay search URL for replacement parts
}> {
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
    
    // Generate eBay search URL if we have cached eBay data
    let productLink: string | undefined;
    if (cached.source === "ebay" && cached.raw_data) {
      const ebayData = cached.raw_data as any;
      if (ebayData.sample_listings && ebayData.sample_listings.length > 0) {
        // Use the first (cheapest) listing URL
        productLink = ebayData.sample_listings[0].itemUrl;
      } else {
        // Fallback to eBay search URL
        const searchQuery = encodeURIComponent(`${partName} ${year} ${make} ${model}`);
        productLink = `https://www.ebay.com/sch/i.html?_nkw=${searchQuery}&_sacat=6030`;
      }
    } else if (cached.source === "static") {
      // Generate eBay search URL for static-priced items
      const searchQuery = encodeURIComponent(`${partName} ${year} ${make} ${model}`);
      productLink = `https://www.ebay.com/sch/i.html?_nkw=${searchQuery}&_sacat=6030`;
    }
    
    return {
      source: cached.source,
      price_low: cached.price_low || 0,
      price_median: cached.price_median || 0,
      price_high: cached.price_high || 0,
      product_link: productLink,
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

    // Generate product link from eBay results
    const productLink = ebayResult.sample_listings && ebayResult.sample_listings.length > 0
      ? ebayResult.sample_listings[0].itemUrl
      : undefined;

    return {
      source: "ebay",
      price_low: ebayResult.price_low,
      price_median: ebayResult.price_median,
      price_high: ebayResult.price_high,
      product_link: productLink,
    };
  }

  // 3. Fall back to static pricing
  console.log("[Parts Cache] Falling back to static pricing:", {
    cacheKey,
    reason: ebayResult ? `Insufficient results (${ebayResult.results_count} < 3)` : "eBay search failed",
  });
  const staticPrice = getStaticPartPrice(partName, year, make, model);
  
  // Generate eBay search URL for static-priced items
  const searchQuery = encodeURIComponent(`${partName} ${year} ${make} ${model}`);
  const productLink = `https://www.ebay.com/sch/i.html?_nkw=${searchQuery}&_sacat=6030`;
  
  return {
    source: "static",
    price_low: staticPrice.price_low,
    price_median: (staticPrice.price_low + staticPrice.price_high) / 2,
    price_high: staticPrice.price_high,
    product_link: productLink,
  };
}
