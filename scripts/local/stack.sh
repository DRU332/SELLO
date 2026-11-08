#!/usr/bin/env bash
# SOLO DESARROLLO LOCAL (avanzado). Para uso normal sigue el README y usa
# un proyecto de Supabase en la nube; no necesitas este script.
#
# Levanta: Postgres local + Auth (binario gotrue) + PostgREST + Storage (Docker)
# y un gateway en http://127.0.0.1:54321 con las rutas de Supabase.
# Variables: GOTRUE_BIN, GOTRUE_MIGRATIONS, DB (por defecto sellos_dev)
set -euo pipefail
cd "$(dirname "$0")/../.."

DB="${DB:-sellos_dev}"
STATE=".local-stack"
mkdir -p "$STATE/storage"
if [ ! -f "$STATE/jwt_secret" ]; then
  openssl rand -hex 32 > "$STATE/jwt_secret"
fi
JWT_SECRET="$(cat "$STATE/jwt_secret")"
ANON_KEY="$(node scripts/local/jwt.mjs "$JWT_SECRET" anon)"
SERVICE_KEY="$(node scripts/local/jwt.mjs "$JWT_SECRET" service_role)"
export PGPASSWORD=postgres
PSQL="psql -h 127.0.0.1 -U postgres -v ON_ERROR_STOP=1 -q"

if [ "${RESET:-0}" = "1" ]; then
  docker rm -f sellos-rest sellos-storage >/dev/null 2>&1 || true
  pkill -x gotrue >/dev/null 2>&1 || true
  $PSQL -c "drop database if exists $DB with (force)"
  rm -rf "$STATE/storage"/*
fi

if ! $PSQL -tAc "select 1 from pg_database where datname='$DB'" | grep -q 1; then
  $PSQL -c "create database $DB"
  $PSQL -f scripts/local/roles.sql
  $PSQL -d "$DB" -c "create schema if not exists auth authorization supabase_auth_admin;
                     create schema if not exists extensions;
                     create extension if not exists pgcrypto with schema extensions;
                     create extension if not exists \"uuid-ossp\" with schema extensions;
                     grant usage on schema extensions to anon, authenticated, service_role, supabase_auth_admin;
                     grant usage on schema auth to anon, authenticated, service_role;
                     alter role authenticator set search_path = public, extensions;"
  FRESH=1
fi

# --- Auth (GoTrue) ---
if ! curl -fs http://127.0.0.1:9999/health >/dev/null 2>&1; then
  GOTRUE_DB_DRIVER=postgres \
  DATABASE_URL="postgres://supabase_auth_admin:postgres@127.0.0.1:5432/$DB?search_path=auth" \
  GOTRUE_DB_MIGRATIONS_PATH="${GOTRUE_MIGRATIONS:?ruta a migrations de gotrue}" \
  GOTRUE_JWT_SECRET="$JWT_SECRET" GOTRUE_JWT_EXP=3600 GOTRUE_JWT_AUD=authenticated \
  GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated GOTRUE_JWT_ADMIN_ROLES=service_role \
  API_EXTERNAL_URL=http://127.0.0.1:54321/auth/v1 GOTRUE_SITE_URL=http://localhost:3000 \
  GOTRUE_API_HOST=127.0.0.1 PORT=9999 GOTRUE_DISABLE_SIGNUP=true GOTRUE_MAILER_AUTOCONFIRM=true \
  GOTRUE_EXTERNAL_EMAIL_ENABLED=true GOTRUE_LOG_LEVEL=warn \
  nohup "${GOTRUE_BIN:?ruta al binario gotrue}" > "$STATE/gotrue.log" 2>&1 &
  for _ in $(seq 1 60); do curl -fs http://127.0.0.1:9999/health >/dev/null 2>&1 && break; sleep 1; done
fi

# --- Migraciones de Sellos ---
if [ "${FRESH:-0}" = "1" ]; then
  for f in supabase/migrations/*.sql; do $PSQL -d "$DB" -f "$f"; done
  $PSQL -d "$DB" -c "notify pgrst, 'reload schema'"
fi

# --- PostgREST ---
if ! docker ps --format '{{.Names}}' | grep -q '^sellos-rest$'; then
  docker rm -f sellos-rest >/dev/null 2>&1 || true
  docker run -d --name sellos-rest --network host \
    -e PGRST_DB_URI="postgres://authenticator:postgres@127.0.0.1:5432/$DB" \
    -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=anon \
    -e PGRST_JWT_SECRET="$JWT_SECRET" -e PGRST_SERVER_PORT=3001 \
    -e PGRST_DB_EXTRA_SEARCH_PATH=public,extensions \
    postgrest/postgrest:v16.5 >/dev/null
fi

# --- Storage ---
if ! docker ps --format '{{.Names}}' | grep -q '^sellos-storage$'; then
  docker rm -f sellos-storage >/dev/null 2>&1 || true
  docker run -d --name sellos-storage --network host \
    -v "$PWD/$STATE/storage:/var/lib/storage" \
    -e ANON_KEY="$ANON_KEY" -e SERVICE_KEY="$SERVICE_KEY" \
    -e AUTH_JWT_SECRET="$JWT_SECRET" -e PGRST_JWT_SECRET="$JWT_SECRET" \
    -e POSTGREST_URL=http://127.0.0.1:3001 \
    -e DATABASE_URL="postgres://supabase_storage_admin:postgres@127.0.0.1:5432/$DB" \
    -e FILE_SIZE_LIMIT=52428800 -e STORAGE_BACKEND=file \
    -e FILE_STORAGE_BACKEND_PATH=/var/lib/storage -e TENANT_ID=stub -e REGION=local \
    -e GLOBAL_S3_BUCKET=stub -e SERVER_PORT=5000 -e PORT=5000 -e IS_MULTITENANT=false \
    -e STORAGE_PUBLIC_URL=http://127.0.0.1:54321/storage/v1 \
    supabase/storage-api:v1.88.0 >/dev/null
fi

# --- Gateway ---
if ! curl -s http://127.0.0.1:54321/ >/dev/null 2>&1; then
  nohup node scripts/local/gateway.mjs > "$STATE/gateway.log" 2>&1 &
fi
for _ in $(seq 1 60); do curl -fs http://127.0.0.1:5000/status >/dev/null 2>&1 && break; sleep 1; done
# Permisos de Storage que Supabase trae de fábrica
$PSQL -d "$DB" -c "grant usage on schema storage to anon, authenticated, service_role;
                   grant all on all tables in schema storage to service_role;
                   grant select on all tables in schema storage to anon, authenticated;" >/dev/null 2>&1 || true
# Bucket de logos (la migración lo omite si Storage aún no existía)
$PSQL -d "$DB" -f supabase/migrations/20261108000004_legal_y_storage.sql >/dev/null 2>&1 || true
$PSQL -d "$DB" -c "insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
                   values ('logos','logos',true,1048576,array['image/png']) on conflict (id) do nothing;" >/dev/null 2>&1 || true

cat > .env.local <<EOF
# Generado por scripts/local/stack.sh (solo desarrollo local)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_KEY
NEXT_PUBLIC_APP_URL=http://localhost:3000
IP_HASH_SALT=$(cat "$STATE/jwt_secret" | sha256sum | cut -c1-32)
EOF
echo "Pila local lista. Variables escritas en .env.local"
