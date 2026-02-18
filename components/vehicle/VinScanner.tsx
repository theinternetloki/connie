"use client";

import { useEffect, useRef, useState } from "react";
import {
  BrowserMultiFormatReader,
  BarcodeFormat,
} from "@zxing/browser";
import { DecodeHintType } from "@zxing/library";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

// VIN: exactly 17 chars, A-Z 0-9, excluding I, O, Q
function isValidVin(value: string): boolean {
  return /^[A-HJ-NPR-Z0-9]{17}$/i.test(value);
}

// Code 39 uses * as start/stop delimiters; some decoders leave them in
function cleanBarcode(raw: string): string {
  return raw.replace(/\*/g, "").trim().toUpperCase();
}

interface VinScannerProps {
  onScan: (vin: string) => void;
  onClose: () => void;
}

export default function VinScanner({ onScan, onClose }: VinScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<any>(null); // IScannerControls - using any to avoid type issues
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>("Initializing camera...");
  const hasScanned = useRef(false);

  useEffect(() => {
    // ===================================================
    // KEY FIX: Configure hints for 1D barcode formats
    // Without this, ZXing defaults to a scanning mode
    // that is optimized for QR codes and often fails
    // to decode Code 39 / Code 128 barcodes.
    // ===================================================
    const hints = new Map();

    // Restrict to VIN-relevant barcode formats ONLY.
    // This is critical — fewer formats = faster + more accurate scanning.
    // Code 39 is the most common VIN format, Code 128 is second.
    const formats = [
      BarcodeFormat.CODE_39,
      BarcodeFormat.CODE_128,
      BarcodeFormat.PDF_417,     // Found on registration docs
      BarcodeFormat.DATA_MATRIX, // GM newer models
      BarcodeFormat.QR_CODE,     // Ford window stickers
    ];
    hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);

    // DO NOT set TRY_HARDER — it causes a silent failure in
    // @zxing/browser where the video element goes blank and
    // the camera disconnects. This is a known bug:
    // https://github.com/zxing-js/browser/issues/74
    //
    // hints.set(DecodeHintType.TRY_HARDER, true); // <-- DO NOT USE

    // Create the reader WITH hints passed to constructor
    const reader = new BrowserMultiFormatReader(hints);
    readerRef.current = reader;

    // Note: timeBetweenDecodingAttempts is not directly configurable in @zxing/browser
    // The library handles timing internally. The decodeFromVideoDevice callback
    // will be called as frames are processed.

    let isMounted = true;

    async function startScanning() {
      if (!videoRef.current || !isMounted) return;

      try {
        // List available video devices to pick the best camera
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();

        if (devices.length === 0) {
          setError("No camera found on this device.");
          return;
        }

        setDebugInfo(`Found ${devices.length} camera(s). Starting...`);

        // Try to find the best rear camera.
        // On Samsung phones with 3+ cameras, the default is often the
        // ultra-wide (0.6x) which produces fisheye distortion that
        // makes barcodes unreadable. We want the main "back" camera.
        let selectedDeviceId: string | undefined = undefined;
        
        const rearCameras = devices.filter(
          (d) =>
            d.label.toLowerCase().includes("back") ||
            d.label.toLowerCase().includes("rear") ||
            d.label.toLowerCase().includes("environment")
        );
        
        if (rearCameras.length > 0) {
          // Prefer the one that's NOT ultra-wide or telephoto
          const mainRear = rearCameras.find(
            (d) =>
              !d.label.toLowerCase().includes("wide") &&
              !d.label.toLowerCase().includes("tele") &&
              !d.label.toLowerCase().includes("ultra")
          );
          selectedDeviceId = (mainRear || rearCameras[0]).deviceId;
        } else {
          // Fallback: use the last device (often the rear camera)
          selectedDeviceId = devices[devices.length - 1].deviceId;
        }

        setDebugInfo("Opening camera...");

        // decodeFromVideoDevice starts the camera and continuously
        // scans for barcodes, calling our callback on each result.
        //
        // IMPORTANT: We use decodeFromVideoDevice instead of
        // decodeFromConstraints because it handles device selection
        // more reliably across browsers.
        // Note: decodeFromVideoDevice returns IScannerControls directly, not a Promise
        controlsRef.current = reader.decodeFromVideoDevice(
          selectedDeviceId,
          videoRef.current,
          (result, error, controls) => {
            if (!isMounted || hasScanned.current) return;

            if (result) {
              const raw = result.getText();
              const cleaned = cleanBarcode(raw);
              const format = result.getBarcodeFormat();

              setDebugInfo(
                `Read: "${cleaned}" (${BarcodeFormat[format]})`
              );

              if (isValidVin(cleaned)) {
                hasScanned.current = true;
                controls.stop(); // Stop camera immediately
                onScan(cleaned);
              }
              // If it decoded a barcode but it's not a valid VIN,
              // keep scanning. This handles stickers, price tags, etc.
            }

            // error fires every frame where no barcode is found — this is normal.
            // DO NOT log or display these. Only real errors are caught in the
            // outer try/catch.
          }
        );

        if (isMounted) {
          setDebugInfo("Scanning... point at VIN barcode");
        }
      } catch (err: any) {
        if (!isMounted) return;
        console.error("Scanner init error:", err);

        if (err.name === "NotAllowedError") {
          setError(
            "Camera permission denied. Please allow camera access in your browser settings and reload."
          );
        } else if (err.name === "NotFoundError") {
          setError("No camera found on this device.");
        } else if (err.name === "NotReadableError") {
          setError(
            "Camera is already in use by another app. Please close other camera apps and try again."
          );
        } else if (err.name === "OverconstrainedError") {
          setError("Camera doesn't support the requested settings. Try again.");
        } else {
          setError(`Camera error: ${err.message || "Unknown error"}`);
        }
      }
    }

    startScanning();

    // Cleanup function — runs on unmount
    return () => {
      isMounted = false;
      hasScanned.current = true;

      // Stop the continuous decode loop and release the camera
      if (controlsRef.current) {
        try {
          // controlsRef.current is IScannerControls which has a stop() method
          if (typeof controlsRef.current === "object" && "stop" in controlsRef.current) {
            (controlsRef.current as any).stop();
          }
        } catch (e) {
          // Ignore cleanup errors
        }
      }

      // Note: BrowserMultiFormatReader doesn't have a reset() method
      // Stopping the controls and releasing the media tracks is sufficient

      // Release camera stream from video element
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }
    };
  }, []); // Empty deps — only run once on mount

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
          <X className="h-4 w-4 mr-1" />
          Cancel
        </Button>
        <span className="text-white text-sm font-semibold">Scan VIN Barcode</span>
        <div className="w-16" /> {/* Spacer for alignment */}
      </div>

      {/* Camera feed */}
      {error ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-4">
            <p className="text-red-400 text-lg mb-4">{error}</p>
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
          {/*
            VIDEO ELEMENT — Critical attributes:
            - playsInline: REQUIRED for iOS. Without it, Safari opens
              fullscreen video player and breaks everything.
            - muted: Required alongside playsInline on iOS for autoplay.
            - autoPlay: Let the browser start playback as soon as stream attaches.
            - The style ensures the video fills the container.
          */}
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />

          {/* Scanning guide overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {/* Semi-transparent background */}
            <div className="absolute inset-0 bg-black/30" />

            {/* Scan target area — wide rectangle for 1D barcodes */}
            <div className="relative z-10 w-[90%] max-w-lg px-4">
              <div
                className="border-2 border-white rounded-lg relative"
                style={{
                  aspectRatio: "5 / 1", // Wide and narrow — matches 1D barcode shape
                  backgroundColor: "transparent",
                  // Cut out the overlay so the barcode area is clear
                  boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.3)",
                }}
              >
                {/* Animated scan line */}
                <div className="absolute inset-x-1 top-1/2 -translate-y-1/2 h-0.5 bg-green-400 animate-pulse" />
              </div>

              <p className="text-white text-center text-sm mt-4 font-medium drop-shadow-lg">
                Point camera at the VIN barcode
              </p>
              <p className="text-white/60 text-center text-xs mt-1">
                Lower-left windshield or driver door jamb
              </p>
            </div>
          </div>

          {/* Debug info — remove in production */}
          <div className="absolute bottom-20 left-0 right-0 text-center">
            <p className="text-green-400/80 text-xs font-mono">{debugInfo}</p>
          </div>
        </div>
      )}

      {/* Manual entry fallback — always visible */}
      <div className="p-4 bg-black/90">
        <Button
          onClick={onClose}
          variant="ghost"
          className="w-full text-center text-white/70 hover:text-white hover:bg-white/10 text-sm"
        >
          Can't scan? Enter VIN manually
        </Button>
      </div>
    </div>
  );
}
