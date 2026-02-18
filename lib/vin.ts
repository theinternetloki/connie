export interface VINDecodeResult {
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  bodyStyle?: string;
}

export async function decodeVIN(vin: string): Promise<VINDecodeResult> {
  try {
    // Use the flat format endpoint for easier parsing
    // Reference: https://vpic.nhtsa.dot.gov/api/
    const response = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${vin}?format=json`
    );
    const data = await response.json();
    
    if (data.Results && data.Results.length > 0) {
      const result = data.Results[0]; // Flat format returns single object
      const decoded: VINDecodeResult = {};
      
      // Extract Model Year
      if (result.ModelYear && result.ModelYear !== "0") {
        decoded.year = parseInt(result.ModelYear);
      }
      
      // Extract Make
      if (result.Make && result.Make !== "0") {
        decoded.make = result.Make;
      }
      
      // Extract Model
      if (result.Model && result.Model !== "0") {
        decoded.model = result.Model;
      }
      
      // Extract Trim/Series
      if (result.Series && result.Series !== "0") {
        decoded.trim = result.Series;
      } else if (result.Trim && result.Trim !== "0") {
        decoded.trim = result.Trim;
      }
      
      // Extract Body Class
      if (result.BodyClass && result.BodyClass !== "0") {
        decoded.bodyStyle = result.BodyClass;
      }
      
      return decoded;
    }
    
    return {};
  } catch (error) {
    console.error("VIN decode error:", error);
    return {};
  }
}
