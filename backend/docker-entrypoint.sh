#!/bin/sh
# Prepara o banco no volume e sobe a API.
# O banco original da imagem (SEED_DB_PATH) nunca é alterado: a API trabalha numa cópia.
set -eu

DB_FILE="${DATABASE_URL#file:}"

if [ ! -f "$DB_FILE" ]; then
  echo "[entrypoint] Banco não encontrado em $DB_FILE. Copiando o banco original."
  cp "$SEED_DB_PATH" "$DB_FILE"
  # O banco fornecido não tem _prisma_migrations: marca a baseline antes do deploy (D-055).
  npx prisma migrate resolve --applied 0_init
fi

npx prisma migrate deploy

exec node dist/main