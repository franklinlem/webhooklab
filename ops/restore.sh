#!/bin/sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "Uso: ./ops/restore.sh backups/webhooklab-AAAA-MM-DD_HH-MM-SS.sql.gz" >&2
  exit 2
fi

backup_file="$1"
if [ ! -f "${backup_file}" ]; then
  echo "Arquivo não encontrado: ${backup_file}" >&2
  exit 2
fi

gzip -t "${backup_file}"
gzip -dc "${backup_file}" | docker compose exec -T postgres \
  psql --username="${POSTGRES_USER:-webhooklab}" --dbname="${POSTGRES_DB:-webhooklab}" --single-transaction

