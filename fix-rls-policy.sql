-- Fix for RLS policy error on signup
-- Run this in your Supabase SQL Editor to fix the "new row violates row-level security policy" error

-- Add INSERT policy for profiles table
create policy "Users can create own profile" on profiles for insert with check (auth.uid() = id);
