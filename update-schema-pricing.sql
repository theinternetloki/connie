-- Add parts price cache table
create table if not exists parts_price_cache (
  id uuid primary key default gen_random_uuid(),
  cache_key text unique not null, -- e.g., "front_bumper_cover:2019:honda:accord"
  part_name text not null,
  year int,
  make text,
  model text,
  source text not null, -- "ebay" | "static"
  price_low numeric,
  price_median numeric,
  price_high numeric,
  raw_data jsonb, -- full eBay response for debugging
  fetched_at timestamptz default now(),
  expires_at timestamptz default (now() + interval '7 days')
);

create index if not exists idx_parts_cache_key on parts_price_cache(cache_key);
create index if not exists idx_parts_cache_expires on parts_price_cache(expires_at);

-- Update estimate_items table to include new fields
alter table estimate_items add column if not exists parts_cost_low numeric default 0;
alter table estimate_items add column if not exists parts_cost_high numeric default 0;
alter table estimate_items add column if not exists labor_cost_low numeric default 0;
alter table estimate_items add column if not exists labor_cost_high numeric default 0;
alter table estimate_items add column if not exists pricing_source text default 'static';

-- Add labor rate tier to profiles
alter table profiles add column if not exists labor_rate_tier text default 'medium';
alter table profiles add column if not exists region text;
