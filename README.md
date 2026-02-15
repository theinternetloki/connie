# Vehicle Reconditioning Cost Estimator

AI-powered vehicle reconditioning cost estimation for auto dealers.

## Features

- 📸 Guided photo capture flow with step-by-step instructions
- 🤖 AI-powered damage analysis using Claude Vision API
- 💰 Detailed itemized cost estimates
- 📊 Dashboard with inspection history and statistics
- 📄 PDF export functionality
- 🔐 Authentication with Supabase

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API routes
- **AI**: Anthropic Claude API (claude-sonnet-4-20250514 with vision)
- **Database**: Supabase (Postgres + Auth + Storage)
- **Deployment**: Vercel

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up Supabase:
   - Create a new Supabase project
   - Run the SQL schema from `supabase-schema.sql`
   - Create a storage bucket named `inspection-photos` (public)

3. Configure environment variables:
   - Copy `.env.example` to `.env.local`
   - Fill in your Supabase and Anthropic API keys

4. Run the development server:
```bash
npm run dev
```

## Database Setup

1. In your Supabase dashboard, go to SQL Editor
2. Run the contents of `supabase-schema.sql`
3. Go to Storage and create a bucket named `inspection-photos` (make it public)

## Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (for server-side operations)
- `ANTHROPIC_API_KEY`: Your Anthropic API key

## Usage

1. Start a new inspection from the landing page
2. Enter vehicle information (VIN scan or manual entry)
3. Follow the guided photo capture flow
4. Wait for AI analysis (10-30 seconds)
5. Review and customize the estimate report
6. Export PDF or share the report

## Notes

- Estimates are AI-generated approximations
- Actual costs may vary based on local labor rates and parts availability
- Mobile-first design optimized for phone use on the lot
