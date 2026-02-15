export interface VINDecodeResult {
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  bodyStyle?: string;
}

export async function decodeVIN(vin: string): Promise<VINDecodeResult> {
  try {
    const response = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${vin}?format=json`
    );
    const data = await response.json();
    
    if (data.Results && data.Results.length > 0) {
      const result: VINDecodeResult = {};
      
      for (const item of data.Results) {
        if (item.Variable === "Model Year" && item.Value) {
          result.year = parseInt(item.Value);
        }
        if (item.Variable === "Make" && item.Value) {
          result.make = item.Value;
        }
        if (item.Variable === "Model" && item.Value) {
          result.model = item.Value;
        }
        if (item.Variable === "Trim" && item.Value) {
          result.trim = item.Value;
        }
        if (item.Variable === "Body Class" && item.Value) {
          result.bodyStyle = item.Value;
        }
      }
      
      return result;
    }
    
    return {};
  } catch (error) {
    console.error("VIN decode error:", error);
    return {};
  }
}
