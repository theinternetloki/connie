"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Camera, X } from "lucide-react";

interface InlineVinScannerProps {
  onScan: (vin: string) => void;
}

export function InlineVinScanner({ onScan }: InlineVinScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerId = useRef(`scanner-${Math.random().toString(36).substr(2, 9)}`);

  const startScan = async () => {
    try {
      setError(null);
      setIsScanning(true);

      const scanner = new Html5Qrcode(scannerId.current);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          scanner.stop();
          scannerRef.current = null;
          setIsScanning(false);
          onScan(decodedText);
        },
        (errorMessage) => {
          // Ignore scanning errors, just keep trying
        }
      );
    } catch (err: any) {
      setError(err.message || "Failed to start camera");
      setIsScanning(false);
      scannerRef.current = null;
    }
  };

  const stopScan = () => {
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
            id={scannerId.current}
            className="w-full aspect-square bg-black rounded-lg overflow-hidden"
          />
          {error && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}
          <Button onClick={stopScan} variant="outline" className="w-full">
            <X className="mr-2 h-4 w-4" />
            Stop Scanning
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button
      type="button"
      onClick={startScan}
      variant="outline"
      size="default"
      className="border-gray-300 hover:bg-gray-50 font-medium whitespace-nowrap"
    >
      <Camera className="mr-2 h-4 w-4" />
      Scan
    </Button>
  );
}
