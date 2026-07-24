-- ============================================================================
-- MHD AUTO — MIGRATION 2026-07  (major update)
-- ============================================================================
-- Run this ENTIRE file ONCE in the Supabase SQL Editor, AFTER main.sql.
-- It is idempotent (safe to re-run). It adds everything the July 2026 update
-- needs:
--   1) cars      → owner (personal / third-party) + multi-currency pricing
--   2) currencies→ global registry (DZD, USD, EUR, GBP) with taux de change
--   3) entreprises → new module + link on reservations
--   4) services  → "obligatoire" flag
--   5) app_settings → global key/value store (mileage limit, fuel fees, …)
--   6) workers   → roles, granular permissions, account flags
--   7) reservations → currency, promo code, timbre fiscal, flight info,
--                     mileage limit snapshot, extra fees
--   8) RPCs      → website reservation v2, promo consumption, worker account
--                  v2, inspection image purge
--   9) RLS + storage buckets for the new objects
-- ============================================================================


-- ============================================================================
-- 1) CARS — owner type + multi-currency pricing
-- ============================================================================
-- owner_type          'personal'    → car belongs to the agency (default)
--                     'third_party' → car belongs to someone else; the agency
--                                     keeps `agency_daily_share` DZD per rental
--                                     day and the rest goes to the owner.
-- currency_config     per-car currency overrides, shape:
--   {
--     "USD": { "active": true, "rate": 134.5, "priceDay": 37, "priceWeek": 208,
--              "priceMonth": 669, "deposit": 372 },
--     "EUR": { ... }, "GBP": { ... }
--   }
--   `rate` = how many DZD one unit of that currency is worth.

ALTER TABLE public.cars
  ADD COLUMN IF NOT EXISTS owner_type         text    NOT NULL DEFAULT 'personal',
  ADD COLUMN IF NOT EXISTS owner_name         text,
  ADD COLUMN IF NOT EXISTS owner_phone        text,
  ADD COLUMN IF NOT EXISTS agency_daily_share numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency_config    jsonb   NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cars_owner_type_check') THEN
    ALTER TABLE public.cars
      ADD CONSTRAINT cars_owner_type_check
      CHECK (owner_type IN ('personal', 'third_party'));
  END IF;
END $$;

COMMENT ON COLUMN public.cars.owner_type IS
  'personal = agency-owned; third_party = owned by someone else (owner_name/owner_phone).';
COMMENT ON COLUMN public.cars.agency_daily_share IS
  'DZD the agency keeps per rental DAY when owner_type = third_party.';
COMMENT ON COLUMN public.cars.currency_config IS
  'Per-car currency overrides: {"USD":{"active":true,"rate":134.5,"priceDay":37,...}}';


-- ============================================================================
-- 2) CURRENCIES — global registry
-- ============================================================================
-- rate_to_dzd = how many DZD one unit of this currency is worth.
-- is_active   = shown in the app + website currency switchers.

CREATE TABLE IF NOT EXISTS public.currency_settings (
  code          text PRIMARY KEY,
  label         text    NOT NULL,
  symbol        text    NOT NULL,
  rate_to_dzd   numeric NOT NULL DEFAULT 1 CHECK (rate_to_dzd > 0),
  is_active     boolean NOT NULL DEFAULT false,
  is_base       boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.currency_settings (code, label, symbol, rate_to_dzd, is_active, is_base, display_order)
VALUES
  ('DZD', 'Dinar algérien', 'DA', 1,     true,  true,  0),
  ('USD', 'Dollar américain', '$', 134.5, false, false, 1),
  ('EUR', 'Euro',             '€', 145,   false, false, 2),
  ('GBP', 'Livre sterling',   '£', 170,   false, false, 3)
ON CONFLICT (code) DO NOTHING;

-- The base currency (DZD) can never be deactivated.
CREATE OR REPLACE FUNCTION public._currency_keep_base_active()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_base THEN
    NEW.is_active := true;
    NEW.rate_to_dzd := 1;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS currency_settings_guard ON public.currency_settings;
CREATE TRIGGER currency_settings_guard
  BEFORE INSERT OR UPDATE ON public.currency_settings
  FOR EACH ROW EXECUTE FUNCTION public._currency_keep_base_active();


-- ============================================================================
-- 3) ENTREPRISES — new sidebar module (under Clients)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.entreprises (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  rc         text,          -- Registre de Commerce   ex: 12/00-0000000B19
  art        text,          -- Article d'imposition   ex: 000000000
  nis        text,          -- N° d'Identification Statistique ex: 000000000000000
  nif        text,          -- N° d'Identification Fiscale     ex: 000000000000000
  phone      text,
  email      text,
  address    text,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS entreprises_name_idx ON public.entreprises (lower(name));


-- ============================================================================
-- 4) SERVICES — "obligatoire" flag
-- ============================================================================
-- A mandatory service is pre-selected (and locked) on the services step of both
-- the admin reservation form and the public website wizard.

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS is_mandatory boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.services.is_mandatory IS
  'Auto-selected on the services step of every reservation flow.';


-- ============================================================================
-- 5) APP SETTINGS — global key/value store
-- ============================================================================
-- Used for the mileage-limit parameters set from the "Terminer location"
-- modal, and any future global toggle.

CREATE TABLE IF NOT EXISTS public.app_settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Default mileage / fuel policy applied to every "terminer location".
INSERT INTO public.app_settings (key, value) VALUES (
  'mileage_policy',
  jsonb_build_object(
    'enabled',            true,
    'dailyLimitKm',       200,      -- km included per rental day
    'feePerExtraKm',      50,       -- DZD charged per km over the limit
    'fuelFeePerLevel',    1500,     -- DZD charged per missing fuel level step
    'autoApplyFees',      true
  )
) ON CONFLICT (key) DO NOTHING;

-- Default contract-printing options.
INSERT INTO public.app_settings (key, value) VALUES (
  'contract_options',
  jsonb_build_object('showPrices', true, 'showEntreprise', false)
) ON CONFLICT (key) DO NOTHING;


-- ============================================================================
-- 6) TEAM — roles, permissions, account flags
-- ============================================================================

-- 6.1 worker_roles — free-form roles created from the "Équipe" page.
CREATE TABLE IF NOT EXISTS public.worker_roles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT worker_roles_name_unique UNIQUE (name)
);

INSERT INTO public.worker_roles (name) VALUES
  ('Administrateur'), ('Agent de comptoir'), ('Chauffeur'), ('Mécanicien')
ON CONFLICT (name) DO NOTHING;

-- 6.2 workers — extra columns for the reworked form.
ALTER TABLE public.workers
  ADD COLUMN IF NOT EXISTS role_id        uuid REFERENCES public.worker_roles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS role_name      text,
  ADD COLUMN IF NOT EXISTS id_card_number text,
  ADD COLUMN IF NOT EXISTS start_date     date,
  ADD COLUMN IF NOT EXISTS is_paid        boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS has_account    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active      boolean NOT NULL DEFAULT true;

-- 6.3 worker_permissions — one row per (worker, page).
--     `actions` lists the button-action ids the worker may use on that page.
--     A page row existing at all = the page is visible in his sidebar.
CREATE TABLE IF NOT EXISTS public.worker_permissions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id  uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  page_id    text NOT NULL,
  actions    text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT worker_permissions_unique UNIQUE (worker_id, page_id)
);

CREATE INDEX IF NOT EXISTS worker_permissions_worker_idx
  ON public.worker_permissions (worker_id);

-- 6.4 worker_advances / absences — description is optional, dates editable.
ALTER TABLE public.worker_advances
  ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.worker_absences
  ADD COLUMN IF NOT EXISTS description text;

-- 6.5 worker_payments — track which acomptes/absences a payment settled, so
--     the next payment screen only offers what is still outstanding.
ALTER TABLE public.worker_payments
  ADD COLUMN IF NOT EXISTS description     text,
  ADD COLUMN IF NOT EXISTS period_start    date,
  ADD COLUMN IF NOT EXISTS period_end      date,
  ADD COLUMN IF NOT EXISTS advance_ids     uuid[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS absence_ids     uuid[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS is_manual_amount boolean NOT NULL DEFAULT false;

-- Settled flags let the payment screen list only what is still due.
ALTER TABLE public.worker_advances
  ADD COLUMN IF NOT EXISTS settled boolean NOT NULL DEFAULT false;
ALTER TABLE public.worker_absences
  ADD COLUMN IF NOT EXISTS settled boolean NOT NULL DEFAULT false;


-- ============================================================================
-- 7) RESERVATIONS — currency, promo, timbre, entreprise, flight, fees
-- ============================================================================

ALTER TABLE public.reservations
  -- Currency the client actually booked in (website) --------------------------
  ADD COLUMN IF NOT EXISTS currency_code             text    NOT NULL DEFAULT 'DZD',
  ADD COLUMN IF NOT EXISTS currency_rate             numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS total_price_currency      numeric,

  -- Promo code (public website, single use) ----------------------------------
  ADD COLUMN IF NOT EXISTS promo_code_id             uuid,
  ADD COLUMN IF NOT EXISTS promo_code                text,
  ADD COLUMN IF NOT EXISTS promo_discount_percentage numeric,
  ADD COLUMN IF NOT EXISTS promo_discount_amount     numeric DEFAULT 0,

  -- Timbre fiscal ------------------------------------------------------------
  ADD COLUMN IF NOT EXISTS timbre_enabled            boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS timbre_amount             numeric NOT NULL DEFAULT 0,

  -- Entreprise (contract / invoice printing) ---------------------------------
  ADD COLUMN IF NOT EXISTS entreprise_id             uuid,

  -- Flight information (public website personal-info step) -------------------
  ADD COLUMN IF NOT EXISTS flight_number             text,
  ADD COLUMN IF NOT EXISTS flight_date               date,
  ADD COLUMN IF NOT EXISTS flight_time               time,
  ADD COLUMN IF NOT EXISTS flight_ticket_image       text,

  -- Mileage / fuel policy snapshot + charged fees ----------------------------
  ADD COLUMN IF NOT EXISTS mileage_limit_km          numeric,
  ADD COLUMN IF NOT EXISTS excess_mileage_km         numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS excess_mileage_fee        numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS missing_fuel_levels       numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS missing_fuel_fee          numeric DEFAULT 0,

  -- Contract printing options (per reservation) ------------------------------
  ADD COLUMN IF NOT EXISTS contract_show_prices      boolean NOT NULL DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservations_entreprise_fkey') THEN
    ALTER TABLE public.reservations
      ADD CONSTRAINT reservations_entreprise_fkey
      FOREIGN KEY (entreprise_id) REFERENCES public.entreprises(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservations_promo_code_fkey') THEN
    ALTER TABLE public.reservations
      ADD CONSTRAINT reservations_promo_code_fkey
      FOREIGN KEY (promo_code_id) REFERENCES public.promo_codes(id) ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.reservations.currency_rate IS
  'DZD value of one unit of currency_code at booking time (frozen).';
COMMENT ON COLUMN public.reservations.timbre_amount IS
  'Timbre fiscal: 1% (300–30000 DA), 1.5% (30001–100000 DA), 2% (>100000 DA).';


-- ============================================================================
-- 8) FUNCTIONS
-- ============================================================================

-- 8.1 calc_timbre — the timbre fiscal scale, so the DB and the UI agree.
--     "1 DA par tranche de 100 DA" → every started tranche is due, hence the
--     ceil(). Mirrors src/utils/timbre.ts exactly.
--       300 – 30 000 DA  → 1    DA / tranche de 100  (1 %)
--       30 001 – 100 000 → 1,5  DA / tranche de 100  (1,5 %)
--       > 100 000        → 2    DA / tranche de 100  (2 %)
CREATE OR REPLACE FUNCTION public.calc_timbre(p_total numeric)
RETURNS numeric
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_total IS NULL OR p_total < 300 THEN 0
    WHEN p_total <= 30000  THEN round(ceil(p_total / 100.0) * 1.0, 2)
    WHEN p_total <= 100000 THEN round(ceil(p_total / 100.0) * 1.5, 2)
    ELSE                        round(ceil(p_total / 100.0) * 2.0, 2)
  END;
$$;


-- 8.2 consume_promo_code — atomically validate AND burn a promo code.
--     Returns the discount so the caller can apply it. Single use enforced by
--     the `FOR UPDATE` lock + is_used flag.
CREATE OR REPLACE FUNCTION public.consume_promo_code(
  p_code           text,
  p_reservation_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_row public.promo_codes%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.promo_codes
  WHERE upper(code) = upper(trim(p_code))
  FOR UPDATE;

  IF NOT FOUND    THEN RETURN jsonb_build_object('valid', false, 'reason', 'not_found'); END IF;
  IF v_row.is_used THEN RETURN jsonb_build_object('valid', false, 'reason', 'used');      END IF;
  IF NOT v_row.is_active THEN RETURN jsonb_build_object('valid', false, 'reason', 'inactive'); END IF;

  UPDATE public.promo_codes
  SET is_used = true, used_at = now(), reservation_id = p_reservation_id
  WHERE id = v_row.id;

  RETURN jsonb_build_object(
    'valid', true,
    'promo_code_id', v_row.id,
    'discount_percentage', v_row.discount_percentage
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.consume_promo_code(text, uuid) TO anon, authenticated;


-- 8.3 purge_reservation_inspection_images — called when a rental is
--     terminated. Wipes every inspection photo URL of that reservation from
--     the database, permanently. (The storage objects are deleted by the app
--     through the storage API before calling this.)
CREATE OR REPLACE FUNCTION public.purge_reservation_inspection_images(p_reservation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_urls text[] := '{}'::text[];
BEGIN
  SELECT coalesce(
           array_agg(u) FILTER (WHERE u IS NOT NULL AND u <> ''),
           '{}'::text[]
         )
  INTO v_urls
  FROM public.vehicle_inspections vi,
       LATERAL unnest(
         ARRAY[vi.exterior_front_photo, vi.exterior_rear_photo, vi.interior_photo]
         || coalesce(vi.other_photos, '{}'::text[])
       ) AS u
  WHERE vi.reservation_id = p_reservation_id;

  UPDATE public.vehicle_inspections
  SET exterior_front_photo = NULL,
      exterior_rear_photo  = NULL,
      interior_photo       = NULL,
      other_photos         = '{}'::text[]
  WHERE reservation_id = p_reservation_id;

  RETURN jsonb_build_object('success', true, 'deleted_urls', to_jsonb(v_urls));
END;
$$;
GRANT EXECUTE ON FUNCTION public.purge_reservation_inspection_images(uuid) TO authenticated;


-- 8.4 create_worker_account (v2) — adds role, id card, start date, payment
--     toggle and the "has account" flag. The old 11-arg version from main.sql
--     is dropped so there is exactly one signature.
DROP FUNCTION IF EXISTS public.create_worker_account(
  text, text, text, date, text, text, text, text, text, numeric, text
);

CREATE OR REPLACE FUNCTION public.create_worker_account(
  p_full_name      text,
  p_phone          text          DEFAULT NULL,
  p_date_of_birth  date          DEFAULT NULL,
  p_id_card_number text          DEFAULT NULL,
  p_role_id        uuid          DEFAULT NULL,
  p_role_name      text          DEFAULT NULL,
  p_start_date     date          DEFAULT NULL,
  p_is_paid        boolean       DEFAULT true,
  p_payment_type   text          DEFAULT NULL,
  p_base_salary    numeric       DEFAULT 0,
  p_has_account    boolean       DEFAULT false,
  p_email          text          DEFAULT NULL,
  p_username       text          DEFAULT NULL,
  p_password       text          DEFAULT NULL,
  p_profile_photo  text          DEFAULT NULL,
  p_address        text          DEFAULT NULL
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
  -- Only create a Supabase Auth user when the admin enabled login access.
  IF p_has_account THEN
    IF p_email IS NULL OR length(trim(p_email)) = 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'EMAIL_REQUIRED');
    END IF;
    IF p_password IS NULL OR length(p_password) < 6 THEN
      RETURN jsonb_build_object('success', false, 'error', 'PASSWORD_TOO_SHORT');
    END IF;
    IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = lower(trim(p_email))) THEN
      RETURN jsonb_build_object('success', false, 'error', 'EMAIL_ALREADY_EXISTS');
    END IF;

    v_uid := public._create_auth_user(
      trim(p_email), p_password,
      jsonb_build_object(
        'role',      'worker',
        'full_name', coalesce(p_full_name, ''),
        'username',  coalesce(p_username, '')
      )
    );

    -- Mirror into profiles so role lookups work like they do for admins.
    INSERT INTO public.profiles (id, username, role)
    VALUES (v_uid, coalesce(NULLIF(p_username, ''), trim(p_email)), 'worker')
    ON CONFLICT (id) DO UPDATE
      SET role = 'worker', username = EXCLUDED.username;
  END IF;

  INSERT INTO public.workers (
    user_id, full_name, date_of_birth, phone, email, address, profile_photo,
    type, role_id, role_name, id_card_number, start_date,
    is_paid, payment_type, base_salary, has_account,
    username, password
  ) VALUES (
    v_uid, p_full_name, p_date_of_birth, p_phone,
    NULLIF(lower(trim(coalesce(p_email, ''))), ''), p_address, p_profile_photo,
    'worker', p_role_id, p_role_name, p_id_card_number, p_start_date,
    coalesce(p_is_paid, true), p_payment_type, coalesce(p_base_salary, 0),
    coalesce(p_has_account, false),
    p_username, CASE WHEN p_has_account THEN p_password ELSE NULL END
  )
  RETURNING * INTO v_worker;

  RETURN jsonb_build_object('success', true, 'user_id', v_uid, 'worker', to_jsonb(v_worker));
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_worker_account(
  text, text, date, text, uuid, text, date, boolean, text, numeric,
  boolean, text, text, text, text, text
) TO authenticated;


-- 8.5 set_worker_account — enable / disable login for an EXISTING worker, or
--     change his credentials, from the worker edit form.
CREATE OR REPLACE FUNCTION public.set_worker_account(
  p_worker_id uuid,
  p_enabled   boolean,
  p_email     text DEFAULT NULL,
  p_username  text DEFAULT NULL,
  p_password  text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, extensions
AS $$
DECLARE
  v_worker public.workers%ROWTYPE;
  v_uid    uuid;
BEGIN
  SELECT * INTO v_worker FROM public.workers WHERE id = p_worker_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'WORKER_NOT_FOUND');
  END IF;

  -- Disable: drop the auth user, keep the worker row.
  IF NOT p_enabled THEN
    IF v_worker.user_id IS NOT NULL THEN
      DELETE FROM auth.users   WHERE id = v_worker.user_id;
      DELETE FROM public.profiles WHERE id = v_worker.user_id;
    END IF;
    UPDATE public.workers
    SET has_account = false, user_id = NULL, password = NULL
    WHERE id = p_worker_id;
    RETURN jsonb_build_object('success', true, 'enabled', false);
  END IF;

  IF p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'EMAIL_REQUIRED');
  END IF;

  -- Already has an account → update email / password in place.
  IF v_worker.user_id IS NOT NULL THEN
    UPDATE auth.users
    SET email              = lower(trim(p_email)),
        encrypted_password = CASE
                               WHEN p_password IS NOT NULL AND length(p_password) >= 6
                               THEN extensions.crypt(p_password, extensions.gen_salt('bf'))
                               ELSE encrypted_password
                             END,
        updated_at         = now()
    WHERE id = v_worker.user_id;

    UPDATE public.workers
    SET email = lower(trim(p_email)),
        username = coalesce(p_username, username),
        password = coalesce(p_password, password),
        has_account = true
    WHERE id = p_worker_id;

    RETURN jsonb_build_object('success', true, 'enabled', true, 'user_id', v_worker.user_id);
  END IF;

  -- No account yet → create one.
  IF p_password IS NULL OR length(p_password) < 6 THEN
    RETURN jsonb_build_object('success', false, 'error', 'PASSWORD_TOO_SHORT');
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = lower(trim(p_email))) THEN
    RETURN jsonb_build_object('success', false, 'error', 'EMAIL_ALREADY_EXISTS');
  END IF;

  v_uid := public._create_auth_user(
    trim(p_email), p_password,
    jsonb_build_object('role', 'worker', 'full_name', coalesce(v_worker.full_name, ''),
                       'username', coalesce(p_username, ''))
  );

  INSERT INTO public.profiles (id, username, role)
  VALUES (v_uid, coalesce(NULLIF(p_username, ''), trim(p_email)), 'worker')
  ON CONFLICT (id) DO UPDATE SET role = 'worker', username = EXCLUDED.username;

  UPDATE public.workers
  SET user_id = v_uid, email = lower(trim(p_email)),
      username = p_username, password = p_password, has_account = true
  WHERE id = p_worker_id;

  RETURN jsonb_build_object('success', true, 'enabled', true, 'user_id', v_uid);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_worker_account(uuid, boolean, text, text, text)
  TO authenticated;


-- 8.6 get_my_permissions — the logged-in user's sidebar pages + button actions.
--     Admins get NULL (meaning "everything"); workers get their explicit rows.
CREATE OR REPLACE FUNCTION public.get_my_permissions()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE
AS $$
DECLARE
  v_role      text;
  v_worker_id uuid;
  v_perms     jsonb;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();

  IF v_role = 'admin' THEN
    RETURN jsonb_build_object('role', 'admin', 'isAdmin', true, 'permissions', NULL);
  END IF;

  SELECT id INTO v_worker_id FROM public.workers WHERE user_id = auth.uid();
  IF v_worker_id IS NULL THEN
    RETURN jsonb_build_object('role', coalesce(v_role, 'worker'), 'isAdmin', false,
                              'permissions', '{}'::jsonb);
  END IF;

  SELECT coalesce(jsonb_object_agg(page_id, to_jsonb(actions)), '{}'::jsonb)
  INTO v_perms
  FROM public.worker_permissions
  WHERE worker_id = v_worker_id;

  RETURN jsonb_build_object(
    'role', 'worker', 'isAdmin', false,
    'workerId', v_worker_id, 'permissions', v_perms
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_permissions() TO authenticated;


-- 8.7 set_worker_permissions — replace a worker's whole permission set.
CREATE OR REPLACE FUNCTION public.set_worker_permissions(
  p_worker_id uuid,
  p_perms     jsonb   -- { "vehicles": ["create","edit"], "clients": [...] }
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE k text;
BEGIN
  DELETE FROM public.worker_permissions WHERE worker_id = p_worker_id;

  FOR k IN SELECT jsonb_object_keys(coalesce(p_perms, '{}'::jsonb))
  LOOP
    INSERT INTO public.worker_permissions (worker_id, page_id, actions)
    VALUES (
      p_worker_id, k,
      coalesce(ARRAY(SELECT jsonb_array_elements_text(p_perms->k)), '{}'::text[])
    );
  END LOOP;

  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_worker_permissions(uuid, jsonb) TO authenticated;


-- 8.8 create_website_reservation (v2) — now carries currency, promo code,
--     timbre and flight information. The v1 signature is dropped.
DROP FUNCTION IF EXISTS public.create_website_reservation(jsonb, jsonb, jsonb, text);

CREATE OR REPLACE FUNCTION public.create_website_reservation(
  p_client      jsonb,
  p_reservation jsonb,
  p_services    jsonb DEFAULT '[]'::jsonb,
  p_promo_code  text  DEFAULT NULL
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
  v_total          numeric;
  v_promo_amount   numeric := 0;
  v_timbre         numeric := 0;
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

  v_total := coalesce((p_reservation->>'total_price')::numeric, 0);

  -- Promo code: locked, validated, and burned below (single use).
  IF p_promo_code IS NOT NULL AND length(trim(p_promo_code)) > 0 THEN
    SELECT * INTO v_promo FROM public.promo_codes
    WHERE upper(code) = upper(trim(p_promo_code)) FOR UPDATE;
    IF NOT FOUND OR v_promo.is_used OR NOT v_promo.is_active THEN
      RAISE EXCEPTION 'PROMO_CODE_INVALID';
    END IF;
    v_promo_amount := round(v_total * v_promo.discount_percentage / 100, 2);
    v_total        := v_total - v_promo_amount;
  END IF;

  -- Timbre fiscal, if the site asked for it.
  IF coalesce((p_reservation->>'timbre_enabled')::boolean, false) THEN
    v_timbre := public.calc_timbre(v_total);
    v_total  := v_total + v_timbre;
  END IF;

  INSERT INTO public.clients (
    first_name, last_name, phone, email,
    date_of_birth, place_of_birth, id_card_number,
    license_number, license_expiration_date, license_delivery_date, license_delivery_place,
    document_type, document_number, document_delivery_date, document_expiration_date,
    document_delivery_address, wilaya, complete_address, profile_photo, scanned_documents
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
    protection_assurance_id, protection_assurance_name, protection_assurance_price,
    currency_code, currency_rate, total_price_currency,
    promo_code, promo_discount_percentage, promo_discount_amount,
    timbre_enabled, timbre_amount,
    flight_number, flight_date, flight_time, flight_ticket_image
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
    v_total,
    coalesce((p_reservation->>'deposit')::numeric, 0),
    coalesce((p_reservation->>'discount_amount')::numeric, 0),
    coalesce(NULLIF(p_reservation->>'discount_type', ''), 'fixed'),
    0,
    v_total,
    NULLIF(p_reservation->>'notes', ''),
    'website_reservation', 'website',
    NULLIF(p_reservation->>'protection_assurance_id', '')::uuid,
    NULLIF(p_reservation->>'protection_assurance_name', ''),
    coalesce((p_reservation->>'protection_assurance_price')::numeric, 0),
    coalesce(NULLIF(p_reservation->>'currency_code', ''), 'DZD'),
    coalesce((p_reservation->>'currency_rate')::numeric, 1),
    NULLIF(p_reservation->>'total_price_currency', '')::numeric,
    NULLIF(trim(coalesce(p_promo_code, '')), ''),
    v_promo.discount_percentage,
    v_promo_amount,
    coalesce((p_reservation->>'timbre_enabled')::boolean, false),
    v_timbre,
    NULLIF(p_reservation->>'flight_number', ''),
    NULLIF(p_reservation->>'flight_date', '')::date,
    NULLIF(p_reservation->>'flight_time', '')::time,
    NULLIF(p_reservation->>'flight_ticket_image', '')
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

    UPDATE public.reservations
    SET promo_code_id = v_promo.id
    WHERE id = v_reservation_id;
  END IF;

  RETURN jsonb_build_object(
    'reservation_id', v_reservation_id,
    'client_id',      v_client_id,
    'total_price',    v_total,
    'promo_discount', v_promo_amount,
    'timbre',         v_timbre
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_website_reservation(jsonb, jsonb, jsonb, text)
  TO anon, authenticated;


-- ============================================================================
-- 9) ROW LEVEL SECURITY for the new tables
-- ============================================================================

DO $$
DECLARE t text;
DECLARE auth_tables text[] := ARRAY[
  'currency_settings','entreprises','app_settings',
  'worker_roles','worker_permissions'
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

-- The public website needs to read the active currencies (price switcher).
DROP POLICY IF EXISTS "currency_settings_anon_read" ON public.currency_settings;
CREATE POLICY "currency_settings_anon_read"
  ON public.currency_settings FOR SELECT TO anon USING (true);

-- …and app_settings for the mileage policy shown on the offer pages.
DROP POLICY IF EXISTS "app_settings_anon_read" ON public.app_settings;
CREATE POLICY "app_settings_anon_read"
  ON public.app_settings FOR SELECT TO anon USING (true);


-- ============================================================================
-- 10) STORAGE — bucket for flight-ticket justifications
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('flight-tickets', 'flight-tickets', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "flight_tickets_public_read" ON storage.objects;
CREATE POLICY "flight_tickets_public_read"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'flight-tickets');

-- The public website uploads the ticket while still anonymous.
DROP POLICY IF EXISTS "flight_tickets_anon_insert" ON storage.objects;
CREATE POLICY "flight_tickets_anon_insert"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'flight-tickets');

DROP POLICY IF EXISTS "flight_tickets_auth_delete" ON storage.objects;
CREATE POLICY "flight_tickets_auth_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'flight-tickets');

-- Terminating a rental must be able to delete its inspection photos.
DROP POLICY IF EXISTS "inspections_auth_delete" ON storage.objects;
CREATE POLICY "inspections_auth_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'inspections');


-- ============================================================================
-- 11) BACKFILL
-- ============================================================================

UPDATE public.cars
SET owner_type = 'personal'
WHERE owner_type IS NULL;

UPDATE public.reservations
SET currency_code = 'DZD', currency_rate = 1
WHERE currency_code IS NULL;

UPDATE public.workers w
SET role_name = coalesce(w.role_name, initcap(w.type)),
    has_account = (w.user_id IS NOT NULL)
WHERE w.role_name IS NULL OR w.has_account IS NULL;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
