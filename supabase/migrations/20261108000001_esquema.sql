-- =====================================================================
-- Sellos · Esquema base (multi-negocio)
-- Zona horaria por defecto: America/Mexico_City · Moneda: MXN
-- =====================================================================

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.business_status as enum ('trial', 'active', 'suspended');
create type public.stamp_kind as enum ('signup_gift', 'visit');
create type public.redemption_kind as enum ('final', 'mid');
create type public.consent_kind as enum ('privacy', 'terms', 'marketing');
create type public.legal_kind as enum ('privacy', 'terms');

-- ---------------------------------------------------------------------
-- Negocios
-- ---------------------------------------------------------------------
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$'),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  status public.business_status not null default 'trial',
  trial_ends_at date,
  logo_path text,
  primary_color text not null default '#7c2d12' check (primary_color ~ '^#[0-9a-f]{6}$'),
  secondary_color text not null default '#fef3c7' check (secondary_color ~ '^#[0-9a-f]{6}$'),
  stamp_icon text not null default 'cafe'
    check (stamp_icon in ('cafe', 'estrella', 'corazon', 'cubiertos', 'pan', 'taco', 'hoja', 'regalo')),
  avg_ticket_mxn numeric(10, 2) not null default 0
    check (avg_ticket_mxn >= 0 and avg_ticket_mxn < 100000),
  timezone text not null default 'America/Mexico_City',
  at_risk_days int not null default 30 check (at_risk_days between 7 and 365),
  frequent_min_visits int not null default 3 check (frequent_min_visits between 2 and 50),
  -- Estructura lista para cobros futuros (Stripe o Mercado Pago). No se usa todavía.
  billing_provider text check (billing_provider in ('stripe', 'mercadopago')),
  billing_customer_id text,
  billing_subscription_id text,
  billing_status text,
  billing_current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Reglas de la promoción (una por negocio)
create table public.programs (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  stamps_required int not null default 8 check (stamps_required between 3 and 20),
  signup_gift int not null default 2 check (signup_gift >= 0),
  reward_final text not null default 'Un producto gratis'
    check (char_length(btrim(reward_final)) between 2 and 120),
  reward_mid text check (reward_mid is null or char_length(btrim(reward_mid)) between 2 and 120),
  reward_mid_at int,
  valid_from date,
  valid_until date,
  restrictions text not null default '' check (char_length(restrictions) <= 500),
  cooldown_minutes int not null default 30 check (cooldown_minutes between 0 and 1440),
  -- [{"days":[1,2],"from":"15:00","to":"18:00"}] · days: 0=domingo … 6=sábado
  double_rules jsonb not null default '[]'::jsonb check (jsonb_typeof(double_rules) = 'array'),
  updated_at timestamptz not null default now(),
  check (signup_gift < stamps_required),
  check ((reward_mid is null) = (reward_mid_at is null)),
  check (reward_mid_at is null or (reward_mid_at >= 1 and reward_mid_at < stamps_required)),
  check (valid_until is null or valid_from is null or valid_until >= valid_from)
);

-- Dueños (usuarios de Supabase Auth) ↔ negocio
create table public.business_owners (
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index on public.business_owners (user_id);

-- Superadministradores de la plataforma
create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Empleados (entran con PIN, no son usuarios de Auth)
create table public.staff (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 60),
  pin_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);
create index on public.staff (business_id);

create table public.staff_sessions (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  token_hash bytea not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

-- Clientes (por negocio). Sin contraseña: acceden con un enlace privado.
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  phone text check (phone ~ '^\+52[0-9]{10}$'),
  birthday date,
  marketing_opt_in boolean not null default false,
  access_token_hash bytea not null unique,
  qr_code text not null unique,
  created_at timestamptz not null default now(),
  last_visit_at timestamptz,
  deleted_at timestamptz,
  unique (business_id, phone)
);
create index on public.customers (business_id, created_at);

-- Tarjetas: un ciclo de sellos. Al canjear el premio final se cierra y se abre otra.
create table public.cards (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  cycle int not null default 1,
  status text not null default 'active' check (status in ('active', 'redeemed')),
  mid_redeemed_at timestamptz,
  created_at timestamptz not null default now(),
  redeemed_at timestamptz
);
create unique index cards_one_active_per_customer on public.cards (customer_id) where status = 'active';
create index on public.cards (business_id);

-- Historial de sellos (nunca se borra; deshacer marca undone_at)
create table public.stamp_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  card_id uuid not null references public.cards (id) on delete cascade,
  kind public.stamp_kind not null,
  amount int not null check (amount between 1 and 20),
  is_double boolean not null default false,
  staff_id uuid references public.staff (id) on delete set null,
  staff_name text,
  created_at timestamptz not null default now(),
  undone_at timestamptz,
  undone_by uuid references public.staff (id) on delete set null
);
create index on public.stamp_events (business_id, created_at);
create index on public.stamp_events (customer_id, created_at);
create index on public.stamp_events (card_id);

create table public.redemptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  card_id uuid not null references public.cards (id) on delete cascade,
  kind public.redemption_kind not null,
  reward text not null,
  staff_id uuid references public.staff (id) on delete set null,
  staff_name text,
  created_at timestamptz not null default now()
);
create index on public.redemptions (business_id, created_at);

-- Consentimientos: solo se agregan, nunca se editan. Guardan versión y fecha.
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  kind public.consent_kind not null,
  granted boolean not null,
  document_version text not null,
  created_at timestamptz not null default now(),
  ip_hash text,
  user_agent text
);
create index on public.consents (customer_id, kind, created_at);

-- Aviso de privacidad y términos (editables, con versión)
create table public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  kind public.legal_kind not null,
  version text not null,
  title text not null,
  body text not null,
  is_draft boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid,
  unique (kind, version)
);

-- Códigos de recuperación de tarjeta (de un solo uso, generados en mostrador)
create table public.recovery_codes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  code_hash bytea not null unique,
  staff_id uuid references public.staff (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

-- Límite de intentos (PIN, registro, recuperación)
create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (key, window_start)
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  business_id uuid references public.businesses (id) on delete cascade,
  actor_type text not null check (actor_type in ('admin', 'owner', 'staff', 'customer', 'system')),
  actor_id text,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.audit_log (business_id, created_at);

-- updated_at automático
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger businesses_touch before update on public.businesses
  for each row execute function public.touch_updated_at();
create trigger programs_touch before update on public.programs
  for each row execute function public.touch_updated_at();

-- Cada negocio nuevo recibe su programa con valores por defecto (8 sellos, 2 de regalo, 30 min)
create or replace function public.create_default_program() returns trigger
language plpgsql set search_path = public as $$
begin
  insert into public.programs (business_id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger businesses_default_program after insert on public.businesses
  for each row execute function public.create_default_program();
