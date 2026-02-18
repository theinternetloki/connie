"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useZxing } from "react-zxing";
import { Button } from "@/components/ui/button";
import { X, Lightbulb } from "lucide-react";

// VIN is exactly 17 characters, alphanumeric, excluding I, O, Q
function isValidVin(value: string): boolean {
  if (value.length !== 17) return false;
  return /^[A-HJ-NPR-Z0-9]{17}$/i.test(value);
}

// Sometimes barcodes include leading/trailing asterisks (Code 39 start/stop chars)
function cleanVinFromBarcode(raw: string): string {
  return raw.replace(/\*/g, "").trim().toUpperCase();
}

interface VinScannerProps {
  onScan: (vin: string) => void;
  onClose: () => void;
}

export default function VinScanner({ onScan, onClose }: VinScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(true);
  const [torchOn, setTorchOn] = useState(false);
  const hasScanned = useRef(false);

  const {
    ref,
    torch: { on: torchEnable, off: torchDisable, isAvailable: torchAvailable },
  } = useZxing({
    paused: !scanning,
    timeBetweenDecodingAttempts: 300, // ms between decode attempts
    onDecodeResult(result) {
      if (hasScanned.current) return;

      const raw = result.getText();
      const cleaned = cleanVinFromBarcode(raw);

      if (isValidVin(cleaned)) {
        hasScanned.current = true;
        setScanning(false);
        onScan(cleaned);
      }
      // If not a valid VIN, silently ignore and keep scanning.
      // This prevents false positives from other barcodes in the environment.
    },
    onDecodeError(err) {
      // This fires on EVERY frame that doesn't contain a barcode.
      // Do NOT show this to the user — it's normal behavior.
      // Only log for debugging if needed:
      // console.debug("No barcode found in frame:", err.message);
    },
    onError(err) {
      // This fires for actual errors (camera permission denied, etc.)
      console.error("Scanner error:", err);
      if (err.name === "NotAllowedError") {
        setError("Camera permission denied. Please allow camera access and try again.");
      } else if (err.name === "NotFoundError") {
        setError("No camera found on this device.");
      } else if (err.name === "NotReadableError") {
        setError("Camera is in use by another application.");
      } else {
        setError("Could not start camera. Please try again.");
      }
    },
    constraints: {
      video: {
        facingMode: "environment", // Use rear camera
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    },
  });

  const toggleTorch = useCallback(() => {
    if (torchOn) {
      torchDisable();
      setTorchOn(false);
    } else {
      torchEnable();
      setTorchOn(true);
    }
  }, [torchOn, torchEnable, torchDisable]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      hasScanned.current = true; // prevent callbacks after unmount
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/80 z-10">
        <Button
          onClick={onClose}
          variant="ghost"
          size="sm"
          className="text-white hover:bg-white/20"
        >
          Cancel
        </Button>
        <span className="text-white text-sm font-semibold">Scan VIN Barcode</span>
        {torchAvailable && (
          <Button
            onClick={toggleTorch}
            variant="ghost"
            size="sm"
            className={`text-sm font-medium ${
              torchOn ? "text-yellow-400 hover:bg-yellow-400/20" : "text-white hover:bg-white/20"
            }`}
          >
            <Lightbulb className={`h-4 w-4 mr-1 ${torchOn ? "fill-current" : ""}`} />
            {torchOn ? "ON" : "OFF"}
          </Button>
        )}
        {!torchAvailable && <div className="w-16" />}
      </div>

      {/* Camera feed */}
      {error ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-4">
            <p className="text-white text-lg mb-4">{error}</p>
            <Button
              onClick={onClose}
              className="bg-white text-black hover:bg-gray-100"
            >
              Go Back
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex-1 relative overflow-hidden">
          {/* Video element — react-zxing attaches the camera stream to this ref */}
          <video
            ref={ref}
            className="absolute inset-0 w-full h-full object-cover"
            playsInline  // CRITICAL for iOS — without this, Safari opens fullscreen video player
            muted        // Required alongside playsInline on some iOS versions
            autoPlay
          />

          {/* Scanning guide overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {/* Darken everything except the scan area */}
            <div className="absolute inset-0 bg-black/40" />

            {/* Scan window cutout */}
            <div className="relative z-10 w-[85%] max-w-md">
              {/* The rectangular scan target area */}
              <div
                className="border-2 border-white/80 rounded-lg bg-transparent"
                style={{ aspectRatio: "4 / 1" }} // VIN barcodes are wide and narrow
              >
                {/* Corner markers */}
                <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-white rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-white rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-white rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-white rounded-br-lg" />

                {/* Animated scan line */}
                <div className="absolute inset-x-2 top-1/2 h-0.5 bg-green-400/80 animate-pulse" />
              </div>

              {/* Instruction text */}
              <p className="text-white text-center text-sm mt-4 drop-shadow-lg font-medium">
                Align the VIN barcode within the frame
              </p>
              <p className="text-white/60 text-center text-xs mt-1">
                Usually found on the lower-left windshield or driver door jamb
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Manual entry fallback */}
      <div className="p-4 bg-black/80">
        <Button
          onClick={onClose}
          variant="ghost"
          className="w-full text-center text-white/70 hover:text-white hover:bg-white/10 text-sm"
        >
          Enter VIN manually instead
        </Button>
      </div>
    </div>
  );
}
