"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, X } from "lucide-react";

interface VinScannerProps {
  onScan: (vin: string) => void;
  onManualEnter: () => void;
}

export function VinScanner({ onScan, onManualEnter }: VinScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const startScan = async () => {
    try {
      setError(null);
      setIsScanning(true);

      const scanner = new Html5Qrcode("vin-scanner");
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
      <div className="space-y-4">
        <div
          ref={containerRef}
          id="vin-scanner"
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
    );
  }

  return (
    <div className="space-y-4">
      <Button onClick={startScan} className="w-full" size="lg">
        <Camera className="mr-2 h-4 w-4" />
        Scan VIN Barcode
      </Button>
      <div className="text-center text-sm text-muted-foreground">or</div>
      <Button onClick={onManualEnter} variant="outline" className="w-full">
        Enter VIN Manually
      </Button>
    </div>
  );
}
