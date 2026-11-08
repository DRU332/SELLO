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
