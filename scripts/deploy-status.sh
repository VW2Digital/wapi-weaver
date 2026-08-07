#!/usr/bin/env bash
# ==============================================================================
# DEPLOY STATUS CHECKER - BLIV CRM / WAPI WEAVER
# ==============================================================================
set -euo pipefail

APP_DIR="/var/www/wapi-weaver"
cd "${APP_DIR}"

LOCAL_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
HEAD_SHA=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
ORIGIN_SHA=$(git rev-parse origin/main 2>/dev/null || echo "unknown")
DIRTY_FILES=$(git status --porcelain --untracked-files=no 2>/dev/null || echo "")

CONTAINER_STATUS="stopped"
CONTAINER_SHA="none"

if docker compose -f docker-compose.production.yml ps app 2>/dev/null | grep -Eq "(Up|running)"; then
  CONTAINER_STATUS="running"
  CONTAINER_SHA=$(docker exec wapi_weaver_app printenv APP_GIT_SHA 2>/dev/null || echo "not-set")
fi

DEPLOY_VERSION_FILE="${APP_DIR}/.deploy-version"
SAVED_SHA="none"
if [ -f "${DEPLOY_VERSION_FILE}" ]; then
  SAVED_SHA=$(grep '^GIT_SHA=' "${DEPLOY_VERSION_FILE}" | cut -d '=' -f2- || echo "none")
fi

echo "=========================================================="
echo "          BLIV CRM - STATUS DO DEPLOY EM PRODUÇÃO         "
echo "=========================================================="
echo "  Branch local  : ${LOCAL_BRANCH}"
echo "  HEAD local    : ${HEAD_SHA}"
echo "  origin/main   : ${ORIGIN_SHA}"
echo "  Working tree  : $([ -z "${DIRTY_FILES}" ] && echo "clean (0 modificações)" || echo "MODIFICADO")"
echo "  Container App : ${CONTAINER_STATUS}"
echo "  App Git SHA   : ${CONTAINER_SHA}"
echo "  .deploy-ver   : ${SAVED_SHA}"
echo "----------------------------------------------------------"

IS_ALIGNED=1

if [ "${HEAD_SHA}" != "${ORIGIN_SHA}" ]; then
  echo " ❌ DESALINHAMENTO: HEAD local difere de origin/main!"
  IS_ALIGNED=0
fi

if [ -n "${DIRTY_FILES}" ]; then
  echo " ❌ DESALINHAMENTO: Working tree possui arquivos rastreados modificados!"
  IS_ALIGNED=0
fi

if [ "${CONTAINER_STATUS}" == "running" ] && [ "${CONTAINER_SHA}" != "${HEAD_SHA}" ]; then
  echo " ❌ DESALINHAMENTO: APP_GIT_SHA do container difere do HEAD local!"
  IS_ALIGNED=0
fi

if [ "${IS_ALIGNED}" -eq 1 ]; then
  echo "  RESULTADO DO DEPLOY: OK (100% alinhado com origin/main)"
  echo "=========================================================="
  exit 0
else
  echo "  RESULTADO DO DEPLOY: DIVERGENTE"
  echo "=========================================================="
  exit 1
fi
