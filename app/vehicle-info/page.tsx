"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { VehicleForm } from "@/components/vehicle/VehicleForm";
import { VinScanner } from "@/components/vehicle/VinScanner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Vehicle } from "@/lib/types";

export default function VehicleInfoPage() {
  const router = useRouter();
  const [showScanner, setShowScanner] = useState(false);
  const [vehicleData, setVehicleData] = useState<Partial<Vehicle>>({});

  const handleVINScan = (vin: string) => {
    setVehicleData({ ...vehicleData, vin });
    setShowScanner(false);
  };

  const handleSubmit = (vehicle: Vehicle) => {
    // Store in sessionStorage for the capture flow
    sessionStorage.setItem("vehicle", JSON.stringify(vehicle));
    router.push("/capture");
  };

  if (showScanner) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Scan VIN Barcode</CardTitle>
          </CardHeader>
          <CardContent>
            <VinScanner
              onScan={handleVINScan}
              onManualEnter={() => setShowScanner(false)}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Vehicle Information</CardTitle>
        </CardHeader>
        <CardContent>
          <VehicleForm onSubmit={handleSubmit} initialData={vehicleData} />
        </CardContent>
      </Card>
    </div>
  );
}
