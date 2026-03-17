-- Dashboard Generator - Supabase Schema
-- Run this in the Supabase SQL Editor to create all tables, RLS policies, and triggers.

-- ============================================================================
-- TABLES
-- ============================================================================

-- dashboards table
CREATE TABLE dashboards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('sell', 'buyer', 'buysell')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  client_names TEXT NOT NULL,
  full_name TEXT,
  email TEXT,
  agent_key TEXT NOT NULL DEFAULT 'josh_jacqui',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id)
);

-- sell_data table
CREATE TABLE sell_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dashboard_id UUID REFERENCES dashboards(id) ON DELETE CASCADE NOT NULL UNIQUE,
  address TEXT,
  city_state_zip TEXT,
  subdivision TEXT,
  community_name TEXT,
  beds INTEGER,
  baths NUMERIC,
  sqft INTEGER,
  lot_sqft INTEGER,
  year_built INTEGER,
  pool BOOLEAN DEFAULT false,
  stories INTEGER DEFAULT 1,
  estimated_sale_price NUMERIC,
  loan_payoff NUMERIC,
  comps JSONB DEFAULT '[]',
  market_metrics JSONB DEFAULT '{}',
  property_highlights JSONB DEFAULT '[]',
  pricing_strategy TEXT,
  competition JSONB DEFAULT '[]',
  market_snapshot JSONB DEFAULT '[]',
  prep_items JSONB DEFAULT '[]',
  marketing_plan JSONB DEFAULT '[]',
  timeline JSONB DEFAULT '[]',
  features JSONB DEFAULT '[]',
  upgrades JSONB DEFAULT '[]',
  cromford_metrics JSONB DEFAULT '[]',
  cromford_takeaway TEXT,
  listing_status TEXT DEFAULT 'pre-listing',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- buy_data table
CREATE TABLE buy_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dashboard_id UUID REFERENCES dashboards(id) ON DELETE CASCADE NOT NULL UNIQUE,
  target_areas TEXT,
  budget_min NUMERIC,
  budget_max NUMERIC,
  beds_min INTEGER,
  baths_min INTEGER,
  must_haves JSONB DEFAULT '[]',
  school_preference TEXT,
  neighborhoods JSONB DEFAULT '[]',
  school_districts JSONB DEFAULT '[]',
  timeline JSONB DEFAULT '[]',
  market_snapshot JSONB DEFAULT '[]',
  home_search_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- properties_of_interest table
CREATE TABLE properties_of_interest (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dashboard_id UUID REFERENCES dashboards(id) ON DELETE CASCADE NOT NULL,
  address TEXT NOT NULL,
  price NUMERIC,
  listing_url TEXT,
  photo_url TEXT,
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE sell_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE buy_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties_of_interest ENABLE ROW LEVEL SECURITY;

-- Team members (authenticated) can do everything
CREATE POLICY "Team CRUD" ON dashboards FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Team CRUD" ON sell_data FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Team CRUD" ON buy_data FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Team CRUD" ON properties_of_interest FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Public can read published dashboards and their associated data
CREATE POLICY "Public read published" ON dashboards FOR SELECT TO anon
  USING (status = 'published');

CREATE POLICY "Public read published sell_data" ON sell_data FOR SELECT TO anon
  USING (dashboard_id IN (SELECT id FROM dashboards WHERE status = 'published'));

CREATE POLICY "Public read published buy_data" ON buy_data FOR SELECT TO anon
  USING (dashboard_id IN (SELECT id FROM dashboards WHERE status = 'published'));

CREATE POLICY "Public read published properties" ON properties_of_interest FOR SELECT TO anon
  USING (dashboard_id IN (SELECT id FROM dashboards WHERE status = 'published'));

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at on row modification
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER dashboards_updated_at BEFORE UPDATE ON dashboards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER sell_data_updated_at BEFORE UPDATE ON sell_data
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER buy_data_updated_at BEFORE UPDATE ON buy_data
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
