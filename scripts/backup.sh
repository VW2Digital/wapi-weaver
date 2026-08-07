#!/usr/bin/env bash
# ==============================================================================
# SCRIPT DE BACKUP - BLIV CRM / WAPI WEAVER
# ==============================================================================
set -euo pipefail

BACKUP_DIR="/var/backups/blivcrm"
APP_DIR="/var/www/wapi-weaver"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/wapi_weaver-${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"

if [ ! -f "${APP_DIR}/.env" ]; then
  echo "Erro: Arquivo .env não encontrado em ${APP_DIR}."
  exit 1
fi

MYSQL_ROOT_PASS=$(grep '^MYSQL_ROOT_PASSWORD=' "${APP_DIR}/.env" 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'" || true)

if [ -z "${MYSQL_ROOT_PASS}" ]; then
  MYSQL_ROOT_PASS=$(grep '^DB_PASSWORD=' "${APP_DIR}/.env" 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'" || true)
fi

if [ -z "${MYSQL_ROOT_PASS}" ]; then
  echo "Erro: Senha do banco de dados não encontrada no arquivo .env."
  exit 1
fi

echo "[Backup] Iniciando backup do banco de dados wapi_weaver..."

docker compose -f "${APP_DIR}/docker-compose.production.yml" exec -T mysql sh -c \
  "mysqldump -uroot -p'${MYSQL_ROOT_PASS}' --single-transaction --routines --triggers --events --hex-blob wapi_weaver" \
  | gzip -9 > "${BACKUP_FILE}"

if [ -f "${BACKUP_FILE}" ] && [ -s "${BACKUP_FILE}" ]; then
  chmod 600 "${BACKUP_FILE}"
  FILE_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
  echo "[Backup] ✅ Backup concluído com sucesso: ${BACKUP_FILE} (Tamanho: ${FILE_SIZE})"
else
  rm -f "${BACKUP_FILE}"
  echo "[Backup] ❌ FALHA: O arquivo de backup foi gerado vazio ou falhou!"
  exit 1
fi
