# Cursor Prompt: Implement VIN Barcode Scanner

## Context

We're building a VIN barcode scanner for a Next.js 14 (App Router) vehicle reconditioning estimator app. The scanner needs to work reliably on mobile phones (both iOS and Android) to scan VIN barcodes on vehicle windshields.

**IMPORTANT: Do NOT use `html5-qrcode`.** It's a wrapper around an outdated version of ZXing-js, has known issues on mobile browsers (especially iPhones), and its built-in UI component fights with React's rendering lifecycle, causing blank camera feeds and stale refs.

## VIN Barcode Facts

VIN barcodes on vehicles come in multiple formats:
- **Code 39** — the most common, used by Ford, GM, Toyota, Honda, BMW on windshield labels and door jamb plates
- **Code 128** — used by Mercedes, Volkswagen, Volvo, and at auction houses
- **PDF417** — found on state registration documents and federal labels
- **Data Matrix** — used by GM on newer models
- **QR Code** — used by Ford on window stickers

The scanner MUST support Code 39 and Code 128 at minimum. Supporting PDF417, Data Matrix, and QR Code is a bonus.

A decoded VIN is always exactly 17 alphanumeric characters (A-Z, 0-9, excluding I, O, Q).

---

## Recommended Approach: `react-zxing` + `@zxing/library`

Use the `react-zxing` package. It's a lightweight React hook wrapper around `@zxing/library` (the standard JS barcode decoding library). It handles the camera lifecycle correctly in React, supports all the barcode formats we need, and works on both iOS and Android.

### Install

```bash
npm install react-zxing @zxing/library
```

### Implementation — `components/vehicle/VinScanner.tsx`

```tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useZxing } from "react-zxing";

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
        <button
          onClick={onClose}
          className="text-white text-sm font-medium px-3 py-2"
        >
          Cancel
        </button>
        <span className="text-white text-sm font-medium">Scan VIN Barcode</span>
        {torchAvailable && (
          <button
            onClick={toggleTorch}
            className={`text-sm font-medium px-3 py-2 ${
              torchOn ? "text-yellow-400" : "text-white"
            }`}
          >
            {torchOn ? "Light ON" : "Light OFF"}
          </button>
        )}
        {!torchAvailable && <div className="w-16" />}
      </div>

      {/* Camera feed */}
      {error ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <p className="text-white text-lg mb-4">{error}</p>
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
          {/* Video element — react-zxing attaches the camera stream to this ref */}
          <video
            ref={ref}
            className="absolute inset-0 w-full h-full object-cover"
            playsInline  // CRITICAL for iOS — without this, Safari opens fullscreen video player
            muted        // Required alongside playsInline on some iOS versions
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
              <p className="text-white text-center text-sm mt-4 drop-shadow-lg">
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
        <button
          onClick={onClose}
          className="w-full text-center text-white/70 text-sm py-2 underline"
        >
          Enter VIN manually instead
        </button>
      </div>
    </div>
  );
}
```

### Usage in VehicleInfo page — `app/vehicle-info/page.tsx`

```tsx
"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

// CRITICAL: Dynamic import with ssr: false
// react-zxing and @zxing/library use browser APIs (getUserMedia, canvas, etc.)
// They CANNOT run during server-side rendering.
const VinScanner = dynamic(() => import("@/components/vehicle/VinScanner"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      <p className="text-white">Loading scanner...</p>
    </div>
  ),
});

export default function VehicleInfoPage() {
  const [showScanner, setShowScanner] = useState(false);
  const [vin, setVin] = useState("");
  const [vehicleInfo, setVehicleInfo] = useState<any>(null);
  const [vinLoading, setVinLoading] = useState(false);

  const handleVinScanned = async (scannedVin: string) => {
    setVin(scannedVin);
    setShowScanner(false);
    await decodeVin(scannedVin);
  };

  const decodeVin = async (vinToDecode: string) => {
    if (!isValidVin(vinToDecode)) return;
    setVinLoading(true);
    try {
      const res = await fetch(
        `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${vinToDecode}?format=json`
      );
      const data = await res.json();

      // Extract useful fields from NHTSA response
      const get = (id: number) =>
        data.Results?.find((r: any) => r.VariableId === id)?.Value || "";

      setVehicleInfo({
        year: get(29),       // Model Year
        make: get(26),       // Make
        model: get(28),      // Model
        trim: get(38),       // Trim
        bodyClass: get(5),   // Body Class
        driveType: get(15),  // Drive Type
        engineCyl: get(9),   // Engine Number of Cylinders
        engineDisp: get(11), // Displacement (L)
        fuelType: get(24),   // Fuel Type - Primary
      });
    } catch (err) {
      console.error("VIN decode error:", err);
    } finally {
      setVinLoading(false);
    }
  };

  const handleManualVinSubmit = async () => {
    const cleaned = vin.trim().toUpperCase();
    setVin(cleaned);
    if (isValidVin(cleaned)) {
      await decodeVin(cleaned);
    }
  };

  return (
    <div className="max-w-lg mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Vehicle Information</h1>

      {/* VIN Input Section */}
      <div className="space-y-3">
        <label className="block text-sm font-medium">VIN Number</label>

        <div className="flex gap-2">
          <input
            type="text"
            value={vin}
            onChange={(e) => setVin(e.target.value.toUpperCase())}
            placeholder="Enter 17-character VIN"
            maxLength={17}
            className="flex-1 px-3 py-3 border rounded-lg text-lg font-mono tracking-wider uppercase"
          />
          <button
            onClick={() => setShowScanner(true)}
            className="px-4 py-3 bg-blue-600 text-white rounded-lg font-medium whitespace-nowrap"
          >
            Scan
          </button>
        </div>

        {vin.length > 0 && vin.length < 17 && (
          <p className="text-sm text-gray-500">
            {17 - vin.length} characters remaining
          </p>
        )}

        {vin.length === 17 && !vehicleInfo && (
          <button
            onClick={handleManualVinSubmit}
            disabled={vinLoading}
            className="w-full py-3 bg-gray-900 text-white rounded-lg font-medium"
          >
            {vinLoading ? "Decoding..." : "Decode VIN"}
          </button>
        )}
      </div>

      {/* Decoded Vehicle Info */}
      {vehicleInfo && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg space-y-2">
          <h2 className="font-semibold text-lg">
            {vehicleInfo.year} {vehicleInfo.make} {vehicleInfo.model}{" "}
            {vehicleInfo.trim}
          </h2>
          <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
            <div>Body: {vehicleInfo.bodyClass}</div>
            <div>Drive: {vehicleInfo.driveType}</div>
            <div>
              Engine: {vehicleInfo.engineDisp}L {vehicleInfo.engineCyl}-cyl
            </div>
            <div>Fuel: {vehicleInfo.fuelType}</div>
          </div>
        </div>
      )}

      {/* Scanner Modal */}
      {showScanner && (
        <VinScanner
          onScan={handleVinScanned}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}

function isValidVin(value: string): boolean {
  if (value.length !== 17) return false;
  return /^[A-HJ-NPR-Z0-9]{17}$/i.test(value);
}
```

---

## Critical Implementation Details (Read These Carefully)

### 1. Dynamic import with `ssr: false` is MANDATORY

`@zxing/library` references browser globals (`navigator`, `window`, `document`). If Next.js tries to import it during server-side rendering, you'll get `ReferenceError: navigator is not defined`.

```tsx
const VinScanner = dynamic(() => import("@/components/vehicle/VinScanner"), {
  ssr: false,
});
```

This is the single most common reason for the scanner "not working" in Next.js. Every component that imports from `react-zxing` or `@zxing/library` MUST be dynamically imported with `ssr: false`.

### 2. `playsInline` attribute is MANDATORY for iOS

Without `playsInline` on the `<video>` element, iOS Safari will hijack the video stream and open it in a fullscreen player, breaking the scanner completely. The `muted` attribute is also required on iOS for inline autoplay to work.

```tsx
<video ref={ref} playsInline muted />
```

`react-zxing` does NOT add these attributes automatically. You must add them yourself.

### 3. Do NOT display `onDecodeError` to the user

`react-zxing` fires `onDecodeError` on EVERY frame where no barcode is found. This is normal — it's scanning 3+ times per second, and most frames won't have a readable barcode. If you show these errors in the UI, you'll flood the screen with "NotFoundException" messages.

Only use `onError` (not `onDecodeError`) for actual problems like camera permission denial.

### 4. VIN validation prevents false positives

The environment may contain other barcodes (price stickers, license plate frames, etc.). By validating that the decoded string is exactly 17 characters and matches the VIN character set, we ignore non-VIN barcodes automatically without user confusion.

### 5. Code 39 start/stop characters

Code 39 barcodes use `*` as start and stop delimiters. Most decoders strip these automatically, but some don't. The `cleanVinFromBarcode` function strips asterisks just in case.

### 6. Camera selection on multi-camera phones

Modern phones have 3-4 cameras. `facingMode: "environment"` tells the browser to prefer the rear camera, but some Samsung phones default to the ultra-wide lens, which produces a fisheye effect that makes barcodes hard to decode. If scanning seems unreliable, you can enumerate cameras and let the user pick:

```tsx
const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
const [selectedDevice, setSelectedDevice] = useState<string | undefined>();

useEffect(() => {
  navigator.mediaDevices.enumerateDevices().then((allDevices) => {
    const videoDevices = allDevices.filter((d) => d.kind === "videoinput");
    setDevices(videoDevices);
    // Try to find the main rear camera (usually the second one on Samsung)
    const mainRear = videoDevices.find(
      (d) => d.label.toLowerCase().includes("back") && !d.label.toLowerCase().includes("wide")
    );
    if (mainRear) setSelectedDevice(mainRear.deviceId);
  });
}, []);

// Then pass to useZxing:
const { ref } = useZxing({
  deviceId: selectedDevice,
  // ... other options
});
```

### 7. HTTPS is required

Camera access (`getUserMedia`) requires a secure context. The scanner will not work over plain HTTP (except on localhost for development). Make sure your dev server uses HTTPS or you're on localhost.

### 8. Handling the case where scanning just doesn't work

Not all VIN barcodes are scannable — they can be faded, behind tinted glass, at a bad angle, or in a format the scanner struggles with. ALWAYS provide a manual VIN entry fallback. Make it easy to reach (visible at the bottom of the scanner UI, not buried).

---

## What NOT to do

| Mistake | Why it fails |
|---|---|
| Using `html5-qrcode` | Its built-in UI (`Html5QrcodeScanner`) creates and manages its own DOM elements, which conflicts with React. The camera feed often renders as a black box after navigation, and cleanup on unmount is unreliable. The lower-level `Html5Qrcode` class can work, but you'd be rebuilding everything that `react-zxing` already provides. |
| Using the native `BarcodeDetector` API alone | Only works on Chrome (desktop + Android). Not supported in Safari/iOS or Firefox. Cannot be your only approach for a mobile-first app. |
| Server-rendering the scanner component | Crashes with `navigator is not defined`. Must use `dynamic()` with `ssr: false`. |
| Showing `onDecodeError` messages | Floods UI with errors on every frame. This is normal scanning behavior, not an error. |
| Not adding `playsInline` to `<video>` | Breaks on iOS completely — Safari opens fullscreen video player instead of inline camera feed. |
| Using `navigator.mediaDevices` without checking | Will throw on HTTP (non-localhost) and in SSR. Always check `typeof window !== 'undefined'` and use HTTPS. |

---

## Testing

1. **Desktop development**: The scanner works with a laptop webcam. Print a Code 39 VIN barcode from a free generator like https://www.onlinetoolcenter.com/vin-barcode-generator/ to test.
2. **Mobile testing**: Use `ngrok` or deploy to Vercel to get an HTTPS URL, then open on your phone.
3. **Test with real vehicles**: The true test. Windshield VIN barcodes are often behind tinted glass or at an angle. Test in different lighting conditions.

---

## Package versions (known working)

```json
{
  "react-zxing": "^2.0.2",
  "@zxing/library": "^0.21.3"
}
```

These versions are compatible with Next.js 14+ and React 18+.
