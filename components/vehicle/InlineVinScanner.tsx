"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Camera, X } from "lucide-react";

interface InlineVinScannerProps {
  onScan: (vin: string) => void;
}

const SCANNER_ID = "inline-vin-scanner";

export function InlineVinScanner({ onScan }: InlineVinScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualVin, setManualVin] = useState("");
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

        // Try using file-based scanning as fallback, or use simpler config
        const config = {
          fps: 10, // Lower FPS might be more stable
          qrbox: function(viewfinderWidth, viewfinderHeight) {
            // Use larger scanning area - 90% of viewfinder
            const minEdgePercentage = 0.9;
            const minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight);
            const qrboxSize = Math.floor(minEdgeSize * minEdgePercentage);
            return {
              width: qrboxSize,
              height: qrboxSize
            };
          },
          aspectRatio: 1.0,
          disableFlip: false,
          rememberLastUsedCamera: true,
          showTorchButtonIfSupported: true
        };

        console.log("Starting scanner with config:", config);
        
        await scanner.start(
          { facingMode: "environment" },
          config,
          (decodedText) => {
            console.log("Scanner detected:", decodedText);
            
            // Clean the scanned text
            const cleanedVin = decodedText.trim().toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '');
            console.log("Cleaned VIN:", cleanedVin, "Length:", cleanedVin.length);
            
            // Accept VINs that are at least 10 characters (partial VINs) up to 17 characters
            // Also accept any alphanumeric string 10+ chars as it might be a VIN
            if (cleanedVin.length >= 10 && cleanedVin.length <= 17) {
              console.log("Valid VIN detected, stopping scanner");
              scanner.stop().then(() => {
                scannerRef.current = null;
                setIsScanning(false);
                shouldStartScan.current = false;
                onScan(cleanedVin);
              }).catch((err) => {
                console.error("Error stopping scanner:", err);
                scannerRef.current = null;
                setIsScanning(false);
                shouldStartScan.current = false;
                onScan(cleanedVin);
              });
            } else {
              console.log("Scanned text doesn't match VIN format, continuing scan");
            }
          },
          (errorMessage) => {
            // Log all errors for debugging
            if (!errorMessage.includes("NotFoundException") && !errorMessage.includes("No MultiFormat Readers")) {
              console.log("Scanner error (non-critical):", errorMessage);
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
    setShowManualInput(false);
    setManualVin("");
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
          {!error && !showManualInput && (
            <p className="text-sm text-gray-600 text-center">
              Point camera at VIN barcode. Ensure good lighting.
            </p>
          )}
          {showManualInput && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 text-center">
                Having trouble scanning? Enter VIN manually:
              </p>
              <input
                type="text"
                value={manualVin}
                onChange={(e) => setManualVin(e.target.value.toUpperCase())}
                placeholder="Enter 17-character VIN"
                maxLength={17}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-center text-lg font-mono tracking-wider"
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    if (manualVin.length >= 10) {
                      onScan(manualVin);
                      setShowManualInput(false);
                      stopScan();
                    }
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  disabled={manualVin.length < 10}
                >
                  Use VIN
                </Button>
                <Button
                  onClick={() => {
                    setShowManualInput(false);
                    setManualVin("");
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
          {!showManualInput && (
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setShowManualInput(true);
                }}
                variant="outline"
                className="flex-1"
              >
                Enter Manually
              </Button>
              <Button onClick={stopScan} variant="outline" className="flex-1">
                <X className="mr-2 h-4 w-4" />
                Stop Scanning
              </Button>
            </div>
          )}
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
