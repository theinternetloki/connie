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

        // Use simplest possible configuration for maximum compatibility
        const config = {
          fps: 5, // Lower FPS for stability
          qrbox: { width: 300, height: 300 }, // Fixed size for consistency
          aspectRatio: 1.0
        };

        console.log("Starting scanner with simplified config");
        
        await scanner.start(
          { facingMode: "environment" },
          config,
          (decodedText, decodedResult) => {
            console.log("Scanner detected:", decodedText);
            console.log("Decoded result:", decodedResult);
            
            // Clean the scanned text - be more lenient with validation
            const cleanedVin = decodedText.trim().toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '');
            console.log("Cleaned VIN:", cleanedVin, "Length:", cleanedVin.length);
            
            // Accept any alphanumeric string 8+ chars (very lenient to catch anything)
            if (cleanedVin.length >= 8) {
              // Take first 17 characters if longer
              const finalVin = cleanedVin.substring(0, 17);
              console.log("Valid VIN detected, stopping scanner:", finalVin);
              scanner.stop().then(() => {
                scannerRef.current = null;
                setIsScanning(false);
                shouldStartScan.current = false;
                onScan(finalVin);
              }).catch((err) => {
                console.error("Error stopping scanner:", err);
                scannerRef.current = null;
                setIsScanning(false);
                shouldStartScan.current = false;
                onScan(finalVin);
              });
            } else {
              console.log("Scanned text too short, continuing scan");
            }
          },
          (errorMessage) => {
            // Only log actual errors, not "not found" which is normal
            if (errorMessage && 
                !errorMessage.includes("NotFoundException") && 
                !errorMessage.includes("No MultiFormat Readers") &&
                !errorMessage.includes("QR code parse error")) {
              console.log("Scanner error:", errorMessage);
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
            <div className="space-y-2">
              <p className="text-sm text-gray-600 text-center">
                Point camera at VIN barcode. Ensure good lighting.
              </p>
              <p className="text-xs text-gray-500 text-center">
                Note: Barcode scanning may not work on all devices. Use "Enter Manually" if scanning fails.
              </p>
            </div>
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
