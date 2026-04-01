-- Supabase Migrations for G-Buddy
-- Run these SQL commands in your Supabase SQL Editor

-- 1. Conversations table (for voice/chat history)
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  source TEXT DEFAULT 'voice' CHECK (source IN ('voice', 'text')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create index for faster queries by plant
CREATE INDEX IF NOT EXISTS conversations_plant_id_idx ON public.conversations(plant_id);
CREATE INDEX IF NOT EXISTS conversations_created_at_idx ON public.conversations(created_at DESC);

-- 2. Plants table (main plant profiles)
CREATE TABLE IF NOT EXISTS public.plants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  strain_name TEXT NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('Seedling', 'Veg', 'Bloom', 'Dry', 'Cure')),
  bloom_started_at TIMESTAMP WITH TIME ZONE,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS plants_user_id_idx ON public.plants(user_id);
CREATE INDEX IF NOT EXISTS plants_updated_at_idx ON public.plants(updated_at DESC);

-- 3. Watering log table
CREATE TABLE IF NOT EXISTS public.watering_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id UUID NOT NULL REFERENCES public.plants(id) ON DELETE CASCADE,
  amount_ml NUMERIC NOT NULL,
  ph NUMERIC,
  ec NUMERIC,
  runoff_ph NUMERIC,
  runoff_ec NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE (plant_id, created_at)
);

CREATE INDEX IF NOT EXISTS watering_log_plant_id_idx ON public.watering_log(plant_id);
CREATE INDEX IF NOT EXISTS watering_log_created_at_idx ON public.watering_log(created_at DESC);

-- 4. Climate log table
CREATE TABLE IF NOT EXISTS public.climate_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id UUID NOT NULL REFERENCES public.plants(id) ON DELETE CASCADE,
  temp_c NUMERIC,
  humidity NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE (plant_id, created_at)
);

CREATE INDEX IF NOT EXISTS climate_log_plant_id_idx ON public.climate_log(plant_id);
CREATE INDEX IF NOT EXISTS climate_log_created_at_idx ON public.climate_log(created_at DESC);

-- 5. Enable RLS (Row Level Security) - adjust based on your auth setup
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watering_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.climate_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Allow all operations for now (tighten in production)
-- Drop all existing policies first
DROP POLICY IF EXISTS "conversations_insert" ON public.conversations;
DROP POLICY IF EXISTS "conversations_select" ON public.conversations;
DROP POLICY IF EXISTS "conversations_update" ON public.conversations;
DROP POLICY IF EXISTS "conversations_delete" ON public.conversations;
DROP POLICY IF EXISTS "conversations_allow_all" ON public.conversations;

DROP POLICY IF EXISTS "plants_insert" ON public.plants;
DROP POLICY IF EXISTS "plants_select" ON public.plants;
DROP POLICY IF EXISTS "plants_update" ON public.plants;
DROP POLICY IF EXISTS "plants_delete" ON public.plants;
DROP POLICY IF EXISTS "plants_allow_all" ON public.plants;

DROP POLICY IF EXISTS "watering_log_insert" ON public.watering_log;
DROP POLICY IF EXISTS "watering_log_select" ON public.watering_log;
DROP POLICY IF EXISTS "watering_log_update" ON public.watering_log;
DROP POLICY IF EXISTS "watering_log_delete" ON public.watering_log;
DROP POLICY IF EXISTS "watering_log_allow_all" ON public.watering_log;

DROP POLICY IF EXISTS "climate_log_insert" ON public.climate_log;
DROP POLICY IF EXISTS "climate_log_select" ON public.climate_log;
DROP POLICY IF EXISTS "climate_log_update" ON public.climate_log;
DROP POLICY IF EXISTS "climate_log_delete" ON public.climate_log;
DROP POLICY IF EXISTS "climate_log_allow_all" ON public.climate_log;

-- Create comprehensive allow-all policies
-- Conversations policies
CREATE POLICY "conversations_select" ON public.conversations FOR SELECT USING (true);
CREATE POLICY "conversations_insert" ON public.conversations FOR INSERT WITH CHECK (true);
CREATE POLICY "conversations_update" ON public.conversations FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "conversations_delete" ON public.conversations FOR DELETE USING (true);

-- Plants policies
CREATE POLICY "plants_select" ON public.plants FOR SELECT USING (true);
CREATE POLICY "plants_insert" ON public.plants FOR INSERT WITH CHECK (true);
CREATE POLICY "plants_update" ON public.plants FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "plants_delete" ON public.plants FOR DELETE USING (true);

-- Watering log policies
CREATE POLICY "watering_log_select" ON public.watering_log FOR SELECT USING (true);
CREATE POLICY "watering_log_insert" ON public.watering_log FOR INSERT WITH CHECK (true);
CREATE POLICY "watering_log_update" ON public.watering_log FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "watering_log_delete" ON public.watering_log FOR DELETE USING (true);

-- Climate log policies
CREATE POLICY "climate_log_select" ON public.climate_log FOR SELECT USING (true);
CREATE POLICY "climate_log_insert" ON public.climate_log FOR INSERT WITH CHECK (true);
CREATE POLICY "climate_log_update" ON public.climate_log FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "climate_log_delete" ON public.climate_log FOR DELETE USING (true);
