"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { Camera, X, Check } from "lucide-react";
import { resizeImage } from "@/lib/utils";
import { PhotoStrip } from "@/components/camera/PhotoStrip";

const MAX_PHOTOS = 10;

export default function CapturePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth(true);
  const [photos, setPhotos] = useState<
    Array<{ id: string; file: File; url: string }>
  >([]);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      router.push("/login");
      return;
    }
    
    const vehicle = sessionStorage.getItem("vehicle");
    if (!vehicle) {
      router.push("/vehicle-info");
    }
  }, [router, user, authLoading]);

  const handlePhotoCapture = (file: File) => {
    if (photos.length >= MAX_PHOTOS) {
      alert(`Maximum ${MAX_PHOTOS} photos allowed.`);
      return;
    }

    const url = URL.createObjectURL(file);
    setPhotos([
      ...photos,
      {
        id: `photo-${Date.now()}-${photos.length}`,
        file,
        url,
      },
    ]);
  };

  const handleMultiplePhotoCapture = (files: File[]) => {
    const remainingSlots = MAX_PHOTOS - photos.length;
    const filesToAdd = files.slice(0, remainingSlots);
    
    if (files.length > remainingSlots) {
      alert(`Only ${remainingSlots} more photos can be added (max ${MAX_PHOTOS} total).`);
    }

    const newPhotos = filesToAdd.map((file, index) => ({
      id: `photo-${Date.now()}-${photos.length + index}`,
      file,
      url: URL.createObjectURL(file),
    }));

    setPhotos([...photos, ...newPhotos]);
  };

  const handleRemovePhoto = (id: string) => {
    const photoToRemove = photos.find((p) => p.id === id);
    if (photoToRemove && photoToRemove.url.startsWith("blob:")) {
      URL.revokeObjectURL(photoToRemove.url);
    }
    setPhotos(photos.filter((p) => p.id !== id));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (files.length === 1) {
      handlePhotoCapture(files[0]);
    } else {
      handleMultiplePhotoCapture(files);
    }

    // Reset input
    e.target.value = '';
  };

  const proceedToAnalysis = async () => {
    if (photos.length === 0) {
      alert("Please add at least one photo before proceeding.");
      return;
    }

    setIsProcessing(true);
    try {
      // Convert to base64 for API (with compression)
      const photoData = await Promise.all(
        photos.map(async (p, index) => {
          try {
            const base64 = await resizeImage(p.file, 1200);
            return { base64, station: `photo_${index + 1}` };
          } catch (error) {
            console.error(`Error compressing photo ${index + 1}:`, error);
            const reader = new FileReader();
            return new Promise((resolve, reject) => {
              reader.onload = () => resolve({ base64: reader.result as string, station: `photo_${index + 1}` });
              reader.onerror = reject;
              reader.readAsDataURL(p.file);
            });
          }
        })
      );

      // Ensure vehicle data is still in sessionStorage
      const vehicle = sessionStorage.getItem("vehicle");
      if (!vehicle) {
        alert("Vehicle information is missing. Please start over.");
        router.push("/vehicle-info");
        return;
      }

      sessionStorage.setItem("photos", JSON.stringify(photoData));
      router.push("/analyzing");
    } catch (error) {
      console.error("Error preparing photos for analysis:", error);
      alert("Failed to prepare photos for analysis. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Photo Capture</h1>
          <p className="text-muted-foreground">
            Add up to {MAX_PHOTOS} photos of the vehicle ({photos.length}/{MAX_PHOTOS})
          </p>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  id="photo-input"
                />
                <Button
                  onClick={() => document.getElementById("photo-input")?.click()}
                  variant="outline"
                  className="flex-1"
                  disabled={photos.length >= MAX_PHOTOS}
                >
                  Choose from Gallery
                </Button>
                <Button
                  onClick={() => {
                    // Simple camera capture using file input
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = "image/*";
                    input.capture = "environment";
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file) handlePhotoCapture(file);
                    };
                    input.click();
                  }}
                  className="flex-1"
                  disabled={photos.length >= MAX_PHOTOS}
                >
                  <Camera className="mr-2 h-4 w-4" />
                  Take Photo
                </Button>
              </div>

              {photos.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Captured Photos</h3>
                  <PhotoStrip
                    photos={photos.map((p, index) => ({
                      id: p.id,
                      url: p.url,
                      label: `Photo ${index + 1}`,
                    }))}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    {photos.map((photo, index) => (
                      <div key={photo.id} className="relative group">
                        <div className="aspect-square rounded-lg overflow-hidden bg-gray-200">
                          <img
                            src={photo.url}
                            alt={`Photo ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleRemovePhoto(photo.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                          Photo {index + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Button
          onClick={proceedToAnalysis}
          disabled={isProcessing || photos.length === 0}
          className="w-full"
          size="lg"
        >
          {isProcessing ? (
            "Processing..."
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" />
              Proceed to Analysis ({photos.length} {photos.length === 1 ? "photo" : "photos"})
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
