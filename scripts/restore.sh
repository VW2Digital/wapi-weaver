#!/usr/bin/env bash
# ==============================================================================
# SCRIPT DE RESTAURAÇÃO - BLIV CRM / WAPI WEAVER
# ==============================================================================
set -euo pipefail

APP_DIR="/var/www/wapi-weaver"
DUMP_FILE="${1:-}"

if [ -z "${DUMP_FILE}" ] || [ ! -f "${DUMP_FILE}" ] || [ ! -s "${DUMP_FILE}" ]; then
  echo "Uso: sudo bash scripts/restore.sh /caminho/para/arquivo.sql[.gz]"
  exit 1
fi

if [ ! -f "${APP_DIR}/.env" ]; then
  echo "Erro: Arquivo .env não encontrado em ${APP_DIR}."
  exit 1
fi

MYSQL_ROOT_PASS=$(grep '^MYSQL_ROOT_PASSWORD=' "${APP_DIR}/.env" 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'" || true)
if [ -z "${MYSQL_ROOT_PASS}" ]; then
  MYSQL_ROOT_PASS=$(grep '^DB_PASSWORD=' "${APP_DIR}/.env" 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'" || true)
fi

echo "[Restore] 1. Criando backup preventivo de segurança antes da restauração..."
sudo bash "${APP_DIR}/scripts/backup.sh" || true

echo "[Restore] 2. Parando a aplicação para restauração limpa..."
docker compose -f "${APP_DIR}/docker-compose.production.yml" stop app || true

echo "[Restore] 3. Recriando o banco de dados wapi_weaver..."
docker compose -f "${APP_DIR}/docker-compose.production.yml" exec -T mysql sh -c \
  "mysql -uroot -p'${MYSQL_ROOT_PASS}' -e 'DROP DATABASE IF EXISTS wapi_weaver; CREATE DATABASE wapi_weaver CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;'"

echo "[Restore] 4. Importando o arquivo de dump..."
if [[ "${DUMP_FILE}" == *.gz ]]; then
  gunzip -c "${DUMP_FILE}" | docker compose -f "${APP_DIR}/docker-compose.production.yml" exec -T mysql sh -c \
    "mysql -uroot -p'${MYSQL_ROOT_PASS}' wapi_weaver"
else
  docker compose -f "${APP_DIR}/docker-compose.production.yml" exec -T mysql sh -c \
    "mysql -uroot -p'${MYSQL_ROOT_PASS}' wapi_weaver" < "${DUMP_FILE}"
fi

echo "[Restore] 5. Reiniciando a aplicação..."
docker compose -f "${APP_DIR}/docker-compose.production.yml" start app

echo "[Restore] 6. Executando migrações de alinhamento..."
docker compose -f "${APP_DIR}/docker-compose.production.yml" exec -T app node scripts/migrate.js

echo "[Restore] 7. Validando a instalação..."
docker compose -f "${APP_DIR}/docker-compose.production.yml" exec -T app node scripts/validate-installation.js

echo "[Restore] ✅ Restauração concluída com sucesso!"
