-- Sellos · instalación completa de la base de datos.
-- Pégalo completo en Supabase → SQL Editor → New query → Run.
-- Archivo generado con "npm run sql:unir"; no lo edites a mano.

-- ===== 20261108000001_esquema.sql =====
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

-- ===== 20261108000002_seguridad.sql =====
-- =====================================================================
-- Sellos · Row Level Security y permisos
-- Regla de oro: ningún negocio puede ver datos de otro.
-- - anon: no lee ninguna tabla (las páginas públicas pasan por el servidor).
-- - authenticated (dueños y superadmin): solo filas de sus negocios.
-- - service_role: solo se usa en el servidor; las operaciones sensibles
--   pasan por funciones que validan el negocio dentro de la base.
-- =====================================================================

create or replace function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

create or replace function public.can_access_business(p_business_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_platform_admin()
      or exists (
        select 1 from public.business_owners
        where business_id = p_business_id and user_id = auth.uid()
      );
$$;

-- Activar RLS en todas las tablas
alter table public.businesses enable row level security;
alter table public.programs enable row level security;
alter table public.business_owners enable row level security;
alter table public.platform_admins enable row level security;
alter table public.staff enable row level security;
alter table public.staff_sessions enable row level security;
alter table public.customers enable row level security;
alter table public.cards enable row level security;
alter table public.stamp_events enable row level security;
alter table public.redemptions enable row level security;
alter table public.consents enable row level security;
alter table public.legal_documents enable row level security;
alter table public.recovery_codes enable row level security;
alter table public.rate_limits enable row level security;
alter table public.audit_log enable row level security;

-- Quitar privilegios por defecto que Supabase otorga a anon/authenticated
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- ------------------------- businesses --------------------------------
create policy businesses_select on public.businesses for select to authenticated
  using (public.can_access_business(id));
create policy businesses_update on public.businesses for update to authenticated
  using (public.can_access_business(id)) with check (public.can_access_business(id));

grant select on public.businesses to authenticated;
-- El dueño puede editar su marca y ajustes, pero NO el estado, slug ni cobros.
grant update (name, logo_path, primary_color, secondary_color, stamp_icon,
              avg_ticket_mxn, at_risk_days, frequent_min_visits)
  on public.businesses to authenticated;

-- ------------------------- programs ----------------------------------
create policy programs_select on public.programs for select to authenticated
  using (public.can_access_business(business_id));
create policy programs_update on public.programs for update to authenticated
  using (public.can_access_business(business_id)) with check (public.can_access_business(business_id));
grant select on public.programs to authenticated;
grant update (stamps_required, signup_gift, reward_final, reward_mid, reward_mid_at,
              valid_from, valid_until, restrictions, cooldown_minutes, double_rules)
  on public.programs to authenticated;

-- ------------------------- owners / admins ---------------------------
create policy owners_select on public.business_owners for select to authenticated
  using (user_id = auth.uid() or public.is_platform_admin());
grant select on public.business_owners to authenticated;

create policy admins_select on public.platform_admins for select to authenticated
  using (user_id = auth.uid());
grant select on public.platform_admins to authenticated;

-- ------------------------- staff (sin pin_hash) ----------------------
create policy staff_select on public.staff for select to authenticated
  using (public.can_access_business(business_id));
grant select (id, business_id, name, active, created_at, last_login_at) on public.staff to authenticated;

-- ------------------------- customers (sin tokens) --------------------
create policy customers_select on public.customers for select to authenticated
  using (public.can_access_business(business_id));
grant select (id, business_id, name, phone, birthday, marketing_opt_in, created_at,
              last_visit_at, deleted_at)
  on public.customers to authenticated;

-- ------------------------- datos de actividad ------------------------
create policy cards_select on public.cards for select to authenticated
  using (public.can_access_business(business_id));
grant select on public.cards to authenticated;

create policy stamps_select on public.stamp_events for select to authenticated
  using (public.can_access_business(business_id));
grant select on public.stamp_events to authenticated;

create policy redemptions_select on public.redemptions for select to authenticated
  using (public.can_access_business(business_id));
grant select on public.redemptions to authenticated;

create policy consents_select on public.consents for select to authenticated
  using (public.can_access_business(business_id));
grant select on public.consents to authenticated;

create policy audit_select on public.audit_log for select to authenticated
  using (business_id is not null and public.can_access_business(business_id)
         or public.is_platform_admin());
grant select on public.audit_log to authenticated;

-- ------------------------- documentos legales ------------------------
create policy legal_read on public.legal_documents for select to anon, authenticated using (true);
create policy legal_insert on public.legal_documents for insert to authenticated
  with check (public.is_platform_admin());
grant select on public.legal_documents to anon, authenticated;
grant insert on public.legal_documents to authenticated;

-- staff_sessions, recovery_codes, rate_limits: sin políticas → inaccesibles
-- para anon/authenticated. Solo el servidor (service_role) las usa.

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- ===== 20261108000003_funciones.sql =====
-- =====================================================================
-- Sellos · Lógica de negocio dentro de la base de datos
-- Todas las validaciones críticas (antifraude, canje, consentimiento)
-- ocurren aquí, de forma atómica. El servidor solo las invoca.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------
create or replace function public.hash_token(p text) returns bytea
language sql immutable set search_path = public, extensions as $$
  select extensions.digest(convert_to(p, 'UTF8'), 'sha256');
$$;

create or replace function public.random_token(p_bytes int default 32) returns text
language sql volatile set search_path = public, extensions as $$
  select rtrim(translate(encode(extensions.gen_random_bytes(p_bytes), 'base64'), '+/', '-_'), '=');
$$;

create or replace function public.audit(p_business uuid, p_actor_type text, p_actor_id text,
                                        p_action text, p_details jsonb default '{}'::jsonb)
returns void language sql set search_path = public as $$
  insert into public.audit_log (business_id, actor_type, actor_id, action, details)
  values (p_business, p_actor_type, p_actor_id, p_action, coalesce(p_details, '{}'::jsonb));
$$;

-- Devuelve true si el intento está permitido (y lo cuenta).
create or replace function public.hit_rate_limit(p_key text, p_max int, p_window_seconds int)
returns boolean language plpgsql set search_path = public as $$
declare
  v_start timestamptz;
  v_hits int;
begin
  v_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into public.rate_limits (key, window_start, hits) values (p_key, v_start, 1)
  on conflict (key, window_start) do update set hits = public.rate_limits.hits + 1
  returning hits into v_hits;
  if random() < 0.02 then
    delete from public.rate_limits where window_start < now() - interval '2 days';
  end if;
  return v_hits <= p_max;
end $$;

-- Multiplicador de sellos (doble sello por día y horario, en la zona del negocio)
create or replace function public.stamp_multiplier(p_rules jsonb, p_at timestamptz, p_tz text)
returns int language plpgsql stable set search_path = public as $$
declare
  r jsonb;
  v_local timestamp := p_at at time zone p_tz;
  v_dow int := extract(dow from v_local)::int;
  v_time time := v_local::time;
begin
  for r in select * from jsonb_array_elements(coalesce(p_rules, '[]'::jsonb)) loop
    if (r -> 'days') @> to_jsonb(v_dow)
       and v_time >= (r ->> 'from')::time
       and v_time < (r ->> 'to')::time then
      return 2;
    end if;
  end loop;
  return 1;
end $$;

-- Estado de la tarjeta activa de un cliente
create or replace function public.card_state(p_customer_id uuid) returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object(
    'card_id', c.id,
    'cycle', c.cycle,
    'stamps', coalesce((select sum(e.amount) from public.stamp_events e
                        where e.card_id = c.id and e.undone_at is null), 0),
    'gift_stamps', coalesce((select sum(e.amount) from public.stamp_events e
                             where e.card_id = c.id and e.undone_at is null
                               and e.kind = 'signup_gift'), 0),
    'mid_redeemed', c.mid_redeemed_at is not null,
    'total_visits', (select count(*) from public.stamp_events e
                     where e.customer_id = p_customer_id and e.kind = 'visit' and e.undone_at is null),
    'rewards_redeemed', (select count(*) from public.redemptions r
                         where r.customer_id = p_customer_id and r.kind = 'final'),
    'last_visit_at', (select max(e.created_at) from public.stamp_events e
                      where e.customer_id = p_customer_id and e.kind = 'visit' and e.undone_at is null)
  )
  from public.cards c
  where c.customer_id = p_customer_id and c.status = 'active';
$$;

-- Marca y reglas públicas de un negocio (sin datos privados)
create or replace function public.public_business(p_business_id uuid) returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object(
    'id', b.id, 'slug', b.slug, 'name', b.name, 'status', b.status,
    'logo_path', b.logo_path, 'primary_color', b.primary_color,
    'secondary_color', b.secondary_color, 'stamp_icon', b.stamp_icon,
    'timezone', b.timezone,
    'program', jsonb_build_object(
      'stamps_required', p.stamps_required, 'signup_gift', p.signup_gift,
      'reward_final', p.reward_final, 'reward_mid', p.reward_mid, 'reward_mid_at', p.reward_mid_at,
      'valid_from', p.valid_from, 'valid_until', p.valid_until,
      'restrictions', p.restrictions, 'cooldown_minutes', p.cooldown_minutes,
      'double_rules', p.double_rules)
  )
  from public.businesses b join public.programs p on p.business_id = b.id
  where b.id = p_business_id;
$$;

create or replace function public.mask_phone(p text) returns text
language sql immutable as $$
  select case when p is null then null else '••• ••• ' || right(p, 4) end;
$$;

-- ---------------------------------------------------------------------
-- Registro de cliente (con consentimiento obligatorio)
-- ---------------------------------------------------------------------
create or replace function public.register_customer(
  p_slug text, p_name text, p_phone text, p_birthday date,
  p_privacy_accepted boolean, p_privacy_version text, p_terms_version text,
  p_marketing boolean, p_ip_hash text, p_user_agent text
) returns jsonb language plpgsql set search_path = public, extensions as $$
declare
  b public.businesses;
  pr public.programs;
  v_name text := btrim(coalesce(p_name, ''));
  v_token text;
  v_customer uuid;
  v_card uuid;
  v_today date;
begin
  if not coalesce(p_privacy_accepted, false) then
    return jsonb_build_object('ok', false, 'error', 'consent_required');
  end if;
  if p_privacy_version is null or p_terms_version is null then
    return jsonb_build_object('ok', false, 'error', 'consent_required');
  end if;
  if char_length(v_name) not between 2 and 60 then
    return jsonb_build_object('ok', false, 'error', 'invalid_name');
  end if;
  if p_phone is null or p_phone !~ '^\+52[0-9]{10}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_phone');
  end if;
  if p_birthday is not null and (p_birthday > current_date or p_birthday < date '1900-01-01') then
    return jsonb_build_object('ok', false, 'error', 'invalid_birthday');
  end if;

  select * into b from public.businesses where slug = p_slug;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if b.status = 'suspended' then
    return jsonb_build_object('ok', false, 'error', 'suspended');
  end if;

  if p_ip_hash is not null and not public.hit_rate_limit('reg:ip:' || p_ip_hash, 10, 3600) then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;
  if not public.hit_rate_limit('reg:biz:' || b.id, 300, 3600) then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;

  select * into pr from public.programs where business_id = b.id;
  v_today := (now() at time zone b.timezone)::date;
  if pr.valid_until is not null and v_today > pr.valid_until then
    return jsonb_build_object('ok', false, 'error', 'program_ended');
  end if;

  if exists (select 1 from public.customers where business_id = b.id and phone = p_phone) then
    return jsonb_build_object('ok', false, 'error', 'exists');
  end if;

  v_token := public.random_token(32);
  begin
    insert into public.customers (business_id, name, phone, birthday, marketing_opt_in,
                                  access_token_hash, qr_code)
    values (b.id, v_name, p_phone, p_birthday, coalesce(p_marketing, false),
            public.hash_token(v_token), 'S1' || encode(extensions.gen_random_bytes(18), 'hex'))
    returning id into v_customer;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'exists');
  end;

  insert into public.cards (business_id, customer_id, cycle) values (b.id, v_customer, 1)
  returning id into v_card;

  if pr.signup_gift > 0 then
    insert into public.stamp_events (business_id, customer_id, card_id, kind, amount)
    values (b.id, v_customer, v_card, 'signup_gift', pr.signup_gift);
  end if;

  insert into public.consents (business_id, customer_id, kind, granted, document_version, ip_hash, user_agent)
  values
    (b.id, v_customer, 'privacy', true, p_privacy_version, p_ip_hash, left(p_user_agent, 300)),
    (b.id, v_customer, 'terms', true, p_terms_version, p_ip_hash, left(p_user_agent, 300)),
    (b.id, v_customer, 'marketing', coalesce(p_marketing, false), p_privacy_version, p_ip_hash, left(p_user_agent, 300));

  return jsonb_build_object('ok', true, 'token', v_token, 'customer_id', v_customer);
end $$;

-- ---------------------------------------------------------------------
-- Vista de la tarjeta para el cliente (por token privado)
-- ---------------------------------------------------------------------
create or replace function public.customer_by_token(p_token text) returns public.customers
language sql stable set search_path = public as $$
  select * from public.customers
  where access_token_hash = public.hash_token(p_token) and deleted_at is null;
$$;

create or replace function public.get_customer_card(p_token text) returns jsonb
language plpgsql stable set search_path = public as $$
declare
  c public.customers;
begin
  if p_token is null or char_length(p_token) < 20 then
    return null;
  end if;
  select * into c from public.customer_by_token(p_token);
  if c.id is null then
    return null;
  end if;
  return jsonb_build_object(
    'customer', jsonb_build_object('name', c.name, 'qr_code', c.qr_code,
                                   'marketing_opt_in', c.marketing_opt_in,
                                   'phone_masked', public.mask_phone(c.phone),
                                   'created_at', c.created_at),
    'business', public.public_business(c.business_id),
    'state', public.card_state(c.id),
    'history', coalesce((
      select jsonb_agg(h order by h.at desc) from (
        select e.created_at as at, e.kind::text as kind, e.amount, e.is_double
        from public.stamp_events e
        where e.customer_id = c.id and e.undone_at is null
        union all
        select r.created_at, 'redeem_' || r.kind::text, 0, false
        from public.redemptions r where r.customer_id = c.id
        order by 1 desc limit 15
      ) h), '[]'::jsonb)
  );
end $$;

create or replace function public.customer_set_marketing(p_token text, p_opt_in boolean,
  p_version text, p_ip_hash text, p_user_agent text)
returns jsonb language plpgsql set search_path = public as $$
declare c public.customers;
begin
  select * into c from public.customer_by_token(p_token);
  if c.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  update public.customers set marketing_opt_in = coalesce(p_opt_in, false) where id = c.id;
  insert into public.consents (business_id, customer_id, kind, granted, document_version, ip_hash, user_agent)
  values (c.business_id, c.id, 'marketing', coalesce(p_opt_in, false), p_version, p_ip_hash, left(p_user_agent, 300));
  return jsonb_build_object('ok', true);
end $$;

-- Baja: se borran los datos personales; quedan solo registros anónimos de visitas.
create or replace function public.customer_delete(p_token text, p_version text, p_ip_hash text, p_user_agent text)
returns jsonb language plpgsql set search_path = public, extensions as $$
declare c public.customers;
begin
  select * into c from public.customer_by_token(p_token);
  if c.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  insert into public.consents (business_id, customer_id, kind, granted, document_version, ip_hash, user_agent)
  values (c.business_id, c.id, 'marketing', false, p_version, p_ip_hash, left(p_user_agent, 300));
  update public.customers set
    name = 'Cliente dado de baja',
    phone = null,
    birthday = null,
    marketing_opt_in = false,
    deleted_at = now(),
    access_token_hash = public.hash_token(public.random_token(32)),
    qr_code = 'X' || encode(extensions.gen_random_bytes(18), 'hex')
  where id = c.id;
  perform public.audit(c.business_id, 'customer', c.id::text, 'customer.deleted');
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------
-- Empleados: PIN y sesiones
-- ---------------------------------------------------------------------
create or replace function public.staff_login(p_slug text, p_pin text, p_ip_hash text)
returns jsonb language plpgsql set search_path = public, extensions as $$
declare
  b public.businesses;
  s public.staff;
  v_token text;
begin
  if not public.hit_rate_limit('pin:ip:' || coalesce(p_ip_hash, '?') || ':' || coalesce(p_slug, ''), 6, 900) then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;
  if not public.hit_rate_limit('pin:biz:' || coalesce(p_slug, ''), 25, 900) then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;
  if p_pin is null or p_pin !~ '^[0-9]{4,6}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  select * into b from public.businesses where slug = p_slug;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  select * into s from public.staff
  where business_id = b.id and active and pin_hash = extensions.crypt(p_pin, pin_hash)
  limit 1;
  if not found then
    perform public.audit(b.id, 'system', null, 'staff.login_failed');
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  v_token := public.random_token(32);
  insert into public.staff_sessions (staff_id, business_id, token_hash, expires_at)
  values (s.id, b.id, public.hash_token(v_token), now() + interval '12 hours');
  update public.staff set last_login_at = now() where id = s.id;
  perform public.audit(b.id, 'staff', s.id::text, 'staff.login');

  return jsonb_build_object('ok', true, 'token', v_token, 'staff_name', s.name,
                            'business_id', b.id, 'slug', b.slug);
end $$;

create or replace function public.staff_logout(p_session text) returns void
language sql set search_path = public as $$
  update public.staff_sessions set revoked_at = now()
  where token_hash = public.hash_token(p_session) and revoked_at is null;
$$;

-- Resuelve la sesión del empleado. Sin sesión válida no hay operación posible.
create or replace function public.staff_session(p_session text)
returns table (staff_id uuid, staff_name text, business_id uuid)
language sql stable set search_path = public as $$
  select st.id, st.name, ss.business_id
  from public.staff_sessions ss
  join public.staff st on st.id = ss.staff_id and st.active
  where ss.token_hash = public.hash_token(coalesce(p_session, ''))
    and ss.revoked_at is null
    and ss.expires_at > now()
    and st.business_id = ss.business_id;
$$;

-- Estado de un cliente visto desde el mostrador
create or replace function public.staff_customer_view(p_business_id uuid, p_customer_id uuid)
returns jsonb language plpgsql stable set search_path = public as $$
declare
  b public.businesses;
  pr public.programs;
  c public.customers;
  st jsonb;
  v_stamps int;
  v_last timestamptz;
  v_reason text := null;
  v_wait int := 0;
  v_mult int;
  v_today date;
begin
  select * into b from public.businesses where id = p_business_id;
  select * into pr from public.programs where business_id = p_business_id;
  select * into c from public.customers
  where id = p_customer_id and business_id = p_business_id and deleted_at is null;
  if c.id is null then
    return null;
  end if;

  st := public.card_state(c.id);
  v_stamps := (st ->> 'stamps')::int;
  v_last := (st ->> 'last_visit_at')::timestamptz;
  v_today := (now() at time zone b.timezone)::date;
  v_mult := public.stamp_multiplier(pr.double_rules, now(), b.timezone);

  if b.status = 'suspended' then
    v_reason := 'suspended';
  elsif pr.valid_from is not null and v_today < pr.valid_from then
    v_reason := 'not_started';
  elsif pr.valid_until is not null and v_today > pr.valid_until then
    v_reason := 'program_ended';
  elsif v_stamps >= pr.stamps_required then
    v_reason := 'card_full';
  elsif v_last is not null and pr.cooldown_minutes > 0
        and v_last > now() - make_interval(mins => pr.cooldown_minutes) then
    v_reason := 'cooldown';
    v_wait := ceil(extract(epoch from (v_last + make_interval(mins => pr.cooldown_minutes) - now())) / 60.0)::int;
  end if;

  return jsonb_build_object(
    'customer_id', c.id,
    'name', c.name,
    'phone_masked', public.mask_phone(c.phone),
    'state', st,
    'stamps_required', pr.stamps_required,
    'reward_final', pr.reward_final,
    'reward_mid', pr.reward_mid,
    'reward_mid_at', pr.reward_mid_at,
    'can_stamp', v_reason is null,
    'blocked_reason', v_reason,
    'wait_minutes', v_wait,
    'multiplier', v_mult,
    'can_redeem_final', v_stamps >= pr.stamps_required,
    'can_redeem_mid', pr.reward_mid_at is not null and v_stamps >= pr.reward_mid_at
                      and not (st ->> 'mid_redeemed')::boolean
  );
end $$;

create or replace function public.staff_lookup(p_session text, p_qr_code text, p_customer_id uuid)
returns jsonb language plpgsql stable set search_path = public as $$
declare
  s record;
  v_id uuid;
begin
  select * into s from public.staff_session(p_session);
  if s.staff_id is null then return jsonb_build_object('ok', false, 'error', 'unauthorized'); end if;

  if p_qr_code is not null then
    select id into v_id from public.customers
    where qr_code = p_qr_code and business_id = s.business_id and deleted_at is null;
  else
    select id into v_id from public.customers
    where id = p_customer_id and business_id = s.business_id and deleted_at is null;
  end if;
  if v_id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  return jsonb_build_object('ok', true, 'customer', public.staff_customer_view(s.business_id, v_id));
end $$;

create or replace function public.staff_search_phone(p_session text, p_digits text)
returns jsonb language plpgsql stable set search_path = public as $$
declare s record; v_digits text := regexp_replace(coalesce(p_digits, ''), '[^0-9]', '', 'g');
begin
  select * into s from public.staff_session(p_session);
  if s.staff_id is null then return jsonb_build_object('ok', false, 'error', 'unauthorized'); end if;
  if char_length(v_digits) < 4 then return jsonb_build_object('ok', false, 'error', 'too_short'); end if;
  return jsonb_build_object('ok', true, 'results', coalesce((
    select jsonb_agg(jsonb_build_object('customer_id', c.id, 'name', c.name,
                                        'phone_masked', public.mask_phone(c.phone)))
    from (select * from public.customers
          where business_id = s.business_id and deleted_at is null
            and phone like '%' || v_digits
          order by last_visit_at desc nulls last limit 8) c
  ), '[]'::jsonb));
end $$;

-- ---------------------------------------------------------------------
-- SELLAR (antifraude en servidor)
-- ---------------------------------------------------------------------
create or replace function public.stamp_customer(p_session text, p_customer_id uuid)
returns jsonb language plpgsql set search_path = public as $$
declare
  s record;
  b public.businesses;
  pr public.programs;
  c public.customers;
  k public.cards;
  v_stamps int;
  v_last timestamptz;
  v_mult int;
  v_amount int;
  v_today date;
  v_event uuid;
begin
  select * into s from public.staff_session(p_session);
  if s.staff_id is null then return jsonb_build_object('ok', false, 'error', 'unauthorized'); end if;

  select * into b from public.businesses where id = s.business_id;
  if b.status = 'suspended' then return jsonb_build_object('ok', false, 'error', 'suspended'); end if;
  select * into pr from public.programs where business_id = b.id;

  -- Bloqueo de fila: dos sellos simultáneos al mismo cliente se serializan
  select * into c from public.customers
  where id = p_customer_id and business_id = b.id and deleted_at is null
  for update;
  if c.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;

  v_today := (now() at time zone b.timezone)::date;
  if pr.valid_from is not null and v_today < pr.valid_from then
    return jsonb_build_object('ok', false, 'error', 'not_started');
  end if;
  if pr.valid_until is not null and v_today > pr.valid_until then
    return jsonb_build_object('ok', false, 'error', 'program_ended');
  end if;

  select * into k from public.cards where customer_id = c.id and status = 'active' for update;
  select coalesce(sum(amount), 0) into v_stamps from public.stamp_events
  where card_id = k.id and undone_at is null;
  if v_stamps >= pr.stamps_required then
    return jsonb_build_object('ok', false, 'error', 'card_full');
  end if;

  select max(created_at) into v_last from public.stamp_events
  where customer_id = c.id and kind = 'visit' and undone_at is null;
  if v_last is not null and pr.cooldown_minutes > 0
     and v_last > now() - make_interval(mins => pr.cooldown_minutes) then
    return jsonb_build_object('ok', false, 'error', 'cooldown',
      'wait_minutes', ceil(extract(epoch from (v_last + make_interval(mins => pr.cooldown_minutes) - now())) / 60.0)::int);
  end if;

  v_mult := public.stamp_multiplier(pr.double_rules, now(), b.timezone);
  v_amount := least(v_mult, pr.stamps_required - v_stamps);

  insert into public.stamp_events (business_id, customer_id, card_id, kind, amount, is_double, staff_id, staff_name)
  values (b.id, c.id, k.id, 'visit', v_amount, v_mult > 1, s.staff_id, s.staff_name)
  returning id into v_event;
  update public.customers set last_visit_at = now() where id = c.id;

  return jsonb_build_object('ok', true, 'event_id', v_event, 'amount', v_amount,
                            'customer', public.staff_customer_view(b.id, c.id));
end $$;

-- Deshacer un sello (máximo 2 minutos después)
create or replace function public.undo_stamp(p_session text, p_event_id uuid)
returns jsonb language plpgsql set search_path = public as $$
declare
  s record;
  e public.stamp_events;
  k public.cards;
begin
  select * into s from public.staff_session(p_session);
  if s.staff_id is null then return jsonb_build_object('ok', false, 'error', 'unauthorized'); end if;

  select * into e from public.stamp_events
  where id = p_event_id and business_id = s.business_id and kind = 'visit' and undone_at is null
  for update;
  if e.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if e.created_at < now() - interval '2 minutes' then
    return jsonb_build_object('ok', false, 'error', 'undo_expired');
  end if;
  select * into k from public.cards where id = e.card_id;
  if k.status <> 'active' then
    return jsonb_build_object('ok', false, 'error', 'card_redeemed');
  end if;

  update public.stamp_events set undone_at = now(), undone_by = s.staff_id where id = e.id;
  update public.customers set last_visit_at = (
    select max(created_at) from public.stamp_events
    where customer_id = e.customer_id and kind = 'visit' and undone_at is null)
  where id = e.customer_id;
  perform public.audit(s.business_id, 'staff', s.staff_id::text, 'stamp.undone',
                       jsonb_build_object('event_id', e.id));
  return jsonb_build_object('ok', true, 'customer', public.staff_customer_view(s.business_id, e.customer_id));
end $$;

-- ---------------------------------------------------------------------
-- CANJE (el empleado confirma; el premio final reinicia la tarjeta)
-- ---------------------------------------------------------------------
create or replace function public.redeem_reward(p_session text, p_customer_id uuid, p_kind text)
returns jsonb language plpgsql set search_path = public as $$
declare
  s record;
  pr public.programs;
  c public.customers;
  k public.cards;
  v_stamps int;
begin
  select * into s from public.staff_session(p_session);
  if s.staff_id is null then return jsonb_build_object('ok', false, 'error', 'unauthorized'); end if;
  if p_kind not in ('final', 'mid') then return jsonb_build_object('ok', false, 'error', 'invalid'); end if;

  select * into pr from public.programs where business_id = s.business_id;
  select * into c from public.customers
  where id = p_customer_id and business_id = s.business_id and deleted_at is null
  for update;
  if c.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;

  select * into k from public.cards where customer_id = c.id and status = 'active' for update;
  select coalesce(sum(amount), 0) into v_stamps from public.stamp_events
  where card_id = k.id and undone_at is null;

  if p_kind = 'final' then
    if v_stamps < pr.stamps_required then
      return jsonb_build_object('ok', false, 'error', 'not_enough');
    end if;
    update public.cards set status = 'redeemed', redeemed_at = now() where id = k.id;
    insert into public.cards (business_id, customer_id, cycle) values (s.business_id, c.id, k.cycle + 1);
    insert into public.redemptions (business_id, customer_id, card_id, kind, reward, staff_id, staff_name)
    values (s.business_id, c.id, k.id, 'final', pr.reward_final, s.staff_id, s.staff_name);
  else
    if pr.reward_mid_at is null or v_stamps < pr.reward_mid_at then
      return jsonb_build_object('ok', false, 'error', 'not_enough');
    end if;
    if k.mid_redeemed_at is not null then
      return jsonb_build_object('ok', false, 'error', 'already_redeemed');
    end if;
    update public.cards set mid_redeemed_at = now() where id = k.id;
    insert into public.redemptions (business_id, customer_id, card_id, kind, reward, staff_id, staff_name)
    values (s.business_id, c.id, k.id, 'mid', pr.reward_mid, s.staff_id, s.staff_name);
  end if;

  return jsonb_build_object('ok', true, 'customer', public.staff_customer_view(s.business_id, c.id));
end $$;

-- ---------------------------------------------------------------------
-- Recuperación de tarjeta (código de un solo uso generado en mostrador)
-- ---------------------------------------------------------------------
create or replace function public.create_recovery_code(p_session text, p_customer_id uuid)
returns jsonb language plpgsql set search_path = public as $$
declare s record; v_code text; v_ok boolean;
begin
  select * into s from public.staff_session(p_session);
  if s.staff_id is null then return jsonb_build_object('ok', false, 'error', 'unauthorized'); end if;
  select exists (select 1 from public.customers where id = p_customer_id
                 and business_id = s.business_id and deleted_at is null) into v_ok;
  if not v_ok then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  v_code := public.random_token(24);
  insert into public.recovery_codes (business_id, customer_id, code_hash, staff_id, expires_at)
  values (s.business_id, p_customer_id, public.hash_token(v_code), s.staff_id, now() + interval '10 minutes');
  perform public.audit(s.business_id, 'staff', s.staff_id::text, 'card.recovery_code',
                       jsonb_build_object('customer_id', p_customer_id));
  return jsonb_build_object('ok', true, 'code', v_code);
end $$;

create or replace function public.claim_recovery_code(p_code text, p_ip_hash text)
returns jsonb language plpgsql set search_path = public as $$
declare r public.recovery_codes; v_token text; v_slug text;
begin
  if not public.hit_rate_limit('recover:ip:' || coalesce(p_ip_hash, '?'), 20, 3600) then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;
  select * into r from public.recovery_codes
  where code_hash = public.hash_token(coalesce(p_code, '')) for update;
  if r.id is null or r.used_at is not null or r.expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  v_token := public.random_token(32);
  update public.recovery_codes set used_at = now() where id = r.id;
  -- El enlace anterior deja de funcionar
  update public.customers set access_token_hash = public.hash_token(v_token)
  where id = r.customer_id and deleted_at is null;
  if not found then return jsonb_build_object('ok', false, 'error', 'invalid'); end if;
  select slug into v_slug from public.businesses where id = r.business_id;
  perform public.audit(r.business_id, 'customer', r.customer_id::text, 'card.recovered');
  return jsonb_build_object('ok', true, 'token', v_token, 'slug', v_slug);
end $$;

-- ---------------------------------------------------------------------
-- Funciones del dueño (usuario autenticado; validan acceso al negocio)
-- ---------------------------------------------------------------------
create or replace function public.owner_save_staff(p_business_id uuid, p_staff_id uuid,
  p_name text, p_pin text, p_active boolean)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid; v_taken boolean;
begin
  if not public.can_access_business(p_business_id) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 2 and 60 then
    return jsonb_build_object('ok', false, 'error', 'invalid_name');
  end if;
  if p_pin is not null then
    if p_pin !~ '^[0-9]{4,6}$' then
      return jsonb_build_object('ok', false, 'error', 'invalid_pin');
    end if;
    if p_pin ~ '^(\d)\1+$' or p_pin in ('1234', '12345', '123456', '4321', '654321', '0123') then
      return jsonb_build_object('ok', false, 'error', 'weak_pin');
    end if;
    select exists (select 1 from public.staff where business_id = p_business_id
                   and id is distinct from p_staff_id
                   and pin_hash = extensions.crypt(p_pin, pin_hash)) into v_taken;
    if v_taken then return jsonb_build_object('ok', false, 'error', 'pin_taken'); end if;
  end if;

  if p_staff_id is null then
    if p_pin is null then return jsonb_build_object('ok', false, 'error', 'invalid_pin'); end if;
    insert into public.staff (business_id, name, pin_hash, active)
    values (p_business_id, btrim(p_name), extensions.crypt(p_pin, extensions.gen_salt('bf', 8)), coalesce(p_active, true))
    returning id into v_id;
  else
    update public.staff set
      name = btrim(p_name),
      active = coalesce(p_active, active),
      pin_hash = case when p_pin is null then pin_hash
                      else extensions.crypt(p_pin, extensions.gen_salt('bf', 8)) end
    where id = p_staff_id and business_id = p_business_id
    returning id into v_id;
    if v_id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
    -- Cambiar PIN o desactivar cierra sus sesiones abiertas
    if p_pin is not null or p_active = false then
      update public.staff_sessions set revoked_at = now() where staff_id = v_id and revoked_at is null;
    end if;
  end if;
  perform public.audit(p_business_id, 'owner', auth.uid()::text, 'staff.saved', jsonb_build_object('staff_id', v_id));
  return jsonb_build_object('ok', true, 'staff_id', v_id);
end $$;

create or replace function public.admin_set_business_status(p_business_id uuid, p_status public.business_status)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  update public.businesses set status = p_status where id = p_business_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  perform public.audit(p_business_id, 'admin', auth.uid()::text, 'business.status', jsonb_build_object('status', p_status));
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------
-- Reportes (SECURITY INVOKER: la RLS filtra; otro negocio devuelve ceros)
-- ---------------------------------------------------------------------
create or replace view public.customer_summary with (security_invoker = true) as
select c.id, c.business_id, c.name, c.phone, c.birthday, c.marketing_opt_in, c.created_at,
       (select max(e.created_at) from public.stamp_events e
        where e.customer_id = c.id and e.kind = 'visit' and e.undone_at is null) as last_visit_at,
       c.deleted_at,
       (select count(*) from public.stamp_events e
        where e.customer_id = c.id and e.kind = 'visit' and e.undone_at is null) as visits,
       (select coalesce(sum(e.amount), 0) from public.stamp_events e
        join public.cards k on k.id = e.card_id
        where k.customer_id = c.id and k.status = 'active' and e.undone_at is null) as current_stamps,
       (select count(*) from public.redemptions r
        where r.customer_id = c.id and r.kind = 'final') as rewards_redeemed
from public.customers c;

-- Visitas con su número de orden por cliente (la 1.ª no es "regreso")
create or replace view public.visit_ranks with (security_invoker = true) as
select e.id, e.business_id, e.customer_id, e.created_at,
       row_number() over (partition by e.customer_id order by e.created_at) as visit_number
from public.stamp_events e
where e.kind = 'visit' and e.undone_at is null;

create or replace function public.business_report(p_business_id uuid, p_from date, p_to date)
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare
  b public.businesses;
  v_from timestamptz;
  v_to timestamptz;
  v_returning_visits int;
begin
  select * into b from public.businesses where id = p_business_id;
  if b.id is null then
    return jsonb_build_object('total_customers', 0, 'new_customers', 0, 'visits', 0,
      'returning_visits', 0, 'returning_customers', 0, 'redemptions', 0, 'gift_stamps', 0,
      'avg_ticket_mxn', 0, 'estimated_sales_mxn', 0);
  end if;
  v_from := p_from::timestamp at time zone b.timezone;
  v_to := (p_to + 1)::timestamp at time zone b.timezone;

  select count(*) into v_returning_visits from public.visit_ranks
  where business_id = b.id and visit_number > 1 and created_at >= v_from and created_at < v_to;

  return jsonb_build_object(
    'total_customers', (select count(*) from public.customers where business_id = b.id and deleted_at is null),
    'new_customers', (select count(*) from public.customers where business_id = b.id
                      and created_at >= v_from and created_at < v_to),
    'visits', (select count(*) from public.stamp_events where business_id = b.id and kind = 'visit'
               and undone_at is null and created_at >= v_from and created_at < v_to),
    'returning_visits', v_returning_visits,
    'returning_customers', (select count(distinct customer_id) from public.visit_ranks
                            where business_id = b.id and visit_number > 1
                              and created_at >= v_from and created_at < v_to),
    'redemptions', (select count(*) from public.redemptions where business_id = b.id
                    and created_at >= v_from and created_at < v_to),
    'gift_stamps', (select coalesce(sum(amount), 0) from public.stamp_events where business_id = b.id
                    and kind = 'signup_gift' and undone_at is null
                    and created_at >= v_from and created_at < v_to),
    'avg_ticket_mxn', b.avg_ticket_mxn,
    'estimated_sales_mxn', round(v_returning_visits * b.avg_ticket_mxn, 2)
  );
end $$;

create or replace function public.at_risk_customers(p_business_id uuid)
returns table (id uuid, name text, phone text, marketing_opt_in boolean, visits bigint, last_visit_at timestamptz,
               current_stamps bigint)
language sql stable security invoker set search_path = public as $$
  select s.id, s.name, s.phone, s.marketing_opt_in, s.visits, s.last_visit_at, s.current_stamps
  from public.customer_summary s
  join public.businesses b on b.id = s.business_id
  where s.business_id = p_business_id
    and s.deleted_at is null
    and s.visits >= b.frequent_min_visits
    and s.last_visit_at < now() - make_interval(days => b.at_risk_days)
  order by s.last_visit_at asc;
$$;

-- Resumen de la plataforma para el superadmin
create or replace function public.admin_overview()
returns table (id uuid, slug text, name text, status public.business_status, created_at timestamptz,
               trial_ends_at date, customers bigint, visits_30d bigint, owner_emails text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden';
  end if;
  return query
  select b.id, b.slug, b.name, b.status, b.created_at, b.trial_ends_at,
         (select count(*) from public.customers c where c.business_id = b.id and c.deleted_at is null),
         (select count(*) from public.stamp_events e where e.business_id = b.id and e.kind = 'visit'
            and e.undone_at is null and e.created_at > now() - interval '30 days'),
         (select string_agg(u.email::text, ', ') from public.business_owners o
            join auth.users u on u.id = o.user_id where o.business_id = b.id)
  from public.businesses b
  order by b.created_at desc;
end $$;

-- Hash de PIN (bcrypt) para scripts de servidor como los datos de demo
create or replace function public.hash_pin(p_pin text) returns text
language plpgsql volatile set search_path = public, extensions as $$
begin
  if p_pin !~ '^[0-9]{4,6}$' then raise exception 'PIN inválido'; end if;
  return extensions.crypt(p_pin, extensions.gen_salt('bf', 8));
end $$;

-- ---------------------------------------------------------------------
-- Permisos de ejecución
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.can_access_business(uuid) to authenticated;
grant execute on function public.owner_save_staff(uuid, uuid, text, text, boolean) to authenticated;
grant execute on function public.admin_set_business_status(uuid, public.business_status) to authenticated;
grant execute on function public.business_report(uuid, date, date) to authenticated;
grant execute on function public.at_risk_customers(uuid) to authenticated;
grant execute on function public.admin_overview() to authenticated;
grant execute on function public.mask_phone(text) to authenticated;
grant select on public.customer_summary, public.visit_ranks to authenticated;

grant execute on all functions in schema public to service_role;
grant select on public.customer_summary, public.visit_ranks to service_role;

-- ===== 20261108000004_legal_y_storage.sql =====
-- =====================================================================
-- Sellos · Documentos legales iniciales (BORRADOR) y bucket de logos
-- IMPORTANTE: estos textos son un borrador y deben ser revisados por un
-- abogado antes de usarse con clientes reales.
-- {{negocio}} se reemplaza por el nombre de cada negocio al mostrarse.
-- =====================================================================

insert into public.legal_documents (kind, version, title, body, is_draft) values
('privacy', '2026-11-08.1', 'Aviso de privacidad', $txt$
## Responsable
{{negocio}} (en adelante, "el Negocio") es responsable del tratamiento de tus datos personales recabados a través de su tarjeta de lealtad digital. La plataforma Sellos actúa como encargada y trata los datos únicamente por cuenta del Negocio.

## Datos que recabamos
- Nombre.
- Número de WhatsApp (teléfono celular).
- Fecha de cumpleaños (opcional).
- Registro de visitas, sellos y premios canjeados, con fecha y hora.

No recabamos datos personales sensibles.

## Finalidades necesarias
- Crear y administrar tu tarjeta de lealtad.
- Registrar tus visitas, sellos y premios.
- Evitar registros duplicados y usos indebidos de la promoción.
- Permitirte recuperar tu tarjeta.

## Finalidades opcionales
Solo si marcas la casilla correspondiente:
- Enviarte promociones, avisos de premios y felicitaciones de cumpleaños por WhatsApp.

Puedes retirar este consentimiento en cualquier momento desde tu tarjeta, sin que afecte tus sellos.

## Transferencias
No vendemos ni transferimos tus datos a terceros, salvo a proveedores tecnológicos que nos ayudan a operar el servicio (alojamiento y base de datos) y que están obligados a proteger tu información, o cuando lo exija una autoridad competente.

## Derechos ARCO y revocación
Puedes acceder, rectificar, cancelar u oponerte al tratamiento de tus datos, así como revocar tu consentimiento. Desde tu tarjeta puedes dejar de recibir promociones o dar de baja tu cuenta. Para otras solicitudes, acude al mostrador del Negocio o utiliza el medio de contacto que el Negocio indique.

## Conservación
Conservamos tus datos mientras tengas una tarjeta activa. Si das de baja tu cuenta, eliminamos tu nombre, teléfono y cumpleaños; solo conservamos registros anónimos de visitas con fines estadísticos.

## Cambios a este aviso
Cualquier cambio se publicará en esta misma página con una nueva versión y fecha.
$txt$, true),
('terms', '2026-11-08.1', 'Términos y condiciones', $txt$
## La tarjeta
La tarjeta de lealtad de {{negocio}} es gratuita, personal e intransferible. Funciona con un enlace privado: no lo compartas.

## Sellos
- Recibes sellos al hacer una compra, cuando el personal escanea tu código en el mostrador.
- Solo el personal del Negocio puede agregar sellos.
- Hay un tiempo mínimo entre sellos para el mismo cliente, indicado en tu tarjeta.
- Los sellos de regalo por registrarte no tienen valor en efectivo.

## Premios
- Al completar tu tarjeta puedes canjear el premio indicado. Después del canje la tarjeta vuelve a empezar.
- Los premios no son canjeables por dinero ni acumulables con otras promociones, salvo que el Negocio indique lo contrario.
- Aplican las condiciones, restricciones y vigencia que se muestran en la tarjeta.

## Uso indebido
El Negocio puede anular sellos o tarjetas obtenidos de forma fraudulenta.

## Suspensión del programa
El Negocio puede modificar o terminar la promoción. Si eso pasa, tus datos se conservan conforme al aviso de privacidad.

## Contacto
Para cualquier aclaración acude al mostrador de {{negocio}}.
$txt$, true);

-- Bucket público de logos (solo el servidor sube archivos, ya procesados a PNG)
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('logos', 'logos', true, 1048576, array['image/png'])
    on conflict (id) do nothing;
  end if;
end $$;
