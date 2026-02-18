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
  } catch (error) {
    console.error("eBay parts search error:", error);
    return null;
  }
}
