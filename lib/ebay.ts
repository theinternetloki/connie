interface EbayToken {
  access_token: string;
  expires_at: number;
}

let cachedToken: EbayToken | null = null;

export async function getEbayAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expires_at > Date.now() + 60000) {
    console.log("[eBay Auth] Using cached token, expires at:", new Date(cachedToken.expires_at).toISOString());
    return cachedToken.access_token;
  }

  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("[eBay Auth] API credentials not configured");
    throw new Error("eBay API credentials not configured");
  }

  console.log("[eBay Auth] Requesting new access token");
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

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

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[eBay Auth] Token request failed:", {
      status: response.status,
      statusText: response.statusText,
      error: errorText,
    });
    throw new Error(`eBay auth failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  console.log("[eBay Auth] Token received successfully:", {
    token_type: data.token_type,
    expires_in: data.expires_in,
    expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  });

  cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };

  return cachedToken.access_token;
}
