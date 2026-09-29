-- ============================================================
-- BREEDING GROUNDS V3
-- DATABASE FOUNDATION
-- ============================================================

-- IMPORTANT:
-- V3 uses 0-60 MPH ONLY.
-- There is NO 0-62 MPH field anywhere in this schema.

-- ============================================================
-- BREEDERS
-- ============================================================

create table if not exists breeders (
  id uuid primary key references auth.users(id) on delete cascade,

  username text unique not null,
  display_name text,

  avatar_url text,
  bio text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- VEHICLE DIRECTORY
-- Identity / searchable vehicle catalogue
-- ============================================================

create table if not exists vehicle_directory (
  id uuid primary key default gen_random_uuid(),

  name text not null,
  manufacturer text,
  model text,
  generation text,
  variant text,

  normalized_name text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ============================================================
-- LIVE VEHICLE SPECS
-- Verified vehicle data
-- ============================================================

create table if not exists vehicle_specs (
  id uuid primary key default gen_random_uuid(),

  vehicle_directory_id uuid references vehicle_directory(id),

  name text not null,
  manufacturer text,
  model text,
  generation text,
  variant text,

  normalized_name text,

  power_bhp numeric,
  torque_nm numeric,
  weight_kg numeric,

  acceleration_0_60_mph numeric,
  top_speed_mph numeric,
  combined_mpg_uk numeric,

  source_url text,
  source_type text,
  confidence text,
  notes text,

  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ============================================================
-- VEHICLE SPECS STAGING
-- Gemini researched but not yet verified
-- ============================================================

create table if not exists vehicle_specs_staging (
  id uuid primary key default gen_random_uuid(),

  name text not null,
  vehicle_name text,

  manufacturer text,
  model text,
  generation text,
  variant text,

  normalized_name text,

  power_bhp numeric,
  torque_nm numeric,
  weight_kg numeric,

  acceleration_0_60_mph numeric,
  top_speed_mph numeric,
  combined_mpg_uk numeric,

  source_url text,
  source_type text,
  confidence text,
  notes text,

  status text not null default 'UNVERIFIED',
  next_action text not null default 'VERIFY',

  researched_at timestamptz not null default now(),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ============================================================
-- RESEARCH QUEUE
-- ============================================================

create table if not exists research_queue (
  id uuid primary key default gen_random_uuid(),

  vehicle_name text not null,
  normalized_name text,

  status text not null default 'PENDING',

  research_result jsonb,

  error_message text,

  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);


-- ============================================================
-- BREEDINGS
-- Records the two donor vehicles
-- ============================================================

create table if not exists breedings (
  id uuid primary key default gen_random_uuid(),

  breeder_id uuid references breeders(id),

  donor_1_name text not null,
  donor_2_name text not null,

  donor_1_data jsonb,
  donor_2_data jsonb,

  status text not null default 'STARTED',

  created_at timestamptz not null default now(),
  completed_at timestamptz
);


-- ============================================================
-- OFFSPRING
-- The unique vehicle created by breeding
-- ============================================================

create table if not exists offspring (
  id uuid primary key default gen_random_uuid(),

  breeder_id uuid references breeders(id),
  breeding_id uuid references breedings(id),

  name text not null,

  manufacturer text,
  model text,
  generation text,
  variant text,

  dna_id text unique not null,
  generation_number integer not null default 1,

  power_bhp numeric,
  torque_nm numeric,
  weight_kg numeric,

  acceleration_0_60_mph numeric,
  top_speed_mph numeric,
  combined_mpg_uk numeric,

  breed_rating numeric,
  rating_class text,

  image_url text,

  created_at timestamptz not null default now()
);


-- ============================================================
-- GARAGE
-- Personal breeder collection
-- ============================================================

create table if not exists garage (
  id uuid primary key default gen_random_uuid(),

  breeder_id uuid not null references breeders(id),
  offspring_id uuid not null references offspring(id),

  created_at timestamptz not null default now(),

  unique(breeder_id, offspring_id)
);


-- ============================================================
-- GREEN SLIPS
-- ============================================================

create table if not exists green_slips (
  id uuid primary key default gen_random_uuid(),

  offspring_id uuid not null unique references offspring(id),
  breeder_id uuid references breeders(id),

  card_number text unique,
  card_status text not null default 'ACTIVE',

  created_at timestamptz not null default now()
);


-- ============================================================
-- PHOTO HUB
-- ============================================================

create table if not exists photos (
  id uuid primary key default gen_random_uuid(),

  breeder_id uuid references breeders(id),
  offspring_id uuid references offspring(id),

  image_url text not null,

  title text,
  caption text,

  visibility text not null default 'PUBLIC',

  created_at timestamptz not null default now()
);


-- ============================================================
-- COMMUNITY POSTS
-- ============================================================

create table if not exists community_posts (
  id uuid primary key default gen_random_uuid(),

  breeder_id uuid not null references breeders(id),
  offspring_id uuid references offspring(id),
  photo_id uuid references photos(id),

  title text,
  body text,

  visibility text not null default 'PUBLIC',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ============================================================
-- COMMUNITY LIKES
-- ============================================================

create table if not exists community_likes (
  id uuid primary key default gen_random_uuid(),

  post_id uuid not null references community_posts(id)
    on delete cascade,

  breeder_id uuid not null references breeders(id)
    on delete cascade,

  created_at timestamptz not null default now(),

  unique(post_id, breeder_id)
);


-- ============================================================
-- COMMUNITY COMMENTS
-- ============================================================

create table if not exists community_comments (
  id uuid primary key default gen_random_uuid(),

  post_id uuid not null references community_posts(id)
    on delete cascade,

  breeder_id uuid not null references breeders(id)
    on delete cascade,

  comment text not null,

  created_at timestamptz not null default now()
);


-- ============================================================
-- TROPHIES
-- ============================================================

create table if not exists trophies (
  id uuid primary key default gen_random_uuid(),

  breeder_id uuid not null references breeders(id)
    on delete cascade,

  trophy_type text not null,
  title text not null,
  description text,

  awarded_at timestamptz not null default now()
);


-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists idx_vehicle_specs_normalized_name
  on vehicle_specs(normalized_name);

create index if not exists idx_vehicle_staging_normalized_name
  on vehicle_specs_staging(normalized_name);

create index if not exists idx_vehicle_directory_normalized_name
  on vehicle_directory(normalized_name);

create index if not exists idx_research_queue_status
  on research_queue(status);

create index if not exists idx_offspring_breeder
  on offspring(breeder_id);

create index if not exists idx_garage_breeder
  on garage(breeder_id);

create index if not exists idx_posts_breeder
  on community_posts(breeder_id);


-- ============================================================
-- V3 DATABASE RULE
-- ============================================================

-- 0-60 MPH is the ONLY acceleration statistic.
-- DO NOT ADD 0-62 MPH.
