import { getEbayAccessToken } from "./ebay";

export interface EbayPartResult {
  title: string;
  price: number;
  currency: string;
  condition: string;
  itemUrl: string;
  imageUrl: string | null;
}

export interface PartsPriceResult {
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
  try {
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

    const searchUrl = `https://api.ebay.com/buy/browse/v1/item_summary/search?${params}`;
    console.log("[eBay Parts] Searching for parts:", {
      partName,
      year,
      make,
      model,
      trim,
      compatibilityFilter: compatFilter,
    });

    const response = await fetch(searchUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
        "X-EBAY-C-ENDUSERCTX":
          "contextualLocation=country=US,zip=37122", // Default to user location, make configurable
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[eBay Parts] API request failed:", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        partName,
        year,
        make,
        model,
      });
      return null;
    }

    const data = await response.json();
    console.log("[eBay Parts] Response received:", {
      totalResults: data.total,
      itemSummariesCount: data.itemSummaries?.length || 0,
      partName,
      year,
      make,
      model,
    });

    if (!data.itemSummaries || data.itemSummaries.length === 0) {
      console.log("[eBay Parts] No results found for:", { partName, year, make, model });
      return null;
    }

    // Extract prices from results, filtering to exact compatibility matches
    const allItems = data.itemSummaries.length;
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

    console.log("[eBay Parts] Filtered results:", {
      totalItems: allItems,
      compatibleItems: listings.length,
      compatibilityBreakdown: data.itemSummaries.reduce((acc: any, item: any) => {
        const match = item.compatibilityMatch || "UNKNOWN";
        acc[match] = (acc[match] || 0) + 1;
        return acc;
      }, {}),
    });

    if (listings.length === 0) {
      console.log("[eBay Parts] No compatible items found after filtering");
      return null;
    }

    const prices = listings.map((l) => l.price).sort((a, b) => a - b);
    const medianIndex = Math.floor(prices.length / 2);

    const result = {
      source: "ebay",
      query: `${partName} ${year} ${make} ${model}`,
      results_count: listings.length,
      price_low: prices[0],
      price_median: prices[medianIndex],
      price_high: prices[prices.length - 1],
      sample_listings: listings.slice(0, 5), // Keep top 5 for display
    };

    console.log("[eBay Parts] Price calculation complete:", {
      partName,
      resultsCount: result.results_count,
      priceRange: `$${result.price_low} - $${result.price_high}`,
      medianPrice: `$${result.price_median}`,
    });

    return result;
  } catch (error) {
    console.error("[eBay Parts] Search error:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      partName,
      year,
      make,
      model,
    });
    return null;
  }
}
