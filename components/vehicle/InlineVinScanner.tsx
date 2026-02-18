"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeScanType, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Camera, X } from "lucide-react";

interface InlineVinScannerProps {
  onScan: (vin: string) => void;
}

const SCANNER_ID = "inline-vin-scanner";

export function InlineVinScanner({ onScan }: InlineVinScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const shouldStartScan = useRef(false);

  const startScan = () => {
    setError(null);
    setIsScanning(true);
    shouldStartScan.current = true;
  };

  // Start the scanner after the modal is rendered
  useEffect(() => {
    if (!isScanning || !shouldStartScan.current) return;

    const initializeScanner = async () => {
      try {
        // Wait for the DOM element to be rendered
        await new Promise((resolve) => setTimeout(resolve, 200));

        const element = document.getElementById(SCANNER_ID);
        if (!element) {
          throw new Error("Scanner element not found");
        }

        const scanner = new Html5Qrcode(SCANNER_ID);
        scannerRef.current = scanner;

        // Get the container dimensions for better scanning area
        const container = document.getElementById(SCANNER_ID);
        const containerWidth = container?.clientWidth || 300;
        const containerHeight = container?.clientHeight || 300;
        
        // Use larger scanning area for better barcode detection (80% of container)
        const scanAreaSize = Math.min(containerWidth, containerHeight) * 0.8;

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 30, // Higher FPS for better barcode detection
            qrbox: function(viewfinderWidth, viewfinderHeight) {
              // Use 80% of the viewfinder for scanning area
              const minEdgePercentage = 0.8;
              const minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight);
              const qrboxSize = Math.floor(minEdgeSize * minEdgePercentage);
              return {
                width: qrboxSize,
                height: qrboxSize
              };
            },
            aspectRatio: 1.0,
            disableFlip: false, // Allow rotation for better detection
            supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
          },
          (decodedText) => {
            // Validate that it looks like a VIN (alphanumeric, typically 17 chars but can be shorter)
            const cleanedVin = decodedText.trim().toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '');
            
            // Accept VINs that are at least 10 characters (partial VINs) up to 17 characters
            if (cleanedVin.length >= 10 && cleanedVin.length <= 17 && /^[A-HJ-NPR-Z0-9]+$/.test(cleanedVin)) {
              scanner.stop().then(() => {
                scannerRef.current = null;
                setIsScanning(false);
                shouldStartScan.current = false;
                onScan(cleanedVin);
              }).catch(() => {
                scannerRef.current = null;
                setIsScanning(false);
                shouldStartScan.current = false;
                onScan(cleanedVin);
              });
            }
            // If not a valid VIN format, keep scanning silently
          },
          (errorMessage) => {
            // Ignore scanning errors, just keep trying
            // Only log if it's not a "not found" error (which is normal while scanning)
            if (!errorMessage.includes("NotFoundException") && !errorMessage.includes("No MultiFormat Readers")) {
              console.debug("Scanning...", errorMessage);
            }
          }
        );
      } catch (err: any) {
        console.error("Scanner error:", err);
        setError(err.message || "Failed to start camera. Please ensure camera permissions are granted.");
        setIsScanning(false);
        shouldStartScan.current = false;
        if (scannerRef.current) {
          scannerRef.current.stop().catch(() => {});
          scannerRef.current = null;
        }
      }
    };

    initializeScanner();
  }, [isScanning, onScan]);

  const stopScan = () => {
    shouldStartScan.current = false;
    if (scannerRef.current) {
      scannerRef.current
        .stop()
        .then(() => {
          scannerRef.current = null;
          setIsScanning(false);
        })
        .catch(() => {
          scannerRef.current = null;
          setIsScanning(false);
        });
    } else {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  if (isScanning) {
    return (
      <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Scan VIN Barcode</h3>
            <Button
              onClick={stopScan}
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className="relative">
            <div
              id={SCANNER_ID}
              className="w-full aspect-square bg-black rounded-lg overflow-hidden"
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="border-2 border-blue-500 rounded-lg w-3/4 h-3/4 flex items-center justify-center">
                <div className="text-white text-sm font-medium bg-black/50 px-3 py-1 rounded">
                  Position barcode here
                </div>
              </div>
            </div>
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700 text-center">{error}</p>
            </div>
          )}
          {!error && (
            <p className="text-sm text-gray-600 text-center">
              Point camera at VIN barcode. Ensure good lighting.
            </p>
          )}
          <Button onClick={stopScan} variant="outline" className="w-full">
            <X className="mr-2 h-4 w-4" />
            Stop Scanning
          </Button>
        </div>
      </div>
    );
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startScan();
  };

  return (
    <Button
      type="button"
      onClick={handleClick}
      variant="outline"
      size="default"
      className="border-gray-300 hover:bg-gray-50 font-medium whitespace-nowrap"
    >
      <Camera className="mr-2 h-4 w-4" />
      Scan
    </Button>
  );
}
