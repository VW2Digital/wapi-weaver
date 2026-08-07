#!/usr/bin/env bash
# ==============================================================================
# DIAGNÓSTICO DO DEPLOY - BLIV CRM / WAPI WEAVER (SOMENTE LEITURA)
# ==============================================================================
set -euo pipefail

APP_DIR="/var/www/wapi-weaver"
COMPOSE_FILE="${APP_DIR}/docker-compose.production.yml"

echo "=========================================================="
echo "      DIAGNÓSTICO INTEGRAL DO DEPLOY (READ-ONLY)         "
echo "=========================================================="

ERRORS=0

# 1. Diagnóstico do Git
echo "[Git]"
if [ -d "${APP_DIR}/.git" ]; then
  cd "${APP_DIR}"
  BRANCH=$(git rev-parse --abbrev-ref HEAD)
  HEAD_SHA=$(git rev-parse HEAD)
  ORIGIN_SHA=$(git rev-parse origin/main 2>/dev/null || echo "not-fetched")
  DIRTY=$(git status --porcelain --untracked-files=no)

  echo "  Branch: ${BRANCH}"
  echo "  HEAD SHA: ${HEAD_SHA}"
  echo "  origin/main SHA: ${ORIGIN_SHA}"

  if [ "${HEAD_SHA}" != "${ORIGIN_SHA}" ]; then
    echo "  ❌ ERRO: HEAD local difere de origin/main"
    ERRORS=$((ERRORS + 1))
  else
    echo "  ✓ Git commit alinhado com origin/main"
  fi

  if [ -n "${DIRTY}" ]; then
    echo "  ❌ ERRO: Working tree possui modificações rastreadas"
    ERRORS=$((ERRORS + 1))
  else
    echo "  ✓ Working tree limpo"
  fi
else
  echo "  ❌ ERRO: Diretório .git não encontrado em ${APP_DIR}"
  ERRORS=$((ERRORS + 1))
fi

# 2. Diagnóstico do Docker & Compose
echo ""
echo "[Docker & Compose]"
if command -v docker &>/dev/null; then
  echo "  ✓ Docker Engine: $(docker --version)"
else
  echo "  ❌ ERRO: Docker Engine não instalado"
  ERRORS=$((ERRORS + 1))
fi

if docker compose version &>/dev/null 2>&1; then
  echo "  ✓ Docker Compose v2: $(docker compose version)"
else
  echo "  ❌ ERRO: Docker Compose v2 não disponível"
  ERRORS=$((ERRORS + 1))
fi

# 3. Diagnóstico do .env e JWT_SECRET
echo ""
echo "[Arquivo .env & Segredos]"
if [ -f "${APP_DIR}/.env" ]; then
  echo "  ✓ Arquivo .env presente em ${APP_DIR}"
  PERMS=$(stat -c "%a" "${APP_DIR}/.env" 2>/dev/null || echo "unknown")
  echo "  Permissões do .env: ${PERMS}"

  JWT_SEC=$(grep '^JWT_SECRET=' "${APP_DIR}/.env" | cut -d '=' -f2- | tr -d '"' | tr -d "'" || echo "")
  if [ -n "${JWT_SEC}" ]; then
    echo "  ✓ JWT_SECRET configurado"
  else
    echo "  ❌ ERRO: JWT_SECRET está ausente ou vazio"
    ERRORS=$((ERRORS + 1))
  fi
else
  echo "  ❌ ERRO: Arquivo .env ausente"
  ERRORS=$((ERRORS + 1))
fi

# 4. Diagnóstico dos Containers
echo ""
echo "[Containers & Healthchecks]"
if [ -f "${COMPOSE_FILE}" ]; then
  cd "${APP_DIR}"
  
  # App
  APP_STATE=$(docker compose -f "${COMPOSE_FILE}" ps app 2>/dev/null | grep -Eq "(Up|running)" && echo "running" || echo "stopped")
  echo "  Container App: ${APP_STATE}"
  if [ "${APP_STATE}" == "running" ];  then
    APP_SHA=$(docker exec wapi_weaver_app printenv APP_GIT_SHA 2>/dev/null || echo "not-set")
    echo "  Container APP_GIT_SHA: ${APP_SHA}"
  else
    echo "  ❌ ERRO: Container app está parado ou em loop de restart"
    ERRORS=$((ERRORS + 1))
  fi

  # MySQL
  MYSQL_STATE=$(docker compose -f "${COMPOSE_FILE}" ps mysql 2>/dev/null | grep -Eq "(Up|running)" && echo "running" || echo "stopped")
  echo "  Container MySQL: ${MYSQL_STATE}"
  if [ "${MYSQL_STATE}" != "running" ]; then
    echo "  ❌ ERRO: Container mysql está parado"
    ERRORS=$((ERRORS + 1))
  fi

  # Redis
  REDIS_STATE=$(docker compose -f "${COMPOSE_FILE}" ps redis 2>/dev/null | grep -Eq "(Up|running)" && echo "running" || echo "stopped")
  echo "  Container Redis: ${REDIS_STATE}"
  if [ "${REDIS_STATE}" != "running" ]; then
    echo "  ❌ ERRO: Container redis está parado"
    ERRORS=$((ERRORS + 1))
  fi
else
  echo "  ❌ ERRO: Arquivo ${COMPOSE_FILE} ausente"
  ERRORS=$((ERRORS + 1))
fi

# 5. Diagnóstico de Conectividade Interna
echo ""
echo "[Conectividade & Aplicação]"
APP_HTTP=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:3003" || echo "000")
echo "  HTTP 127.0.0.1:3003: ${APP_HTTP}"
if [[ "$APP_HTTP" =~ ^(200|301|302|404)$ ]]; then
  echo "  ✓ Aplicação está respondendo na porta interna 3003"
else
  echo "  ❌ ERRO: Aplicação não respondeu em 127.0.0.1:3003 (Status: ${APP_HTTP})"
  ERRORS=$((ERRORS + 1))
fi

# 6. Diagnóstico do Nginx & SSL
echo ""
echo "[Nginx & Reverse Proxy]"
if systemctl is-active --quiet nginx 2>/dev/null; then
  echo "  ✓ Serviço Nginx ativo e em execução"
else
  echo "  ❌ ERRO: Serviço Nginx inativo"
  ERRORS=$((ERRORS + 1))
fi

echo "=========================================================="
if [ "${ERRORS}" -eq 0 ]; then
  echo "  RESULTADO DO DIAGNÓSTICO: 100% SAUDÁVEL E CONFORME"
  echo "=========================================================="
  exit 0
else
  echo "  RESULTADO DO DIAGNÓSTICO: ENCONTRADOS ${ERRORS} ERROS"
  echo "=========================================================="
  exit 1
fi
