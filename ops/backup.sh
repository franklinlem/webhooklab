#!/bin/sh
set -eu

timestamp="$(date -u +%Y-%m-%d_%H-%M-%S)"
target="/backups/webhooklab-${timestamp}.sql.gz"

pg_dump \
  --host=postgres \
  --username="${POSTGRES_USER:-webhooklab}" \
  --dbname="${POSTGRES_DB:-webhooklab}" \
  --no-owner \
  --no-privileges \
  | gzip > "${target}"

gzip -t "${target}"
find /backups -type f -name 'webhooklab-*.sql.gz' -mtime +14 -delete
echo "Backup concluído: ${target}"

