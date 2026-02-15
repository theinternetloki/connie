"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PhotoStation } from "@/components/camera/PhotoStation";
import { StationGuide } from "@/components/camera/StationGuide";
import { PhotoStrip } from "@/components/camera/PhotoStrip";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  PhotoStationConfig,
  PhotoStation as PhotoStationType,
} from "@/lib/types";
import { ArrowRight, ArrowLeft } from "lucide-react";

const PHOTO_STATIONS: PhotoStationConfig[] = [
  {
    id: "front_exterior",
    label: "Front Exterior",
    description: "Take a photo of the front of the vehicle",
    required: true,
  },
  {
    id: "passenger_side_exterior",
    label: "Passenger Side",
    description: "Take a photo of the passenger side of the vehicle",
    required: true,
  },
  {
    id: "rear_exterior",
    label: "Rear Exterior",
    description: "Take a photo of the rear of the vehicle",
    required: true,
  },
  {
    id: "driver_side_exterior",
    label: "Driver Side",
    description: "Take a photo of the driver side of the vehicle",
    required: true,
  },
  {
    id: "driver_side_interior",
    label: "Driver Side Interior",
    description: "Take a photo of the dashboard, steering wheel, and driver seat",
    required: true,
  },
  {
    id: "passenger_side_interior",
    label: "Passenger Side Interior",
    description: "Take a photo of the passenger side interior",
    required: true,
  },
  {
    id: "roof",
    label: "Roof / Top View",
    description: "Take a photo of the roof or top of the vehicle",
    required: false,
  },
];

export default function CapturePage() {
  const router = useRouter();
  const [currentStationIndex, setCurrentStationIndex] = useState(0);
  const [photos, setPhotos] = useState<
    Array<{ id: string; file: File; url: string; station: PhotoStationType }>
  >([]);
  const [damagePhotos, setDamagePhotos] = useState<
    Array<{ id: string; file: File; url: string }>
  >([]);

  useEffect(() => {
    const vehicle = sessionStorage.getItem("vehicle");
    if (!vehicle) {
      router.push("/vehicle-info");
    }
  }, [router]);

  const handlePhotoCapture = (file: File) => {
    const station = PHOTO_STATIONS[currentStationIndex];
    const url = URL.createObjectURL(file);
    setPhotos([
      ...photos,
      {
        id: `${station.id}-${Date.now()}`,
        file,
        url,
        station: station.id as PhotoStationType,
      },
    ]);
  };

  const handleDamagePhoto = (file: File) => {
    const url = URL.createObjectURL(file);
    setDamagePhotos([
      ...damagePhotos,
      { id: `damage-${Date.now()}`, file, url },
    ]);
  };

  const handleNext = () => {
    if (currentStationIndex < PHOTO_STATIONS.length - 1) {
      setCurrentStationIndex(currentStationIndex + 1);
    } else {
      // All stations complete, proceed to analysis
      proceedToAnalysis();
    }
  };

  const handlePrevious = () => {
    if (currentStationIndex > 0) {
      setCurrentStationIndex(currentStationIndex - 1);
    }
  };

  const proceedToAnalysis = async () => {
    // Store photos in sessionStorage
    const allPhotos = [
      ...photos.map((p) => ({ file: p.file, station: p.station })),
      ...damagePhotos.map((p) => ({ file: p.file, station: "damage_closeup" as PhotoStationType })),
    ];

    // Convert to base64 for API
    const photoData = await Promise.all(
      allPhotos.map(async (p) => {
        const base64 = await fileToBase64(p.file);
        return { base64, station: p.station };
      })
    );

    sessionStorage.setItem("photos", JSON.stringify(photoData));
    router.push("/analyzing");
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const currentStation = PHOTO_STATIONS[currentStationIndex];
  const currentPhoto = photos.find(
    (p) => p.station === currentStation.id
  )?.url;

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Photo Capture</h1>
          <p className="text-muted-foreground">
            Step {currentStationIndex + 1} of {PHOTO_STATIONS.length}
          </p>
        </div>

        <StationGuide station={currentStation} />

        <Card>
          <CardContent className="p-4">
            <PhotoStation
              station={currentStation}
              onCapture={handlePhotoCapture}
              onSkip={
                !currentStation.required
                  ? () => handleNext()
                  : undefined
              }
              currentPhoto={currentPhoto}
            />
          </CardContent>
        </Card>

        {photos.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-2">Captured Photos</h3>
            <PhotoStrip
              photos={photos.map((p) => ({
                id: p.id,
                url: p.url,
                label: PHOTO_STATIONS.find((s) => s.id === p.station)?.label || "",
              }))}
            />
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={handlePrevious}
            variant="outline"
            disabled={currentStationIndex === 0}
            className="flex-1"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Previous
          </Button>
          <Button
            onClick={handleNext}
            disabled={
              currentStation.required &&
              !photos.find((p) => p.station === currentStation.id)
            }
            className="flex-1"
          >
            Next
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        <Button
          onClick={() => {
            // Trigger damage photo capture
            const input = document.createElement("input");
            input.type = "file";
            input.accept = "image/*";
            input.capture = "environment";
            input.onchange = (e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (file) handleDamagePhoto(file);
            };
            input.click();
          }}
          variant="outline"
          className="w-full"
        >
          Add Damage Close-up
        </Button>
      </div>
    </div>
  );
}
