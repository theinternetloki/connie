Cursor Prompt: Vehicle Reconditioning Cost Estimator MVP
Project Overview
Build a mobile-first web application that allows auto dealers to photograph vehicles and receive AI-powered reconditioning cost estimates. The MVP uses a multimodal LLM (Claude) to analyze vehicle photos and generate itemized repair estimates.
Tech Stack

Frontend: Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui
Backend: Next.js API routes
AI: Anthropic Claude API (claude-sonnet-4-20250514 with vision)
Database: Supabase (Postgres + Auth + Storage for images)
Deployment: Vercel

Core Features to Build
1. Guided Photo Capture Flow
Create a multi-step camera capture flow at /capture that walks the user through photographing a vehicle. Use the device camera via getUserMedia or <input type="file" capture="environment"> for maximum mobile compatibility.
Required photo stations (in order):

Front exterior
Passenger side exterior
Rear exterior
Driver side exterior
Driver side interior (dashboard, steering wheel, seat)
Passenger side interior
Roof / top view (optional)
Any specific damage spots (user can add multiple)

UX requirements:

Show a visual guide overlay or reference image for each station so the user knows what angle to capture
Allow retake of any photo before moving on
Show a thumbnail strip of completed photos at the bottom
"Add damage close-up" button lets user add extra photos at any step
Progress indicator (e.g., "Step 3 of 6")
Works offline: store photos in memory/IndexedDB, submit when ready

2. Vehicle Identification
Before the photo flow, collect vehicle info on a /vehicle-info form:

VIN scanner: Use a JS barcode/VIN scanner library (e.g., html5-qrcode or zxing-js) to scan the windshield VIN barcode via camera. Fallback to manual VIN entry.
VIN decode: Call the free NHTSA VIN Decoder API (https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/{vin}?format=json) to auto-populate year, make, model, trim, body style.
Manual fallback: Dropdowns for year, make, model if VIN scan fails.
Mileage: Manual text input.

3. AI Damage Analysis
Create an API route at /api/analyze that:

Accepts the uploaded images (as base64) and vehicle info.
Sends them to Claude with the following system prompt and structured output instructions.

System prompt for Claude:
You are an expert automotive appraiser and reconditioning cost estimator for auto dealers. You are analyzing photos of a used vehicle to identify all visible damage, wear, and cosmetic issues, then estimating reconditioning costs.

Vehicle: {{year}} {{make}} {{model}} {{trim}}
Mileage: {{mileage}}

Analyze all provided photos carefully. For each issue found, provide:
- Location (e.g., "front bumper", "driver seat", "rear passenger door")
- Damage type (e.g., "scratch", "dent", "paint chip", "stain", "tear", "curb rash", "crack", "fading", "rust")
- Severity: minor | moderate | severe
- Recommended repair (e.g., "touch-up paint", "PDR", "sand and respray panel", "replace bumper cover", "interior shampoo", "leather repair", "windshield replacement")
- Estimated cost range (low and high, in USD)

Also assess overall vehicle condition:
- Exterior condition: excellent | good | fair | poor
- Interior condition: excellent | good | fair | poor
- Estimated total reconditioning cost (low and high)

Be specific and realistic with costs based on typical US dealer reconditioning rates. Account for the vehicle's make/model — luxury brands cost more.

Respond ONLY in the following JSON format, no markdown, no preamble:
{
  "vehicle": {
    "year": number,
    "make": "string",
    "model": "string",
    "trim": "string",
    "mileage": number
  },
  "exterior_condition": "excellent" | "good" | "fair" | "poor",
  "interior_condition": "excellent" | "good" | "fair" | "poor",
  "items": [
    {
      "id": "string (uuid)",
      "location": "string",
      "damage_type": "string",
      "severity": "minor" | "moderate" | "severe",
      "description": "string (1-2 sentence description of what you see)",
      "recommended_repair": "string",
      "cost_low": number,
      "cost_high": number,
      "photo_index": number (which photo this was found in, 0-indexed)
    }
  ],
  "summary": {
    "total_items": number,
    "total_cost_low": number,
    "total_cost_high": number,
    "top_priority_repairs": ["string", "string", "string"],
    "notes": "string (any overall observations or recommendations)"
  }
}
API route implementation notes:

Send all photos in a single Claude API call as multiple image content blocks.
Label each image (e.g., "Photo 1: Front exterior", "Photo 2: Passenger side") in the user message.
Parse the JSON response with error handling (strip markdown fences if present).
Store the analysis result in Supabase along with the images.

4. Estimate Report View
Create a report page at /report/[id] that displays:
Header section:

Vehicle info (year/make/model/trim/mileage)
Date of inspection
Overall condition badges (exterior + interior)
Total estimated cost range displayed prominently (e.g., "$1,200 – $1,800")

Damage items table/cards:

Each line item showing: location, damage type, severity (color-coded badge: green/yellow/red), recommended repair, cost range
Clicking an item shows the relevant photo with the damage description overlaid
Allow dealer to toggle items on/off to customize the estimate (checkbox per item, recalculates total)
Allow dealer to manually adjust cost on any line item (inline edit)

Photo gallery:

Thumbnail grid of all captured photos
Click to enlarge

Actions:

"Export PDF" button — generate a clean PDF estimate using @react-pdf/renderer or html2canvas + jsPDF
"Share" button — generate a shareable link
"New Inspection" button

5. Dashboard
Create a dashboard at /dashboard that shows:

List of all past inspections (vehicle, date, total estimate, condition)
Search and filter by date range, make, cost range
Summary stats: total vehicles inspected, average recon cost, cost distribution chart

6. Authentication
Use Supabase Auth:

Email/password sign-up and login
Protect all routes except landing page
Store user's dealership name in profile

Database Schema (Supabase)
sql-- Users/profiles (extends Supabase auth.users)
create table profiles (
  id uuid references auth.users primary key,
  dealership_name text,
  created_at timestamptz default now()
);

-- Inspections
create table inspections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  vin text,
  year int,
  make text,
  model text,
  trim text,
  mileage int,
  exterior_condition text,
  interior_condition text,
  total_cost_low numeric,
  total_cost_high numeric,
  ai_analysis jsonb, -- full Claude response
  notes text,
  created_at timestamptz default now()
);

-- Photos
create table inspection_photos (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid references inspections(id) on delete cascade,
  station text, -- e.g., "front_exterior", "damage_closeup_1"
  storage_path text, -- path in Supabase Storage
  sort_order int,
  created_at timestamptz default now()
);

-- Line items (editable copy of AI results)
create table estimate_items (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid references inspections(id) on delete cascade,
  location text,
  damage_type text,
  severity text,
  description text,
  recommended_repair text,
  cost_low numeric,
  cost_high numeric,
  is_included boolean default true, -- dealer can toggle off
  photo_index int,
  created_at timestamptz default now()
);
File Structure
src/
├── app/
│   ├── page.tsx                    # Landing page
│   ├── login/page.tsx              # Auth
│   ├── signup/page.tsx
│   ├── dashboard/page.tsx          # Inspection history
│   ├── vehicle-info/page.tsx       # VIN scan + vehicle details
│   ├── capture/page.tsx            # Guided photo capture flow
│   ├── analyzing/page.tsx          # Loading/progress screen during AI analysis
│   ├── report/[id]/page.tsx        # Estimate report
│   └── api/
│       ├── analyze/route.ts        # Claude vision API call
│       ├── vin-decode/route.ts     # NHTSA VIN decode proxy
│       └── export-pdf/route.ts     # PDF generation
├── components/
│   ├── camera/
│   │   ├── CameraCapture.tsx       # Camera component
│   │   ├── PhotoStation.tsx        # Single station capture UI
│   │   ├── PhotoStrip.tsx          # Thumbnail strip
│   │   └── StationGuide.tsx        # Visual guide overlay
│   ├── estimate/
│   │   ├── EstimateHeader.tsx
│   │   ├── DamageItemCard.tsx
│   │   ├── DamageItemTable.tsx
│   │   ├── CostSummary.tsx
│   │   └── PhotoGallery.tsx
│   ├── vehicle/
│   │   ├── VinScanner.tsx
│   │   └── VehicleForm.tsx
│   ├── dashboard/
│   │   ├── InspectionList.tsx
│   │   └── StatsCards.tsx
│   └── ui/                         # shadcn components
├── lib/
│   ├── supabase.ts                 # Supabase client
│   ├── anthropic.ts                # Claude API helper
│   ├── vin.ts                      # VIN decode helper
│   └── types.ts                    # TypeScript types
└── hooks/
    ├── useCamera.ts
    ├── useInspection.ts
    └── useVinDecode.ts
Environment Variables
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
Key Implementation Notes

Mobile-first: Design everything for phone screens. Large touch targets, minimal typing, camera-centric UX.
Image optimization: Resize images client-side before upload (max 1600px wide) to reduce Claude API costs and latency. Use canvas to resize.
Loading states: The Claude API call with multiple images will take 10-30 seconds. Build a polished analyzing screen with progress animation and fun facts about reconditioning.
Error handling: Gracefully handle camera permission denials, API failures, and malformed AI responses. Always have a retry option.
Cost accuracy disclaimer: Show a footer note: "Estimates are AI-generated approximations. Actual costs may vary based on local labor rates and parts availability."
Responsive but mobile-first: Should work on desktop too (dealers may use tablets or laptops), but optimize for phone-in-hand on the lot.

Build Order

Set up Next.js project with Tailwind + shadcn/ui
Set up Supabase project (database, auth, storage)
Build the vehicle info form with VIN decode
Build the guided camera capture flow
Build the /api/analyze route with Claude integration
Build the estimate report page
Build the dashboard
Add PDF export
Add authentication
Polish, test on real phones, deploy to Vercel