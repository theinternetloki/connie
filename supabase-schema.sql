-- Users/profiles (extends Supabase auth.users)
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

-- Create storage bucket for photos
insert into storage.buckets (id, name, public) values ('inspection-photos', 'inspection-photos', true);

-- Row Level Security policies
alter table profiles enable row level security;
alter table inspections enable row level security;
alter table inspection_photos enable row level security;
alter table estimate_items enable row level security;

-- Profiles policies
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- Inspections policies
create policy "Users can view own inspections" on inspections for select using (auth.uid() = user_id);
create policy "Users can create own inspections" on inspections for insert with check (auth.uid() = user_id);
create policy "Users can update own inspections" on inspections for update using (auth.uid() = user_id);
create policy "Users can delete own inspections" on inspections for delete using (auth.uid() = user_id);

-- Photos policies
create policy "Users can view own photos" on inspection_photos for select using (
  exists (select 1 from inspections where inspections.id = inspection_photos.inspection_id and inspections.user_id = auth.uid())
);
create policy "Users can create own photos" on inspection_photos for insert with check (
  exists (select 1 from inspections where inspections.id = inspection_photos.inspection_id and inspections.user_id = auth.uid())
);

-- Estimate items policies
create policy "Users can view own items" on estimate_items for select using (
  exists (select 1 from inspections where inspections.id = estimate_items.inspection_id and inspections.user_id = auth.uid())
);
create policy "Users can update own items" on estimate_items for update using (
  exists (select 1 from inspections where inspections.id = estimate_items.inspection_id and inspections.user_id = auth.uid())
);
