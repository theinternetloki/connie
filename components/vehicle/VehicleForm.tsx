"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Vehicle } from "@/lib/types";
import { decodeVIN } from "@/lib/vin";
import { InlineVinScanner } from "./InlineVinScanner";

interface VehicleFormProps {
  onSubmit: (vehicle: Vehicle) => void;
  initialData?: Partial<Vehicle>;
}

const makes = [
  "Toyota", "Honda", "Ford", "Chevrolet", "Nissan", "BMW", "Mercedes-Benz",
  "Audi", "Lexus", "Acura", "Volkswagen", "Hyundai", "Kia", "Mazda",
  "Subaru", "Jeep", "Ram", "GMC", "Cadillac", "Lincoln", "Other"
];

const years = Array.from({ length: 30 }, (_, i) => 2024 - i);

export function VehicleForm({ onSubmit, initialData }: VehicleFormProps) {
  const [formData, setFormData] = useState<Partial<Vehicle>>({
    year: initialData?.year,
    make: initialData?.make || "",
    model: initialData?.model || "",
    trim: initialData?.trim || "",
    mileage: initialData?.mileage,
    vin: initialData?.vin || "",
  });
  const [isDecoding, setIsDecoding] = useState(false);

  const handleVINChange = async (vin: string) => {
    // Clean VIN - remove spaces and convert to uppercase
    const cleanVin = vin.replace(/\s+/g, "").toUpperCase();
    setFormData({ ...formData, vin: cleanVin });
    
    // Decode VIN when it's 17 characters
    if (cleanVin.length === 17) {
      setIsDecoding(true);
      try {
        const decoded = await decodeVIN(cleanVin);
        if (decoded.year || decoded.make || decoded.model) {
          setFormData((prev) => ({
            ...prev,
            vin: cleanVin,
            year: decoded.year || prev.year,
            make: decoded.make || prev.make,
            model: decoded.model || prev.model,
            trim: decoded.trim || prev.trim,
          }));
        }
      } catch (error) {
        console.error("VIN decode error:", error);
      } finally {
        setIsDecoding(false);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      formData.year &&
      formData.make &&
      formData.model &&
      formData.mileage !== undefined
    ) {
      onSubmit(formData as Vehicle);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Label htmlFor="vin">VIN (Vehicle Identification Number)</Label>
        <div className="flex gap-2 mt-2">
          <Input
            id="vin"
            value={formData.vin}
            onChange={(e) => handleVINChange(e.target.value)}
            placeholder="Enter 17-character VIN"
            maxLength={17}
            className="flex-1 h-12 text-base border-gray-300 rounded-xl"
          />
          <InlineVinScanner onScan={(vin) => handleVINChange(vin)} />
        </div>
        {isDecoding && (
          <p className="text-sm text-gray-600 mt-2">
            Decoding VIN...
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="year">Year *</Label>
            <Select
              value={formData.year?.toString()}
              onValueChange={(value) =>
                setFormData({ ...formData, year: parseInt(value) })
              }
            >
              <SelectTrigger className="mt-2 h-12 text-base border-gray-300 rounded-xl">
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="make">Make *</Label>
            <Select
              value={formData.make}
              onValueChange={(value) => setFormData({ ...formData, make: value })}
            >
              <SelectTrigger className="mt-2 h-12 text-base border-gray-300 rounded-xl">
                <SelectValue placeholder="Select make" />
              </SelectTrigger>
              <SelectContent>
                {makes.map((make) => (
                  <SelectItem key={make} value={make}>
                    {make}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div>
        <Label htmlFor="model">Model *</Label>
        <Input
          id="model"
          value={formData.model}
          onChange={(e) => setFormData({ ...formData, model: e.target.value })}
          placeholder="e.g., Camry, F-150"
          className="mt-2 h-12 text-base border-gray-300 rounded-xl"
        />
      </div>

      <div>
        <Label htmlFor="trim">Trim (optional)</Label>
        <Input
          id="trim"
          value={formData.trim}
          onChange={(e) => setFormData({ ...formData, trim: e.target.value })}
          placeholder="e.g., LE, XLT, Limited"
          className="mt-2 h-12 text-base border-gray-300 rounded-xl"
        />
      </div>

      <div>
        <Label htmlFor="mileage">Mileage *</Label>
        <Input
          id="mileage"
          type="number"
          value={formData.mileage || ""}
          onChange={(e) =>
            setFormData({
              ...formData,
              mileage: parseInt(e.target.value) || undefined,
            })
          }
          placeholder="Enter mileage"
          className="mt-2 h-12 text-base border-gray-300 rounded-xl"
        />
      </div>

      <Button
        type="submit"
        className="w-full bg-blue-600 hover:bg-blue-700 font-semibold h-12"
        size="lg"
        disabled={
          !formData.year ||
          !formData.make ||
          !formData.model ||
          formData.mileage === undefined
        }
      >
        Continue to Photo Capture
      </Button>
    </form>
  );
}
