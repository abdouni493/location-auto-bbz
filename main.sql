-- ============================================================================
-- MHD AUTO / AUTO_LOCATION — MASTER DATABASE SCHEMA (main.sql)
-- ============================================================================
-- Run this ENTIRE file ONCE in the Supabase SQL Editor of a FRESH project:
--   Supabase Dashboard → SQL Editor → New query → paste everything → Run.
--
-- It is idempotent (safe to re-run) and self-contained. It creates:
--   • every table used by the admin app and the public website,
--   • all foreign keys the app relies on (PostgREST embeds depend on them),
--   • Row Level Security (RLS) policies for every interface / button action,
--   • the `admin_count` view used by the login page,
--   • SQL functions that CREATE accounts in Supabase Auth (auth.users):
--       - create_admin_account()   → admin sign-up on the login page
--       - create_worker_account()  → worker sign-up from the "Équipe" page
--     so both admins and workers log in normally with email + password,
--   • the public-website RPCs (reservation, promo codes, availability),
--   • the storage buckets for every image-upload location, with policies.
--
-- The database only ever stores the PUBLIC URL of an image (text); the binary
-- file lives in a storage bucket. See section 8 (Storage) + the app's
-- upload*Image services which return getPublicUrl().
-- ============================================================================


-- ============================================================================
-- 0) EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"  WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto"   WITH SCHEMA extensions;
-- gen_random_uuid() is provided by pgcrypto/core; crypt()/gen_salt() by pgcrypto.


-- ============================================================================
-- 1) CORE / IDENTITY TABLES
-- ============================================================================

-- 1.1 profiles — one row per Supabase Auth user (role tracking for the app).
CREATE TABLE IF NOT EXISTS public.profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username   text,
  role       text NOT NULL DEFAULT 'admin',
  agency_id  uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 1.2 agencies — rental agencies / branches.
CREATE TABLE IF NOT EXISTS public.agencies (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  address    text,
  city       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 1.3 agency_settings — branding + document templates (single row).
CREATE TABLE IF NOT EXISTS public.agency_settings (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_name        text,
  slogan             text,
  address            text,
  phone              text,
  logo               text,
  document_templates jsonb DEFAULT '{}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);


-- ============================================================================
-- 2) FLEET
-- ============================================================================

-- 2.1 cars — the fleet. image_url holds ONE public URL (bucket "cars").
CREATE TABLE IF NOT EXISTS public.cars (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand               text,
  model               text,
  plate_number        text,
  year                integer,
  color               text,
  vin                 text,
  energy              text,
  transmission        text,
  seats               integer,
  doors               integer,
  price_per_day       numeric DEFAULT 0,
  price_week          numeric,
  price_month         numeric,
  deposit             numeric,
  image_url           text,
  mileage             integer DEFAULT 0,
  fuel_level          text,
  status              text DEFAULT 'disponible',
  is_hidden_from_site boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now()
);


-- ============================================================================
-- 3) CLIENTS
-- ============================================================================

-- 3.1 clients — renters. profile_photo + scanned_documents hold public URLs
--     (bucket "clients"); scanned_documents is an ARRAY of URLs.
CREATE TABLE IF NOT EXISTS public.clients (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name                text,
  last_name                 text,
  phone                     text,
  email                     text,
  date_of_birth             date,
  place_of_birth            text,
  id_card_number            text,
  license_number            text,
  license_expiration_date   date,
  license_delivery_date     date,
  license_delivery_place    text,
  document_type             text DEFAULT 'none',
  document_number           text,
  document_delivery_date    date,
  document_expiration_date  date,
  document_delivery_address text,
  wilaya                    text,
  complete_address          text,
  profile_photo             text,
  scanned_documents         text[] DEFAULT '{}'::text[],
  agency_id                 uuid REFERENCES public.agencies(id) ON DELETE SET NULL,
  created_at                timestamptz NOT NULL DEFAULT now()
);


-- ============================================================================
-- 4) TEAM (workers) — linked to Supabase Auth via user_id
-- ============================================================================

-- 4.1 workers — staff accounts. user_id links to the auth.users row created
--     by create_worker_account(); password is kept for the legacy fallback.
CREATE TABLE IF NOT EXISTS public.workers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name     text,
  date_of_birth date,
  phone         text,
  email         text,
  address       text,
  profile_photo text,
  type          text DEFAULT 'worker',
  payment_type  text,
  base_salary   numeric DEFAULT 0,
  username      text,
  password      text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.worker_advances (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id  uuid REFERENCES public.workers(id) ON DELETE CASCADE,
  amount     numeric DEFAULT 0,
  date       date,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.worker_absences (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id  uuid REFERENCES public.workers(id) ON DELETE CASCADE,
  cost       numeric DEFAULT 0,
  date       date,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.worker_payments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id   uuid REFERENCES public.workers(id) ON DELETE CASCADE,
  amount      numeric DEFAULT 0,
  date        date,
  base_salary numeric,
  advances    numeric,
  absences    numeric,
  net_salary  numeric,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);


-- ============================================================================
-- 5) EXPENSES & MAINTENANCE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.store_expenses (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text,
  cost       numeric DEFAULT 0,
  date       date,
  note       text,
  icon       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vehicle_expenses (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id              uuid REFERENCES public.cars(id) ON DELETE CASCADE,
  type                text,
  cost                numeric DEFAULT 0,
  date                date,
  note                text,
  current_mileage     integer,
  next_vidange_km     integer,
  expiration_date     date,
  expense_name        text,
  oil_filter_changed  boolean DEFAULT false,
  air_filter_changed  boolean DEFAULT false,
  fuel_filter_changed boolean DEFAULT false,
  ac_filter_changed   boolean DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.maintenance_alerts (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id               uuid REFERENCES public.cars(id) ON DELETE CASCADE,
  car_info             text,
  type                 text,
  title                text,
  message              text,
  severity             text,
  due_date             date,
  is_expired           boolean DEFAULT false,
  days_until_due       integer,
  current_mileage      integer,
  next_service_mileage integer,
  created_at           timestamptz NOT NULL DEFAULT now()
);


-- ============================================================================
-- 6) SERVICES, OFFERS, PROTECTION ASSURANCES, PROMO CODES
-- ============================================================================

-- 6.1 services — additional services offered during a reservation.
CREATE TABLE IF NOT EXISTS public.services (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category     text,
  service_name text,
  description  text,
  price        numeric DEFAULT 0,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- 6.2 special_offers — promotions tied to an existing car.
CREATE TABLE IF NOT EXISTS public.special_offers (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id         uuid REFERENCES public.cars(id) ON DELETE CASCADE,
  old_price      numeric,
  new_price      numeric,
  note           text,
  is_active      boolean NOT NULL DEFAULT true,
  label          text,
  discount_type  text CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value numeric,
  start_date     date,
  end_date       date,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- 6.3 offers — DEPRECATED (kept for compatibility; no longer read/written).
CREATE TABLE IF NOT EXISTS public.offers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id     uuid REFERENCES public.cars(id) ON DELETE CASCADE,
  price      numeric,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6.4 protection assurances (forfaits) + reusable items + links.
CREATE TABLE IF NOT EXISTS public.protection_assurances (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  price_per_day numeric NOT NULL DEFAULT 0,
  is_active     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.protection_assurance_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name     text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.protection_assurance_item_links (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assurance_id uuid NOT NULL REFERENCES public.protection_assurances(id) ON DELETE CASCADE,
  item_id      uuid NOT NULL REFERENCES public.protection_assurance_items(id) ON DELETE CASCADE,
  status       boolean NOT NULL DEFAULT true,
  created_at   timestamptz DEFAULT now(),
  CONSTRAINT protection_assurance_item_links_unique UNIQUE (assurance_id, item_id)
);

-- 6.5 promo_codes — managed by admin, consumed by the public website.
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                text NOT NULL,
  discount_percentage numeric NOT NULL CHECK (discount_percentage > 0 AND discount_percentage <= 100),
  is_active           boolean NOT NULL DEFAULT true,
  is_used             boolean NOT NULL DEFAULT false,
  used_at             timestamptz,
  reservation_id      uuid,
  created_at          timestamptz DEFAULT now(),
  CONSTRAINT promo_codes_code_unique UNIQUE (code)
);


-- ============================================================================
-- 7) RESERVATIONS + children (services, payments, inspections)
-- ============================================================================
-- IMPORTANT: the app embeds related rows through PostgREST using EXACT FK
-- names — do not rename these constraints:
--   reservations_departure_agency_fkey, reservations_return_agency_fkey,
--   reservations_protection_assurance_fkey.

CREATE TABLE IF NOT EXISTS public.reservations (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id                  uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  car_id                     uuid REFERENCES public.cars(id) ON DELETE SET NULL,

  departure_date             date,
  departure_time             time,
  departure_agency_id        uuid,
  return_date                date,
  return_time                time,
  return_agency_id           uuid,

  price_per_day              numeric DEFAULT 0,
  price_week                 numeric,
  price_month                numeric,
  total_days                 integer DEFAULT 1,
  total_price                numeric DEFAULT 0,
  deposit                    numeric DEFAULT 0,
  discount_amount            numeric DEFAULT 0,
  discount_type              text DEFAULT 'fixed',
  advance_payment            numeric DEFAULT 0,
  remaining_payment          numeric DEFAULT 0,
  additional_fees            numeric DEFAULT 0,
  tva_applied                boolean DEFAULT false,
  tva_amount                 numeric,

  status                     text NOT NULL DEFAULT 'pending',
  source                     text NOT NULL DEFAULT 'agency',
  notes                      text,
  conditions_text            text,

  caution_amount_dzd         numeric,
  caution_currency           text DEFAULT 'DZD',
  euro_rate                  numeric DEFAULT 145,
  assurance_enabled          boolean DEFAULT false,
  assurance_percentage       numeric,

  protection_assurance_id    uuid,
  protection_assurance_name  text,
  protection_assurance_price numeric DEFAULT 0,

  excess_mileage             numeric,
  missing_fuel               numeric,
  created_by                 text,
  created_by_name            text,

  activated_at               timestamptz,
  completed_at               timestamptz,
  created_at                 timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT reservations_departure_agency_fkey
    FOREIGN KEY (departure_agency_id) REFERENCES public.agencies(id) ON DELETE SET NULL,
  CONSTRAINT reservations_return_agency_fkey
    FOREIGN KEY (return_agency_id) REFERENCES public.agencies(id) ON DELETE SET NULL,
  CONSTRAINT reservations_protection_assurance_fkey
    FOREIGN KEY (protection_assurance_id) REFERENCES public.protection_assurances(id) ON DELETE SET NULL,
  CONSTRAINT reservations_status_check CHECK (status = ANY (ARRAY[
    'website_reservation','pending','accepted','confirmed','active',
    'processing','completed','terminated','cancelled'
  ]))
);

-- promo_codes.reservation_id → reservations.id (added after reservations exists).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'promo_codes_reservation_fkey'
  ) THEN
    ALTER TABLE public.promo_codes
      ADD CONSTRAINT promo_codes_reservation_fkey
      FOREIGN KEY (reservation_id) REFERENCES public.reservations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 7.1 reservation_services — services attached to a reservation.
CREATE TABLE IF NOT EXISTS public.reservation_services (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid REFERENCES public.reservations(id) ON DELETE CASCADE,
  category       text,
  service_name   text,
  description    text,
  price          numeric DEFAULT 0,
  driver_id      uuid,
  driver_caution numeric DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- 7.2 payments — payments recorded against a reservation.
CREATE TABLE IF NOT EXISTS public.payments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid REFERENCES public.reservations(id) ON DELETE CASCADE,
  amount         numeric DEFAULT 0,
  payment_method text,
  date           date,
  note           text,
  status         text DEFAULT 'completed',
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- 7.3 inspection_checklist_items — master checklist.
CREATE TABLE IF NOT EXISTS public.inspection_checklist_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category      text,
  item_name     text,
  display_order integer DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- 7.4 vehicle_inspections — departure/return inspection (photos = URLs).
CREATE TABLE IF NOT EXISTS public.vehicle_inspections (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id        uuid REFERENCES public.reservations(id) ON DELETE CASCADE,
  type                  text,
  mileage               integer,
  fuel_level            text,
  agency_id             uuid,
  date                  date,
  time                  time,
  notes                 text,
  exterior_front_photo  text,
  exterior_rear_photo   text,
  interior_photo        text,
  other_photos          text[] DEFAULT '{}'::text[],
  client_signature      text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_reservation_type_inspection UNIQUE (reservation_id, type)
);

-- 7.5 inspection_responses — checklist answers per inspection.
CREATE TABLE IF NOT EXISTS public.inspection_responses (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id     uuid REFERENCES public.vehicle_inspections(id) ON DELETE CASCADE,
  checklist_item_id uuid REFERENCES public.inspection_checklist_items(id) ON DELETE CASCADE,
  status            boolean DEFAULT false,
  note              text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_inspection_checklist_item UNIQUE (inspection_id, checklist_item_id)
);


-- ============================================================================
-- 8) WEBSITE CONTENT + DOCUMENT TEMPLATES + SESSION AUDIT
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.website_settings (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text,
  description        text,
  logo               text,
  phone_number_2     text,
  bank_number        text,
  address            text,
  phone              text,
  landing_background text,
  updated_at         timestamptz DEFAULT now(),
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.website_contacts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facebook   text,
  instagram  text,
  tiktok     text,
  whatsapp   text,
  phone      text,
  address    text,
  email      text,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.document_templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id     uuid,
  template_type text,
  template      jsonb DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Session audit trail (optional, non-blocking — see utils/sessionService.ts).
CREATE TABLE IF NOT EXISTS public.admin_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid,
  access_token  text,
  refresh_token text,
  expires_at    bigint,
  user_agent    text,
  ip_address    text,
  is_valid      boolean DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);


-- ============================================================================
-- 9) VIEW USED BY THE LOGIN PAGE  (admin_count)
-- ============================================================================
-- Login.tsx reads: supabase.from('admin_count').select('count').single()
-- to decide whether the "create admin account" option is shown. When one
-- admin exists the option auto-hides. A plain (definer) view lets the anon
-- login page count admins without exposing the profiles table.
CREATE OR REPLACE VIEW public.admin_count AS
  SELECT count(*)::int AS count
  FROM public.profiles
  WHERE role = 'admin';

GRANT SELECT ON public.admin_count TO anon, authenticated;


-- ============================================================================
-- 10) ROW LEVEL SECURITY
-- ============================================================================
-- Model:
--   • authenticated (admin + workers logged in) → full CRUD on everything;
--   • anon (public website) → SELECT only on the tables the site displays,
--     everything else goes through SECURITY DEFINER RPCs (section 12).

-- Helper: enable RLS + grant full CRUD to authenticated on a list of tables.
DO $$
DECLARE t text;
DECLARE auth_tables text[] := ARRAY[
  'profiles','agencies','agency_settings','cars','clients',
  'workers','worker_advances','worker_absences','worker_payments',
  'store_expenses','vehicle_expenses','maintenance_alerts',
  'services','special_offers','offers',
  'protection_assurances','protection_assurance_items','protection_assurance_item_links',
  'promo_codes','reservations','reservation_services','payments',
  'inspection_checklist_items','vehicle_inspections','inspection_responses',
  'website_settings','website_contacts','document_templates','admin_sessions'
];
BEGIN
  FOREACH t IN ARRAY auth_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_auth_all" ON public.%I;', t, t);
    EXECUTE format(
      'CREATE POLICY "%s_auth_all" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true);',
      t, t
    );
  END LOOP;
END $$;

-- Public (anon) SELECT on the tables the website reads directly.
DO $$
DECLARE t text;
DECLARE public_read_tables text[] := ARRAY[
  'cars','agencies','special_offers','offers','services',
  'website_settings','website_contacts',
  'protection_assurances','protection_assurance_items','protection_assurance_item_links'
];
BEGIN
  FOREACH t IN ARRAY public_read_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_anon_read" ON public.%I;', t, t);
    EXECUTE format(
      'CREATE POLICY "%s_anon_read" ON public.%I FOR SELECT TO anon USING (true);',
      t, t
    );
  END LOOP;
END $$;


-- ============================================================================
-- 11) AUTH ACCOUNT CREATION FUNCTIONS  (write into auth.users)
-- ============================================================================

-- 11.0 Internal helper: create a confirmed email user in Supabase Auth.
--      SECURITY DEFINER so it can write to the auth schema. Returns the id.
CREATE OR REPLACE FUNCTION public._create_auth_user(
  p_email text,
  p_password text,
  p_meta jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public, extensions
AS $$
DECLARE
  v_user_id uuid := gen_random_uuid();
  v_email   text := lower(trim(p_email));
BEGIN
  IF v_email IS NULL OR length(v_email) = 0 THEN
    RAISE EXCEPTION 'EMAIL_REQUIRED';
  END IF;
  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'PASSWORD_TOO_SHORT';
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_email) THEN
    RAISE EXCEPTION 'EMAIL_ALREADY_EXISTS';
  END IF;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    is_super_admin
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
    v_email, extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(), now(), now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    coalesce(p_meta, '{}'::jsonb),
    '', '', '', '',
    false
  );

  INSERT INTO auth.identities (
    id, provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_user_id::text, v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
    'email', now(), now(), now()
  );

  RETURN v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public._create_auth_user(text, text, jsonb) FROM public, anon, authenticated;


-- 11.1 create_admin_account — the "create admin account" option on the login
--      page. Allowed only while NO admin exists yet (first admin). Creates a
--      confirmed auth user + a profiles row (role='admin'), so the admin can
--      immediately sign in with email + password. Callable by anon.
CREATE OR REPLACE FUNCTION public.create_admin_account(
  p_email text,
  p_password text,
  p_username text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_admins int;
  v_uid    uuid;
BEGIN
  SELECT count(*) INTO v_admins FROM public.profiles WHERE role = 'admin';
  IF v_admins > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'ADMIN_EXISTS');
  END IF;

  v_uid := public._create_auth_user(
    p_email, p_password,
    jsonb_build_object('role', 'admin', 'username', coalesce(p_username, ''))
  );

  INSERT INTO public.profiles (id, username, role)
  VALUES (v_uid, coalesce(NULLIF(p_username, ''), p_email), 'admin')
  ON CONFLICT (id) DO UPDATE SET role = 'admin', username = EXCLUDED.username;

  RETURN jsonb_build_object('success', true, 'user_id', v_uid);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_admin_account(text, text, text) TO anon, authenticated;


-- 11.2 create_worker_account — the "add worker" action of the Équipe page.
--      Creates a confirmed auth user + a workers row (linked via user_id) so
--      the worker logs in normally with email + password. Callable by an
--      authenticated admin only.
CREATE OR REPLACE FUNCTION public.create_worker_account(
  p_email text,
  p_password text,
  p_full_name text,
  p_date_of_birth date DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_profile_photo text DEFAULT NULL,
  p_type text DEFAULT 'worker',
  p_payment_type text DEFAULT NULL,
  p_base_salary numeric DEFAULT 0,
  p_username text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_uid    uuid;
  v_worker public.workers%ROWTYPE;
BEGIN
  v_uid := public._create_auth_user(
    p_email, p_password,
    jsonb_build_object(
      'role', coalesce(NULLIF(p_type, ''), 'worker'),
      'full_name', coalesce(p_full_name, ''),
      'username', coalesce(p_username, '')
    )
  );

  INSERT INTO public.workers (
    user_id, full_name, date_of_birth, phone, email, address, profile_photo,
    type, payment_type, base_salary, username, password
  ) VALUES (
    v_uid, p_full_name, p_date_of_birth, p_phone, lower(trim(p_email)), p_address, p_profile_photo,
    coalesce(NULLIF(p_type, ''), 'worker'), p_payment_type, coalesce(p_base_salary, 0),
    p_username, p_password
  )
  RETURNING * INTO v_worker;

  RETURN jsonb_build_object('success', true, 'user_id', v_uid, 'worker', to_jsonb(v_worker));
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_worker_account(
  text, text, text, date, text, text, text, text, text, numeric, text
) TO authenticated;


-- 11.3 login_worker — legacy fallback used by Login.tsx when Supabase Auth
--      sign-in fails (e.g. a worker row created directly without an auth
--      user). Validates the plaintext password stored on the workers row.
CREATE OR REPLACE FUNCTION public.login_worker(
  p_email_or_username text,
  p_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_worker public.workers%ROWTYPE;
BEGIN
  SELECT * INTO v_worker
  FROM public.workers
  WHERE (lower(email) = lower(trim(p_email_or_username))
      OR lower(username) = lower(trim(p_email_or_username)))
    AND password = p_password
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_CREDENTIALS');
  END IF;

  RETURN jsonb_build_object('success', true, 'worker', to_jsonb(v_worker));
END;
$$;

GRANT EXECUTE ON FUNCTION public.login_worker(text, text) TO anon, authenticated;


-- ============================================================================
-- 12) PUBLIC-WEBSITE RPCs (SECURITY DEFINER — bypass RLS safely)
-- ============================================================================

-- 12.1 get_reserved_periods — booked date ranges of one car (public calendar).
CREATE OR REPLACE FUNCTION public.get_reserved_periods(p_car_id uuid)
RETURNS TABLE (departure_date text, return_date text)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT r.departure_date::text, r.return_date::text
  FROM public.reservations r
  WHERE r.car_id = p_car_id
    AND r.status IN ('website_reservation','pending','accepted','confirmed','active');
$$;
GRANT EXECUTE ON FUNCTION public.get_reserved_periods(uuid) TO anon, authenticated;

-- 12.2 get_unavailable_car_ids — cars unavailable over a period (landing search).
CREATE OR REPLACE FUNCTION public.get_unavailable_car_ids(p_from date, p_to date)
RETURNS SETOF uuid
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT DISTINCT r.car_id
  FROM public.reservations r
  WHERE r.status IN ('website_reservation','pending','accepted','confirmed','active')
    AND r.departure_date <= p_to
    AND r.return_date >= p_from;
$$;
GRANT EXECUTE ON FUNCTION public.get_unavailable_car_ids(date, date) TO anon, authenticated;

-- 12.3 verify_promo_code — validate a promo code for the public site.
CREATE OR REPLACE FUNCTION public.verify_promo_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE
AS $$
DECLARE v_row public.promo_codes%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.promo_codes
  WHERE upper(code) = upper(trim(p_code)) LIMIT 1;

  IF NOT FOUND THEN RETURN jsonb_build_object('valid', false, 'reason', 'not_found'); END IF;
  IF v_row.is_used THEN RETURN jsonb_build_object('valid', false, 'reason', 'used'); END IF;
  IF NOT v_row.is_active THEN RETURN jsonb_build_object('valid', false, 'reason', 'inactive'); END IF;

  RETURN jsonb_build_object('valid', true, 'discount_percentage', v_row.discount_percentage);
END;
$$;
GRANT EXECUTE ON FUNCTION public.verify_promo_code(text) TO anon, authenticated;

-- 12.4 create_website_reservation — atomic client + reservation + services +
--      promo consumption from the public site. Status 'website_reservation',
--      source 'website' (stays out of the planner until the agency accepts).
CREATE OR REPLACE FUNCTION public.create_website_reservation(
  p_client jsonb,
  p_reservation jsonb,
  p_services jsonb DEFAULT '[]'::jsonb,
  p_promo_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_client_id      uuid;
  v_reservation_id uuid;
  v_car_id         uuid;
  v_departure      date;
  v_return         date;
  v_promo          public.promo_codes%ROWTYPE;
  v_service        jsonb;
BEGIN
  v_car_id    := (p_reservation->>'car_id')::uuid;
  v_departure := (p_reservation->>'departure_date')::date;
  v_return    := (p_reservation->>'return_date')::date;

  IF v_car_id IS NULL OR v_departure IS NULL OR v_return IS NULL THEN
    RAISE EXCEPTION 'INVALID_RESERVATION_DATA';
  END IF;
  IF v_return < v_departure THEN
    RAISE EXCEPTION 'INVALID_DATES';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.reservations r
    WHERE r.car_id = v_car_id
      AND r.status IN ('website_reservation','pending','accepted','confirmed','active')
      AND r.departure_date <= v_return
      AND r.return_date >= v_departure
  ) THEN
    RAISE EXCEPTION 'CAR_UNAVAILABLE';
  END IF;

  IF p_promo_code IS NOT NULL AND length(trim(p_promo_code)) > 0 THEN
    SELECT * INTO v_promo FROM public.promo_codes
    WHERE upper(code) = upper(trim(p_promo_code)) FOR UPDATE;
    IF NOT FOUND OR v_promo.is_used OR NOT v_promo.is_active THEN
      RAISE EXCEPTION 'PROMO_CODE_INVALID';
    END IF;
  END IF;

  INSERT INTO public.clients (
    first_name, last_name, phone, email,
    date_of_birth, place_of_birth, id_card_number,
    license_number, license_expiration_date, license_delivery_date, license_delivery_place,
    document_type, document_number, document_delivery_date, document_expiration_date, document_delivery_address,
    wilaya, complete_address, profile_photo, scanned_documents
  ) VALUES (
    coalesce(p_client->>'first_name', ''),
    coalesce(p_client->>'last_name', ''),
    coalesce(p_client->>'phone', ''),
    NULLIF(p_client->>'email', ''),
    NULLIF(p_client->>'date_of_birth', '')::date,
    NULLIF(p_client->>'place_of_birth', ''),
    NULLIF(p_client->>'id_card_number', ''),
    coalesce(p_client->>'license_number', ''),
    NULLIF(p_client->>'license_expiration_date', '')::date,
    NULLIF(p_client->>'license_delivery_date', '')::date,
    NULLIF(p_client->>'license_delivery_place', ''),
    coalesce(NULLIF(p_client->>'document_type', ''), 'none'),
    NULLIF(p_client->>'document_number', ''),
    NULLIF(p_client->>'document_delivery_date', '')::date,
    NULLIF(p_client->>'document_expiration_date', '')::date,
    NULLIF(p_client->>'document_delivery_address', ''),
    coalesce(p_client->>'wilaya', ''),
    NULLIF(p_client->>'complete_address', ''),
    NULLIF(p_client->>'profile_photo', ''),
    coalesce(
      ARRAY(SELECT jsonb_array_elements_text(coalesce(p_client->'scanned_documents', '[]'::jsonb))),
      '{}'::text[]
    )
  )
  RETURNING id INTO v_client_id;

  INSERT INTO public.reservations (
    client_id, car_id,
    departure_date, departure_time, departure_agency_id,
    return_date, return_time, return_agency_id,
    price_per_day, price_week, price_month,
    total_days, total_price, deposit,
    discount_amount, discount_type,
    advance_payment, remaining_payment,
    notes, status, source,
    protection_assurance_id, protection_assurance_name, protection_assurance_price
  ) VALUES (
    v_client_id, v_car_id,
    v_departure,
    coalesce(NULLIF(p_reservation->>'departure_time', ''), '10:00')::time,
    NULLIF(p_reservation->>'departure_agency_id', '')::uuid,
    v_return,
    coalesce(NULLIF(p_reservation->>'return_time', ''), '10:00')::time,
    NULLIF(p_reservation->>'return_agency_id', '')::uuid,
    coalesce((p_reservation->>'price_per_day')::numeric, 0),
    NULLIF(p_reservation->>'price_week', '')::numeric,
    NULLIF(p_reservation->>'price_month', '')::numeric,
    coalesce((p_reservation->>'total_days')::integer, 1),
    coalesce((p_reservation->>'total_price')::numeric, 0),
    coalesce((p_reservation->>'deposit')::numeric, 0),
    coalesce((p_reservation->>'discount_amount')::numeric, 0),
    coalesce(NULLIF(p_reservation->>'discount_type', ''), 'fixed'),
    0,
    coalesce((p_reservation->>'total_price')::numeric, 0),
    NULLIF(p_reservation->>'notes', ''),
    'website_reservation', 'website',
    NULLIF(p_reservation->>'protection_assurance_id', '')::uuid,
    NULLIF(p_reservation->>'protection_assurance_name', ''),
    coalesce((p_reservation->>'protection_assurance_price')::numeric, 0)
  )
  RETURNING id INTO v_reservation_id;

  FOR v_service IN SELECT * FROM jsonb_array_elements(coalesce(p_services, '[]'::jsonb))
  LOOP
    INSERT INTO public.reservation_services (reservation_id, category, service_name, description, price)
    VALUES (
      v_reservation_id,
      coalesce(NULLIF(v_service->>'category', ''), 'service'),
      coalesce(v_service->>'service_name', ''),
      NULLIF(v_service->>'description', ''),
      coalesce((v_service->>'price')::numeric, 0)
    );
  END LOOP;

  IF v_promo.id IS NOT NULL THEN
    UPDATE public.promo_codes
    SET is_used = true, used_at = now(), reservation_id = v_reservation_id
    WHERE id = v_promo.id;
  END IF;

  RETURN jsonb_build_object('reservation_id', v_reservation_id, 'client_id', v_client_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_website_reservation(jsonb, jsonb, jsonb, text) TO anon, authenticated;


-- ============================================================================
-- 13) SESSION AUDIT RPCs (optional, non-blocking — utils/sessionService.ts)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_admin_session(
  p_access_token text,
  p_refresh_token text,
  p_expires_at bigint,
  p_user_agent text DEFAULT NULL,
  p_ip_address text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.admin_sessions (user_id, access_token, refresh_token, expires_at, user_agent, ip_address)
  VALUES (auth.uid(), p_access_token, p_refresh_token, p_expires_at, p_user_agent, p_ip_address)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('success', true, 'session_id', v_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_admin_session(text, text, bigint, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.validate_session(p_token text)
RETURNS TABLE (is_valid boolean, is_expired boolean, seconds_until_expiry bigint)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT
    (s.is_valid AND s.expires_at > extract(epoch FROM now())::bigint)               AS is_valid,
    (s.expires_at <= extract(epoch FROM now())::bigint)                             AS is_expired,
    (s.expires_at - extract(epoch FROM now())::bigint)                              AS seconds_until_expiry
  FROM public.admin_sessions s
  WHERE s.access_token = p_token
  ORDER BY s.created_at DESC
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.validate_session(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.invalidate_session(p_token text)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.admin_sessions SET is_valid = false WHERE access_token = p_token;
$$;
GRANT EXECUTE ON FUNCTION public.invalidate_session(text) TO anon, authenticated;


-- ============================================================================
-- 14) STORAGE BUCKETS + POLICIES
-- ============================================================================
-- One bucket per image-upload location in the app. The DATABASE stores only
-- the public URL of each file; the binary lives here.
--   cars       → car photos              (uploadCarImage.ts)
--   worker     → worker profile photos   (uploadWorkerImage.ts)
--   clients    → client photo + docs     (uploadClientImage.ts, public wizard)
--   inspection → inspection photos + signatures (uploadInspectionImage.ts)
--   website    → logo + landing background (uploadWebsiteImage.ts)

INSERT INTO storage.buckets (id, name, public) VALUES
  ('cars',       'cars',       true),
  ('worker',     'worker',     true),
  ('clients',    'clients',    true),
  ('inspection', 'inspection', true),
  ('website',    'website',    true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Public read + authenticated write on every bucket.
DO $$
DECLARE b text;
DECLARE buckets text[] := ARRAY['cars','worker','clients','inspection','website'];
BEGIN
  FOREACH b IN ARRAY buckets LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_public_read" ON storage.objects;', b);
    EXECUTE format(
      'CREATE POLICY "%s_public_read" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = %L);',
      b, b);

    EXECUTE format('DROP POLICY IF EXISTS "%s_auth_insert" ON storage.objects;', b);
    EXECUTE format(
      'CREATE POLICY "%s_auth_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = %L);',
      b, b);

    EXECUTE format('DROP POLICY IF EXISTS "%s_auth_update" ON storage.objects;', b);
    EXECUTE format(
      'CREATE POLICY "%s_auth_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = %L) WITH CHECK (bucket_id = %L);',
      b, b, b);

    EXECUTE format('DROP POLICY IF EXISTS "%s_auth_delete" ON storage.objects;', b);
    EXECUTE format(
      'CREATE POLICY "%s_auth_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = %L);',
      b, b);
  END LOOP;
END $$;

-- The public reservation wizard (anonymous) uploads the client photo +
-- scanned documents into the "clients" bucket → allow anon INSERT there.
DROP POLICY IF EXISTS "clients_anon_insert" ON storage.objects;
CREATE POLICY "clients_anon_insert" ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id = 'clients');


-- ============================================================================
-- 15) SEED (optional): default inspection checklist categories can be added
--     from the app. Nothing is inserted here so the schema stays clean.
-- ============================================================================

-- ============================================================================
-- DONE. Next steps:
--   1. This project's anon key + URL are already wired into the app
--      (src/supabase.ts, .env).
--   2. Open the app → /login → "Créer un compte administrateur" to create the
--      first admin (create_admin_account). The option auto-hides afterwards.
--   3. Log in, then add workers from the "Équipe" page (create_worker_account);
--      each worker can log in with their email + password.
-- ============================================================================
