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
      <div className="min-h-screen bg-white p-4 sm:p-6 lg:p-8">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 sm:px-8 py-6 border-b border-gray-100">
              <h1 className="text-2xl font-bold text-gray-900">Scan VIN Barcode</h1>
            </div>
            <div className="p-6 sm:p-8">
              <VinScanner
                onScan={handleVINScan}
                onManualEnter={() => setShowScanner(false)}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 sm:px-8 py-6 border-b border-gray-100">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
              Vehicle Information
            </h1>
          </div>
          <div className="p-6 sm:p-8">
            <VehicleForm onSubmit={handleSubmit} initialData={vehicleData} />
          </div>
        </div>
      </div>
    </div>
  );
}
