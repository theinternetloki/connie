# Cursor Prompt: Fix VIN Barcode Scanner (Not Capturing Data)

## The Problem

The VIN barcode scanner appears (camera feed is visible) but never successfully decodes a barcode. This is a known issue with using `react-zxing` for 1D barcodes like Code 39 and Code 128.

**Root cause:** `react-zxing` does not expose the `hints` parameter to the underlying ZXing `BrowserMultiFormatReader`. Without hints, ZXing uses its default multi-format reader which is optimized for QR codes and struggles with 1D barcodes — especially Code 39 (the most common VIN barcode format). There are also well-documented issues in `@zxing/library` GitHub issues where Code 39 scanning silently fails without specific format hints.

## The Fix

**Remove `react-zxing`. Use `@zxing/browser` and `@zxing/library` directly.** This gives us full control over the decoder hints, camera resolution, and scanning lifecycle.

### Step 1: Update packages

```bash
npm uninstall react-zxing
npm install @zxing/browser@latest @zxing/library@latest
```

### Step 2: Replace VinScanner component

Delete the existing VinScanner component and replace it with this implementation that uses `@zxing/browser` directly.

**Create `components/vehicle/VinScanner.tsx`:**

```tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  BrowserMultiFormatReader,
  BarcodeFormat,
} from "@zxing/browser";
import { DecodeHintType } from "@zxing/library";

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
  const controlsRef = useRef<ReturnType<
    BrowserMultiFormatReader["decodeFromVideoDevice"]
  > | null>(null);
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

    // Configure timing — how often to attempt a decode.
    // 200ms = 5 attempts/sec. Lower = more responsive but more CPU.
    reader.timeBetweenDecodingAttempts = 200;

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
        controlsRef.current = await reader.decodeFromVideoDevice(
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
          // controlsRef.current is a promise, need to handle both cases
          if (typeof controlsRef.current === "object" && "stop" in controlsRef.current) {
            (controlsRef.current as any).stop();
          }
        } catch (e) {
          // Ignore cleanup errors
        }
      }

      // Also reset the reader
      if (readerRef.current) {
        try {
          readerRef.current.reset();
        } catch (e) {
          // Ignore
        }
      }

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
        <button
          onClick={onClose}
          className="text-white text-sm font-medium px-3 py-2"
        >
          ✕ Cancel
        </button>
        <span className="text-white text-sm font-medium">Scan VIN Barcode</span>
        <div className="w-16" /> {/* Spacer for alignment */}
      </div>

      {/* Camera feed */}
      {error ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <p className="text-red-400 text-lg mb-4">{error}</p>
            <button
              onClick={onClose}
              className="bg-white text-black px-6 py-3 rounded-lg font-medium"
            >
              Go Back
            </button>
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
      <div className="p-4 bg-black/90 safe-area-bottom">
        <button
          onClick={onClose}
          className="w-full text-center text-white/70 text-sm py-3 underline"
        >
          Can't scan? Enter VIN manually
        </button>
      </div>
    </div>
  );
}
```

### Step 3: Keep the dynamic import in the parent page

The parent page (`vehicle-info/page.tsx`) should still use dynamic import with `ssr: false`:

```tsx
import dynamic from "next/dynamic";

const VinScanner = dynamic(
  () => import("@/components/vehicle/VinScanner"),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <p className="text-white">Loading scanner...</p>
      </div>
    ),
  }
);
```

This has NOT changed from before — it's still required because `@zxing/browser` uses browser APIs that crash during server-side rendering.

---

## Why This Works When `react-zxing` Didn't

| Issue | `react-zxing` | Direct `@zxing/browser` |
|---|---|---|
| **Hint configuration** | No way to pass `DecodeHintType.POSSIBLE_FORMATS` to the reader. The hook creates `BrowserMultiFormatReader` internally with no hints. | We pass a hints `Map` directly to the constructor, restricting formats to Code 39, Code 128, PDF417, Data Matrix, and QR. |
| **Code 39 support** | Multi-format reader without format hints deprioritizes 1D formats and often fails on Code 39 entirely (multiple open GitHub issues). | Explicitly listing `BarcodeFormat.CODE_39` forces ZXing to use the Code 39 decoder on every frame. |
| **Camera selection** | Uses `facingMode: "environment"` constraint, which on multi-camera phones often selects the ultra-wide lens. | Enumerates devices, identifies cameras by label, and selects the main rear camera — avoiding the ultra-wide fisheye. |
| **Decode timing** | Default `timeBetweenDecodingAttempts` may be too slow. | Explicitly set to 200ms (5 scans/sec). |
| **Cleanup** | Hook cleanup sometimes fails to stop the camera stream, leaving the camera light on. | Explicit triple cleanup: stop the decode controls, reset the reader, AND stop all media tracks. |

---

## Troubleshooting

### "Camera appears but still no scan"

1. **Check debug info line** — there's a green debug text at the bottom of the scanner showing status. It should say "Scanning... point at VIN barcode" when active.

2. **Test with a generated barcode first** — go to https://www.onlinetoolcenter.com/vin-barcode-generator/ and generate a Code 39 barcode for VIN `1HGCM82633A004352`. Display it on another screen and scan it. If this works, the issue is with the physical barcode quality (faded, behind tinted glass, etc.), not the scanner.

3. **Check camera distance** — VIN barcodes on windshields are often quite small. The phone needs to be 4-8 inches away, and the barcode should fill most of the scan area. Too close = out of focus. Too far = too small to decode.

4. **Try different lighting** — windshield glare is the #1 enemy. Move to a shaded area or change the angle to reduce reflections.

5. **Check which camera is selected** — if on a Samsung phone, the ultra-wide lens makes barcodes look tiny and distorted. The camera selection logic should handle this, but you can verify by checking if the video feed looks "fisheye."

### "Camera permission denied"

On iOS, camera access only works in Safari (not Chrome or Firefox — they use WKWebView which has limited camera support). On Android, it works in Chrome, Firefox, and Edge. Camera requires HTTPS (except localhost).

### "Works in dev but not in production"

Make sure your production URL is HTTPS. `getUserMedia` is blocked on non-secure origins.

---

## Testing Checklist

- [ ] Scanner opens and shows camera feed on iOS Safari
- [ ] Scanner opens and shows camera feed on Android Chrome
- [ ] Successfully scans a Code 39 barcode (generated, displayed on screen)
- [ ] Successfully scans a Code 128 barcode (generated)
- [ ] Successfully scans a QR code containing a VIN
- [ ] Ignores non-VIN barcodes (e.g., scan a random product barcode — should not trigger onScan)
- [ ] VIN is correctly cleaned (asterisks stripped, uppercased)
- [ ] Camera stops when a valid VIN is found
- [ ] Camera stops when user taps Cancel
- [ ] Camera stops when component unmounts (navigate away)
- [ ] Camera light turns off after closing scanner
- [ ] Manual entry fallback works
- [ ] Debug info shows scanning status
