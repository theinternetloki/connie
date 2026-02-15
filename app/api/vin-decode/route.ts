import { NextRequest, NextResponse } from "next/server";
import { decodeVIN } from "@/lib/vin";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const vin = searchParams.get("vin");

  if (!vin) {
    return NextResponse.json({ error: "VIN required" }, { status: 400 });
  }

  try {
    const result = await decodeVIN(vin);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "VIN decode failed" },
      { status: 500 }
    );
  }
}
