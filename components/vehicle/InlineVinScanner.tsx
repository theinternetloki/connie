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

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            scanner.stop().then(() => {
              scannerRef.current = null;
              setIsScanning(false);
              shouldStartScan.current = false;
              onScan(decodedText.trim());
            }).catch(() => {
              scannerRef.current = null;
              setIsScanning(false);
              shouldStartScan.current = false;
              onScan(decodedText.trim());
            });
          },
          (errorMessage) => {
            // Ignore scanning errors, just keep trying
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
          <div
            id={SCANNER_ID}
            className="w-full aspect-square bg-black rounded-lg overflow-hidden"
          />
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700 text-center">{error}</p>
            </div>
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
