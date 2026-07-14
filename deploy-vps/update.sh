#!/usr/bin/env bash
# ==============================================================================
# UPDATER - CRM WAPI WEAVER
# ==============================================================================
# Atualiza o código, rebuilda o container da aplicação e migra o schema
# do banco de dados — SEM reinstalar do zero e SEM perder dados.
#
# Uso rápido (a partir do GitHub):
#   bash <(curl -fsSL "https://raw.githubusercontent.com/VW2Digital/wapi-weaver/main/deploy-vps/update.sh")
#
# Ou, se você já tem o repositório clonado:
#   sudo bash /var/www/wapi-weaver/deploy-vps/update.sh
# ==============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuração
# ---------------------------------------------------------------------------
APP_DIR="/var/www/wapi-weaver"
REPO_URL="https://github.com/VW2Digital/wapi-weaver.git"
BACKUP_DIR="/var/backups/wapi-weaver"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
  echo -e "${GREEN}"
  echo "========================================================================"
  echo "    UPDATER - CRM WAPI WEAVER                                          "
  echo "    $(date '+%d/%m/%Y %H:%M:%S')                                       "
  echo "========================================================================"
  echo -e "${NC}"
}

print_step()  { echo -e "${YELLOW}▶ $1${NC}"; }
print_ok()    { echo -e "${GREEN}  ✓ $1${NC}"; }
print_error() { echo -e "${RED}  ✗ $1${NC}"; }
print_info()  { echo -e "${BLUE}  ℹ $1${NC}"; }

# ---------------------------------------------------------------------------
# Verificações iniciais
# ---------------------------------------------------------------------------
print_header

if [ "$EUID" -ne 0 ]; then
  print_error "Execute como root: sudo bash update.sh"
  exit 1
fi

if [ ! -d "${APP_DIR}" ]; then
  print_error "Diretório ${APP_DIR} não encontrado."
  echo "  Execute o instalador completo primeiro: sudo bash install.sh"
  exit 1
fi

if [ ! -f "${APP_DIR}/docker-compose.yml" ]; then
  print_error "docker-compose.yml não encontrado em ${APP_DIR}."
  exit 1
fi

if [ ! -f "${APP_DIR}/.env" ]; then
  print_error ".env não encontrado em ${APP_DIR}."
  exit 1
fi

if ! command -v docker &>/dev/null; then
  print_error "Docker não encontrado."
  exit 1
fi

# Compat: docker compose v2 vs v1
if ! docker compose version &>/dev/null 2>&1; then
  if command -v docker-compose &>/dev/null 2>&1; then
    docker() {
      if [ "$1" = "compose" ]; then shift; command docker-compose "$@"; else command docker "$@"; fi
    }
  else
    print_error "Docker Compose não disponível."
    exit 1
  fi
fi

# ---------------------------------------------------------------------------
# Ler variáveis do .env existente
# ---------------------------------------------------------------------------
_env_get() {
  grep "^${1}=" "${APP_DIR}/.env" 2>/dev/null | tail -n 1 | cut -d '=' -f2- | tr -d '"' | tr -d "'" || true
}

DB_ROOT_PASS=$(_env_get MYSQL_ROOT_PASSWORD)
DB_PASS=$(_env_get DB_PASSWORD)

if [ -z "${DB_ROOT_PASS}" ]; then
  print_error "MYSQL_ROOT_PASSWORD não encontrada no .env. Abortando."
  exit 1
fi

# ---------------------------------------------------------------------------
# Confirmação do usuário
# ---------------------------------------------------------------------------
echo ""
echo "  Este script irá:"
echo "    1. Fazer backup automático do banco de dados (SQL dump)"
echo "    2. Puxar o código mais recente do Git"
echo "    3. Adicionar novas variáveis de ambiente ao .env (sem sobrescrever)"
echo "    4. Rebuildar o container da aplicação (MySQL e Redis ficam no ar)"
echo "    5. Aplicar migrações do schema (ensure-schema.js)"
echo ""
echo "  ⚠️  O banco de dados e o .env NÃO serão apagados."
echo "      Uploads e dados do MySQL são preservados nos volumes Docker."
echo ""

if [ -z "${AUTO_CONFIRM:-}" ]; then
  read -p "  Confirmar atualização? (s/n): " CONFIRM
  CONFIRM=$(echo "$CONFIRM" | tr '[:upper:]' '[:lower:]' | xargs)
  if [[ "$CONFIRM" != "s" ]]; then
    echo "  Atualização cancelada."
    exit 0
  fi
fi

echo ""

# ---------------------------------------------------------------------------
# PASSO 1 — Backup automático do banco (não fatal se MySQL estiver parado)
# ---------------------------------------------------------------------------
print_step "[1/5] Backup do banco de dados..."

mkdir -p "${BACKUP_DIR}"
BACKUP_FILE="${BACKUP_DIR}/wapi_weaver_backup_${TIMESTAMP}.sql.gz"
BACKUP_OK=0

# Detectar se o container MySQL está em execução
MYSQL_RUNNING=$(docker compose -f "${APP_DIR}/docker-compose.yml" ps --status running 2>/dev/null | grep -ciE "banco-mysql|mysql" || true)

if [ "${MYSQL_RUNNING:-0}" -gt 0 ]; then
  echo "  MySQL ativo. Realizando dump..."
  if docker compose -f "${APP_DIR}/docker-compose.yml" exec -T banco-mysql \
      mysqldump -u root -p"${DB_ROOT_PASS}" \
      --single-transaction --quick --lock-tables=false \
      wapi_weaver 2>/dev/null | gzip > "${BACKUP_FILE}"; then
    BACKUP_BYTES=$(stat -c%s "${BACKUP_FILE}" 2>/dev/null || echo 0)
    if [ "${BACKUP_BYTES}" -gt 100 ]; then
      BACKUP_SIZE=$(du -sh "${BACKUP_FILE}" | cut -f1)
      BACKUP_OK=1
      print_ok "Backup criado: ${BACKUP_FILE} (${BACKUP_SIZE})"
    else
      rm -f "${BACKUP_FILE}" 2>/dev/null || true
      print_info "Backup vazio (banco pode estar vazio). Continuando sem backup."
      BACKUP_OK=1
    fi
  else
    rm -f "${BACKUP_FILE}" 2>/dev/null || true
    print_info "Aviso: falha ao gerar backup (mysqldump falhou). Continuando mesmo assim."
  fi
else
  print_info "Aviso: MySQL não está rodando. Pulando backup."
  print_info "Os dados no volume Docker (mysql_data) serão preservados normalmente."
fi

if [ "${BACKUP_OK}" -eq 0 ]; then
  echo ""
  echo -e "${YELLOW}  ⚠️  Atualização continuará SEM backup automático desta vez.${NC}"
  echo "     Os dados do volume Docker são preservados e não serão afetados."
  echo ""
fi

# Limpar backups com mais de 7 dias
find "${BACKUP_DIR}" -name "*.sql.gz" -mtime +7 -delete 2>/dev/null || true
print_info "Backups antigos (>7 dias) limpos automaticamente."


# ---------------------------------------------------------------------------
# PASSO 2 — Atualizar código via Git
# ---------------------------------------------------------------------------
print_step "[2/5] Atualizando código da aplicação..."

cd "${APP_DIR}"

if [ -d "${APP_DIR}/.git" ]; then
  CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
  CURRENT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "desconhecido")
  echo "  Branch: ${CURRENT_BRANCH} @ ${CURRENT_COMMIT}"

  # Proteger o .env de ser sobrescrito pelo pull
  git update-index --assume-unchanged .env 2>/dev/null || true

  # Stash de outras mudanças locais
  git stash --include-untracked 2>/dev/null || true

  if git pull origin "${CURRENT_BRANCH}" --ff-only 2>/dev/null; then
    NEW_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "novo")
    print_ok "Código atualizado: ${CURRENT_COMMIT} → ${NEW_COMMIT}"
  else
    echo "  Fast-forward falhou. Tentando fetch + reset..."
    git fetch origin "${CURRENT_BRANCH}"
    git reset --hard "origin/${CURRENT_BRANCH}"
    NEW_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "novo")
    print_ok "Código atualizado via reset: ${CURRENT_COMMIT} → ${NEW_COMMIT}"
  fi

  # Restaurar stash (exceto .env que já está protegido)
  git stash pop 2>/dev/null || true

else
  echo "  Sem repositório Git. Clonando do zero..."
  BACKUP_APP="/tmp/wapi-weaver-app-backup-${TIMESTAMP}"
  cp -r "${APP_DIR}" "${BACKUP_APP}" 2>/dev/null || true
  rm -rf "${APP_DIR}"
  git clone "${REPO_URL}" "${APP_DIR}"
  if [ -f "${BACKUP_APP}/.env" ]; then
    cp "${BACKUP_APP}/.env" "${APP_DIR}/.env"
    print_info ".env restaurado do backup temporário."
  fi
  rm -rf "${BACKUP_APP}"
  print_ok "Código clonado com sucesso."
fi

# ---------------------------------------------------------------------------
# PASSO 3 — Garantir novas variáveis de ambiente no .env
# ---------------------------------------------------------------------------
print_step "[3/5] Verificando variáveis de ambiente..."

# MERCADOPAGO_ENCRYPTION_KEY (nova variável de billing)
if ! grep -q "^MERCADOPAGO_ENCRYPTION_KEY=" "${APP_DIR}/.env" 2>/dev/null; then
  MP_ENC_KEY=$(openssl rand -hex 32)
  echo "" >> "${APP_DIR}/.env"
  echo "# Chave AES-256-GCM para criptografar credenciais Mercado Pago no banco" >> "${APP_DIR}/.env"
  echo "MERCADOPAGO_ENCRYPTION_KEY=${MP_ENC_KEY}" >> "${APP_DIR}/.env"
  print_ok "MERCADOPAGO_ENCRYPTION_KEY gerada e adicionada ao .env."
fi

# SITE_URL (nova variável para webhooks e checkout)
if ! grep -q "^SITE_URL=" "${APP_DIR}/.env" 2>/dev/null; then
  APP_URL=$(_env_get APP_URL)
  SITE_URL_VALUE="${APP_URL:-http://localhost}"
  echo "" >> "${APP_DIR}/.env"
  echo "# URL pública da aplicação (usada para webhook e URLs de retorno do checkout)" >> "${APP_DIR}/.env"
  echo "SITE_URL=${SITE_URL_VALUE}" >> "${APP_DIR}/.env"
  print_ok "SITE_URL=${SITE_URL_VALUE} adicionada ao .env."
fi

print_ok "Variáveis de ambiente verificadas."

# ---------------------------------------------------------------------------
# PASSO 4 — Rebuild do container da app (MySQL e Redis ficam rodando)
# ---------------------------------------------------------------------------
print_step "[4/5] Rebuilding container da aplicação..."

cd "${APP_DIR}"

echo "  Construindo nova imagem..."
export DOCKER_BUILDKIT=1
docker compose build app

echo "  Substituindo container em execução (sem derrubar MySQL/Redis)..."
docker compose up -d --no-deps app

echo ""
echo "  Aguardando a aplicação reiniciar (máx. 120s)..."
APP_READY=0
for attempt in $(seq 1 24); do
  STATUS=$(docker compose ps app 2>/dev/null || true)
  if echo "$STATUS" | grep -Eq "(Up|running)" && ! echo "$STATUS" | grep -qi "restarting"; then
    APP_READY=1
    print_ok "Container da aplicação: RUNNING"
    break
  fi
  echo "  Aguardando... tentativa ${attempt}/24"
  sleep 5
done

if [ "$APP_READY" -eq 0 ]; then
  print_error "Container não estabilizou. Verifique:"
  echo "    cd ${APP_DIR} && docker compose logs --tail=50 app"
  exit 1
fi

# ---------------------------------------------------------------------------
# PASSO 5 — Migração do schema (incremental, sem perda de dados)
# ---------------------------------------------------------------------------
print_step "[5/5] Aplicando migrações do schema do banco de dados..."

echo ""
print_info "O ensure-schema.js aplica APENAS mudanças incrementais:"
print_info "  • Cria tabelas novas que não existem"
print_info "  • Adiciona colunas e índices faltantes"
print_info "  • Faz seeding de planos padrão se billing_plans estiver vazio"
print_info "  • NUNCA apaga dados existentes"
echo ""

if docker compose exec -T app node scripts/ensure-schema.js; then
  print_ok "Schema migrado com sucesso."
else
  print_error "Falha na migração do schema."
  echo ""
  echo "  Backup disponível em: ${BACKUP_FILE}"
  echo "  Para investigar:"
  echo "    cd ${APP_DIR} && docker compose logs --tail=100 app"
  exit 1
fi

# ---------------------------------------------------------------------------
# Resumo final
# ---------------------------------------------------------------------------
echo ""
echo -e "${GREEN}"
echo "========================================================================"
echo "    ATUALIZAÇÃO CONCLUÍDA COM SUCESSO!                                  "
echo "========================================================================"
echo -e "${NC}"

echo ""
echo "  Status dos containers:"
docker compose ps 2>/dev/null || true

echo ""
echo "  📦 Backup criado: ${BACKUP_FILE}"
echo ""
echo "  📋 Comandos úteis:"
echo "     Logs ao vivo:      cd ${APP_DIR} && docker compose logs -f app"
echo "     Aplicar schema:    cd ${APP_DIR} && docker compose exec app node scripts/ensure-schema.js"
echo "     Restaurar backup:  gunzip -c ${BACKUP_FILE} | docker compose exec -T banco-mysql mysql -u root -p\${MYSQL_ROOT_PASSWORD} wapi_weaver"
echo ""
echo "========================================================================"
