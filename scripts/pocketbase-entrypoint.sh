#!/bin/sh
set -eu

PB_DIR="${PB_DIR:-/pb/pb_data}"
PB_HTTP="${PB_HTTP:-0.0.0.0:8090}"

mkdir -p "$PB_DIR" /pb/pb_public

if [ -n "${POCKETBASE_SUPERUSER_EMAIL:-}" ] && [ -n "${POCKETBASE_SUPERUSER_PASSWORD:-}" ]; then
  /pb/pocketbase superuser upsert "$POCKETBASE_SUPERUSER_EMAIL" "$POCKETBASE_SUPERUSER_PASSWORD" --dir="$PB_DIR"
fi

exec /pb/pocketbase serve \
  --http="$PB_HTTP" \
  --dir="$PB_DIR" \
  --migrationsDir=/pb/pb_migrations \
  --publicDir=/pb/pb_public
