"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { VehicleForm } from "@/components/vehicle/VehicleForm";
import { Vehicle } from "@/lib/types";

// Dynamic import for scanner (not needed here since VehicleForm handles it, but keeping for reference)
const VinScanner = dynamic(() => import("@/components/vehicle/VinScanner"), {
  ssr: false,
});

export default function VehicleInfoPage() {
  const router = useRouter();
  const [vehicleData, setVehicleData] = useState<Partial<Vehicle>>({});

  const handleSubmit = (vehicle: Vehicle) => {
    // Store in sessionStorage for the capture flow
    sessionStorage.setItem("vehicle", JSON.stringify(vehicle));
    router.push("/capture");
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
