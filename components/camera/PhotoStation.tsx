"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Camera, RotateCcw, Check } from "lucide-react";
import { PhotoStationConfig } from "@/lib/types";

interface PhotoStationProps {
  station: PhotoStationConfig;
  onCapture: (file: File) => void;
  onMultipleCapture?: (files: File[]) => void;
  onSkip?: () => void;
  currentPhoto?: string | null;
}

export function PhotoStation({
  station,
  onCapture,
  onMultipleCapture,
  onSkip,
  currentPhoto,
}: PhotoStationProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [photo, setPhoto] = useState<string | null>(currentPhoto || null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset photo and camera when station changes
  useEffect(() => {
    // Clean up previous photo URL if it exists
    if (photo && photo.startsWith("blob:")) {
      URL.revokeObjectURL(photo);
    }
    
    // Reset photo state to match currentPhoto prop
    setPhoto(currentPhoto || null);
    
    // Stop any existing camera stream
    stopCamera();
    
    // Start camera if no photo exists for this station
    if (!currentPhoto) {
      startCamera();
    }
    
    return () => {
      stopCamera();
    };
  }, [station.id, currentPhoto]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false, // Explicitly disable microphone/audio
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error("Camera error:", error);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `${station.id}.jpg`, {
              type: "image/jpeg",
            });
            const photoUrl = URL.createObjectURL(blob);
            setPhoto(photoUrl);
            stopCamera();
            onCapture(file);
          }
        }, "image/jpeg", 0.9);
      }
    }
  };

  const retakePhoto = () => {
    // Clean up previous photo URL
    if (photo && photo.startsWith("blob:")) {
      URL.revokeObjectURL(photo);
    }
    setPhoto(null);
    startCamera();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Stop camera when selecting from gallery
    stopCamera();

    if (files.length === 1) {
      // Single file - handle normally
      const file = files[0];
      const photoUrl = URL.createObjectURL(file);
      setPhoto(photoUrl);
      onCapture(file);
    } else {
      // Multiple files - don't show preview, just process all files
      // Call the multiple capture handler if available
      if (onMultipleCapture) {
        onMultipleCapture(files);
        // Show a message or first photo briefly
        const firstFile = files[0];
        const photoUrl = URL.createObjectURL(firstFile);
        setPhoto(photoUrl);
      } else {
        // Fallback: just capture the first file
        const firstFile = files[0];
        const photoUrl = URL.createObjectURL(firstFile);
        setPhoto(photoUrl);
        onCapture(firstFile);
      }
    }
    
    // Reset input so the same file can be selected again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-2xl font-bold">{station.label}</h2>
        <p className="text-muted-foreground mt-2">{station.description}</p>
      </div>

      <div className="relative w-full aspect-[4/3] bg-black rounded-lg overflow-hidden">
        {photo ? (
          <img
            src={photo}
            alt={station.label}
            className="w-full h-full object-contain"
          />
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />
          </>
        )}
      </div>

      <div className="flex gap-2">
        {photo ? (
          <>
            <Button onClick={retakePhoto} variant="outline" className="flex-1">
              <RotateCcw className="mr-2 h-4 w-4" />
              Retake
            </Button>
            <Button onClick={() => {}} className="flex-1" disabled>
              <Check className="mr-2 h-4 w-4" />
              Photo Captured
            </Button>
          </>
        ) : (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              className="flex-1"
            >
              Choose from Gallery (Multiple)
            </Button>
            <Button onClick={capturePhoto} className="flex-1">
              <Camera className="mr-2 h-4 w-4" />
              Capture Photo
            </Button>
          </>
        )}
      </div>

      {!station.required && onSkip && (
        <Button onClick={onSkip} variant="ghost" className="w-full">
          Skip (Optional)
        </Button>
      )}
    </div>
  );
}
