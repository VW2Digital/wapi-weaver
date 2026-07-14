#!/usr/bin/env bash
# ==============================================================================
# INSTALADOR AUTOMATIZADO - CRM WAPI WEAVER (DOCKER COMPOSE)
# ==============================================================================
# Alvo: Ubuntu 20.04 / 22.04 / 24.04 LTS
# Uso:  sudo bash install.sh
# ==============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Cores para output
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

APP_DIR="/var/www/wapi-weaver"

print_header() {
  echo -e "${GREEN}"
  echo "========================================================================"
  echo "    INSTALADOR OFICIAL - CRM WAPI WEAVER (DOCKER + NGINX + SSL)  "
  echo "========================================================================"
  echo -e "${NC}"
}

print_step() {
  echo -e "${YELLOW}$1${NC}"
}

print_ok() {
  echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
  echo -e "${RED}✗ $1${NC}"
}

print_info() {
  echo -e "${BLUE}  ℹ $1${NC}"
}

# ---------------------------------------------------------------------------
# 0. Verificações iniciais
# ---------------------------------------------------------------------------
print_header

if [ "$EUID" -ne 0 ]; then
  print_error "Execute como root: sudo bash install.sh"
  exit 1
fi

# ---------------------------------------------------------------------------
# 1. Coletar parâmetros
# ---------------------------------------------------------------------------
print_step "[1/8] Coletando parâmetros de configuração..."

# Domínio
while true; do
  if [ -z "${DOMAIN:-}" ]; then
    read -p "  Digite o domínio para esta instalação (ex: app.meusite.com): " DOMAIN
  fi
  DOMAIN=$(echo "$DOMAIN" | xargs)
  if [[ "$DOMAIN" =~ ^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
    break
  else
    echo -e "${RED}  Erro: Domínio inválido.${NC}"
    DOMAIN=""
  fi
done

# E-mail do administrador
while true; do
  if [ -z "${ADMIN_EMAIL:-}" ]; then
    read -p "  E-mail do Administrador: " ADMIN_EMAIL
  fi
  ADMIN_EMAIL=$(echo "$ADMIN_EMAIL" | xargs)
  if [[ "$ADMIN_EMAIL" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
    break
  else
    echo -e "${RED}  Erro: E-mail inválido.${NC}"
    ADMIN_EMAIL=""
  fi
done

# Senha do administrador
while true; do
  if [ -z "${ADMIN_PASSWORD:-}" ]; then
    echo -n "  Senha do Administrador (mín. 6 chars): "
    read -s ADMIN_PASSWORD
    echo ""
  fi
  ADMIN_PASSWORD=$(echo "$ADMIN_PASSWORD" | xargs)
  if [ -z "$ADMIN_PASSWORD" ] || [ ${#ADMIN_PASSWORD} -lt 6 ]; then
    echo -e "${RED}  Erro: A senha deve conter pelo menos 6 caracteres.${NC}"
    ADMIN_PASSWORD=""
  else
    break
  fi
done

# SSL
while true; do
  if [ -z "${INSTALL_SSL:-}" ]; then
    read -p "  Instalar SSL com Let's Encrypt? (s/n): " INSTALL_SSL
  fi
  INSTALL_SSL=$(echo "$INSTALL_SSL" | tr '[:upper:]' '[:lower:]' | xargs)
  if [[ "$INSTALL_SSL" == "s" || "$INSTALL_SSL" == "n" ]]; then
    break
  else
    echo -e "${RED}  Erro: Responda apenas 's' ou 'n'.${NC}"
    INSTALL_SSL=""
  fi
done

# E-mail SSL
if [[ "$INSTALL_SSL" == "s" ]]; then
  while true; do
    if [ -z "${SSL_EMAIL:-}" ]; then
      read -p "  E-mail para o certificado SSL: " SSL_EMAIL
    fi
    SSL_EMAIL=$(echo "$SSL_EMAIL" | xargs)
    if [[ "$SSL_EMAIL" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
      break
    else
      echo -e "${RED}  Erro: E-mail inválido.${NC}"
      SSL_EMAIL=""
    fi
  done
fi

# Senha do banco de dados
DB_PASS_ENV=$(grep '^DB_PASSWORD=' "${APP_DIR}/.env" 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'" || true)
if [ -z "${DB_PASS:-}" ] && [ -z "${DB_PASS_ENV:-}" ]; then
  while true; do
    echo -n "  Senha do banco de dados (mín. 8 chars, sem espaços): "
    read -s DB_PASS
    echo ""
    DB_PASS=$(echo "$DB_PASS" | xargs)
    if [ -z "$DB_PASS" ]; then
      echo -e "${RED}  Erro: Senha obrigatória.${NC}"
    elif [ ${#DB_PASS} -lt 8 ]; then
      echo -e "${RED}  Erro: Mínimo 8 caracteres.${NC}"
      DB_PASS=""
    elif [[ "$DB_PASS" =~ [[:space:]] ]]; then
      echo -e "${RED}  Erro: Sem espaços na senha.${NC}"
      DB_PASS=""
    else
      break
    fi
  done
fi

# Protocolo e SITE_URL
PROTOCOL="http"
[ "${INSTALL_SSL:-n}" = "s" ] && PROTOCOL="https"
SITE_URL="${SITE_URL:-${PROTOCOL}://${DOMAIN}}"

echo ""
echo "  Domínio:  $DOMAIN"
echo "  Site URL: $SITE_URL"
echo "  SSL:      ${INSTALL_SSL:-n}"
echo "  Senha DB: ********"
echo ""
print_ok "Parâmetros carregados."

# ---------------------------------------------------------------------------
# 2. Verificar/configurar swap
# ---------------------------------------------------------------------------
print_step "[2/8] Verificando memória e swap..."

TOTAL_RAM=$(free -m | awk '/^Mem:/{print $2}')
TOTAL_SWAP=$(free -m | awk '/^Swap:/{print $2}')
echo "  RAM: ${TOTAL_RAM}MB | Swap atual: ${TOTAL_SWAP}MB"

if [ "$TOTAL_SWAP" -lt 3000 ]; then
  echo "  Swap insuficiente. Criando swap de 4GB..."
  swapoff /swapfile 2>/dev/null || true
  rm -f /swapfile
  fallocate -l 4G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=4096
  chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q "/swapfile" /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  print_ok "Swap de 4GB configurado."
else
  print_ok "Memória OK (RAM: ${TOTAL_RAM}MB, Swap: ${TOTAL_SWAP}MB)."
fi

# ---------------------------------------------------------------------------
# 3. Instalar dependências do sistema
# ---------------------------------------------------------------------------
print_step "[3/8] Instalando dependências do sistema (Docker, Nginx, Certbot)..."

apt-get update -y -qq
apt-get install -y -qq curl git nginx certbot python3-certbot-nginx rsync

# Docker Engine
if ! command -v docker &>/dev/null; then
  echo "  Instalando Docker Engine..."
  curl -fsSL https://get.docker.com | bash
  systemctl enable docker
  systemctl start docker
  print_ok "Docker instalado."
else
  print_ok "Docker já instalado: $(docker --version)"
fi

# Docker Compose Plugin v2
if ! docker compose version &>/dev/null 2>&1; then
  echo "  Instalando Docker Compose Plugin..."
  apt-get install -y -qq docker-compose-plugin || true
fi

if docker compose version &>/dev/null 2>&1; then
  print_ok "Docker Compose: $(docker compose version)"
elif command -v docker-compose &>/dev/null 2>&1; then
  docker() {
    if [ "$1" = "compose" ]; then
      shift
      command docker-compose "$@"
    else
      command docker "$@"
    fi
  }
  print_ok "Usando docker-compose legado."
else
  print_error "Docker Compose não disponível. Instale docker-compose-plugin."
  exit 1
fi

# ---------------------------------------------------------------------------
# 4. Preparar código da aplicação
# ---------------------------------------------------------------------------
print_step "[4/8] Preparando código da aplicação em ${APP_DIR}..."

mkdir -p /var/www

# Backup do .env existente
if [ -f "${APP_DIR}/.env" ]; then
  echo "  Salvando backup do .env atual..."
  cp "${APP_DIR}/.env" /tmp/wapi-weaver-env-backup
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -f "${SCRIPT_DIR}/docker-compose.yml" ]; then
  echo "  Copiando arquivos locais para ${APP_DIR}..."
  rsync -a --delete \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='dist' \
    --exclude='.output' \
    "${SCRIPT_DIR}/" "${APP_DIR}/"
else
  echo "  Clonando repositório para ${APP_DIR}..."
  rm -rf "${APP_DIR}"
  git clone https://github.com/VW2Digital/wapi-weaver.git "${APP_DIR}"
fi

# Restaurar .env do backup
if [ -f /tmp/wapi-weaver-env-backup ]; then
  echo "  Restaurando .env do backup..."
  cp /tmp/wapi-weaver-env-backup "${APP_DIR}/.env"
  rm -f /tmp/wapi-weaver-env-backup
fi

print_ok "Código da aplicação pronto."

# ---------------------------------------------------------------------------
# 5. Configurar variáveis de ambiente e secrets
# ---------------------------------------------------------------------------
print_step "[5/8] Configurando variáveis de ambiente de produção..."

# Helper: lê valor do .env existente
_env_get() {
  grep "^${1}=" "${APP_DIR}/.env" 2>/dev/null | tail -n 1 | cut -d '=' -f2- | tr -d '"' | tr -d "'" || true
}

# Preservar valores existentes
JWT_SEC=$(_env_get JWT_SECRET)
DB_PASS_ENV=$(_env_get DB_PASSWORD)
DB_ROOT_PASS_ENV=$(_env_get MYSQL_ROOT_PASSWORD)
REDIS_PASS_ENV=$(_env_get REDIS_PASSWORD)
LICENSE_SRV_URL_ENV=$(_env_get LICENSE_SERVER_URL)
LICENSE_APP_ID_ENV=$(_env_get LICENSE_APP_ID)
LICENSE_API_SEC_ENV=$(_env_get LICENSE_API_SECRET)
LICENSE_RL_ENV=$(_env_get LICENSE_ROLE)
MP_ENC_KEY_ENV=$(_env_get MERCADOPAGO_ENCRYPTION_KEY)
SITE_URL_ENV=$(_env_get SITE_URL)
META_APP_SECRET_ENV=$(_env_get META_APP_SECRET)
META_VERIFY_TOKEN_ENV=$(_env_get META_VERIFY_TOKEN)
META_API_VERSION_ENV=$(_env_get META_API_VERSION)
VITE_META_APP_ID_ENV=$(_env_get VITE_META_APP_ID)
VITE_META_CONFIG_ID_ENV=$(_env_get VITE_META_CONFIG_ID)

# Gerar segredos novos apenas se não existirem
[ -n "${JWT_SEC}" ]        || JWT_SEC=$(openssl rand -hex 32)

DB_PASS="${DB_PASS:-${DB_PASS_ENV}}"
[ -n "${DB_PASS}" ]        || DB_PASS=$(openssl rand -hex 16)

DB_ROOT_PASS="${DB_ROOT_PASS_ENV:-}"
[ -n "${DB_ROOT_PASS}" ]   || DB_ROOT_PASS=$(openssl rand -hex 16)

REDIS_PASS="${REDIS_PASS_ENV:-}"
[ -n "${REDIS_PASS}" ]     || REDIS_PASS=$(openssl rand -hex 16)

LICENSE_SRV_URL="${LICENSE_SRV_URL:-${LICENSE_SRV_URL_ENV}}"
[ -n "${LICENSE_SRV_URL}" ] || LICENSE_SRV_URL="https://admin.blivcrm.com"

LICENSE_APP_ID="${LICENSE_APP_ID:-${LICENSE_APP_ID_ENV}}"
[ -n "${LICENSE_APP_ID}" ]  || LICENSE_APP_ID="meu-saas"

LICENSE_API_SEC="${LICENSE_API_SEC:-${LICENSE_API_SEC_ENV}}"
[ -n "${LICENSE_API_SEC}" ] || LICENSE_API_SEC="segredo-compartilhado-entre-saas-e-painel"

LICENSE_RL="${LICENSE_RL:-${LICENSE_RL_ENV}}"
[ -n "${LICENSE_RL}" ]      || LICENSE_RL="saas"

# ── Mercado Pago: preserva chave existente ou gera nova (AES-256 = 32 bytes = 64 hex) ──
MP_ENC_KEY="${MP_ENC_KEY_ENV:-}"
[ -n "${MP_ENC_KEY}" ]      || MP_ENC_KEY=$(openssl rand -hex 32)

# ── SITE_URL: usa o informado, depois o existente no .env, depois deriva do domínio ──
SITE_URL="${SITE_URL:-${SITE_URL_ENV:-${PROTOCOL}://${DOMAIN}}}"

# ── Meta/WhatsApp: preserva existentes ──────────────────────────────────────
META_APP_SECRET="${META_APP_SECRET_ENV:-}"
META_VERIFY_TOKEN="${META_VERIFY_TOKEN_ENV:-WAPI_WEAVER_VERIFY_TOKEN}"
META_API_VERSION="${META_API_VERSION_ENV:-v20.0}"
VITE_META_APP_ID="${VITE_META_APP_ID_ENV:-}"
VITE_META_CONFIG_ID="${VITE_META_CONFIG_ID_ENV:-}"

# Escrever .env completo
cat > "${APP_DIR}/.env" <<EOF
# ─── Banco de Dados ────────────────────────────────────────────────────────
DB_HOST=banco-mysql
DB_PORT=3306
DB_USER=wapi_user
DB_PASSWORD=${DB_PASS}
DB_NAME=wapi_weaver
MYSQL_ROOT_PASSWORD=${DB_ROOT_PASS}

# ─── Segurança da Aplicação ────────────────────────────────────────────────
JWT_SECRET=${JWT_SEC}

# ─── URL Pública ────────────────────────────────────────────────────────────
APP_URL=${SITE_URL}
SITE_URL=${SITE_URL}

# ─── Credenciais do Administrador (usadas no seed inicial) ─────────────────
ADMIN_EMAIL=${ADMIN_EMAIL:-}
ADMIN_PASSWORD=${ADMIN_PASSWORD:-}

# ─── Redis ─────────────────────────────────────────────────────────────────
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=${REDIS_PASS}

# ─── Licenciamento ─────────────────────────────────────────────────────────
LICENSE_SERVER_URL=${LICENSE_SRV_URL}
LICENSE_APP_ID=${LICENSE_APP_ID}
LICENSE_API_SECRET=${LICENSE_API_SEC}
LICENSE_ROLE=${LICENSE_RL}

# ─── Mercado Pago / Billing ────────────────────────────────────────────────
# Chave AES-256-GCM para criptografar credenciais MP salvas no banco de dados.
# NUNCA compartilhe ou altere esta chave após configurar credenciais MP no painel.
# As credenciais MP (access_token, client_secret etc.) são configuradas
# via /licenses → Gateway de Pagamento, NÃO via este arquivo.
MERCADOPAGO_ENCRYPTION_KEY=${MP_ENC_KEY}

# ─── Integração Meta/WhatsApp ─────────────────────────────────────────────
VITE_META_APP_ID=${VITE_META_APP_ID}
VITE_META_CONFIG_ID=${VITE_META_CONFIG_ID}
META_APP_SECRET=${META_APP_SECRET}
META_VERIFY_TOKEN=${META_VERIFY_TOKEN}
META_API_VERSION=${META_API_VERSION}
EOF

print_ok ".env configurado."
print_info "MERCADOPAGO_ENCRYPTION_KEY gerada e gravada em ${APP_DIR}/.env"
print_info "As credenciais MP são configuradas via painel em /licenses → Gateway de Pagamento."

# ---------------------------------------------------------------------------
# 6. Build e inicialização via Docker Compose
# ---------------------------------------------------------------------------
print_step "[6/8] Fazendo build da aplicação e subindo os containers..."

cd "${APP_DIR}"

docker compose down --remove-orphans || true

export DOCKER_BUILDKIT=1
docker compose build --no-cache

docker compose up -d

# ── Aguardar MySQL (60s máx) ────────────────────────────────────────────────
echo ""
echo "  Aguardando o MySQL estar pronto (máx. 60s)..."
MYSQL_READY=0
for attempt in $(seq 1 30); do
  if docker compose exec -T banco-mysql mysqladmin ping -u root -p"${DB_ROOT_PASS}" --silent >/dev/null 2>&1; then
    MYSQL_READY=1
    print_ok "MySQL pronto."
    break
  fi
  echo "  Aguardando banco... tentativa ${attempt}/30"
  sleep 2
done

if [ "$MYSQL_READY" -eq 1 ]; then
  echo "  Alinhando usuário 'wapi_user' e permissões..."
  docker compose exec -T banco-mysql mysql -u root -p"${DB_ROOT_PASS}" -e "
    CREATE USER IF NOT EXISTS 'wapi_user'@'%' IDENTIFIED WITH mysql_native_password BY '${DB_PASS}';
    ALTER USER 'wapi_user'@'%' IDENTIFIED WITH mysql_native_password BY '${DB_PASS}';
    GRANT ALL PRIVILEGES ON wapi_weaver.* TO 'wapi_user'@'%';
    FLUSH PRIVILEGES;
  " || echo "  Aviso: Não foi possível atualizar permissões. Prosseguindo..."

  echo "  Reiniciando container da aplicação para reconectar ao banco..."
  docker compose restart app
else
  print_error "MySQL não ficou pronto a tempo."
  echo "  Verifique: docker compose logs banco-mysql"
  exit 1
fi

# ── Aguardar aplicação (120s máx) ───────────────────────────────────────────
echo ""
echo "  Aguardando a aplicação inicializar (máx. 120s)..."
APP_READY=0
for attempt in $(seq 1 24); do
  STATUS=$(docker compose ps app 2>/dev/null || true)
  if echo "$STATUS" | grep -Eq "(Up|running)" && ! echo "$STATUS" | grep -qi "restarting"; then
    APP_READY=1
    print_ok "Container da aplicação rodando."
    break
  fi
  echo "  App iniciando... tentativa ${attempt}/24"
  sleep 5
done

# ── Aplicar schema completo (ensure-schema.js) ──────────────────────────────
echo ""
print_step "  Aplicando schema do banco de dados (tabelas + billing + seed)..."
echo ""
print_info "O ensure-schema.js cria ou migra todas as tabelas:"
print_info "  users, contacts, direct_messages, funnels, kanban_stages,"
print_info "  billing_plans, subscriptions, billing_invoices, billing_payments,"
print_info "  payment_gateway_settings, webhook_events, subscription_events,"
print_info "  notifications, e todas as demais tabelas do sistema."
print_info "Também faz seeding automático dos 4 planos padrão (mensal, trimestral,"
print_info "semestral, anual) na primeira instalação."
echo ""

SCHEMA_OK=0
if [ "$APP_READY" -eq 1 ]; then
  if docker compose exec -T app node scripts/ensure-schema.js; then
    SCHEMA_OK=1
    print_ok "Schema aplicado e validado com sucesso."
  fi
else
  # Tenta mesmo com app instável
  echo "  App ainda instável; tentando aplicar schema diretamente..."
  if docker compose exec -T app node scripts/ensure-schema.js 2>/dev/null; then
    SCHEMA_OK=1
    print_ok "Schema aplicado."
  fi
fi

if [ "$SCHEMA_OK" -eq 0 ]; then
  print_error "Falha ao aplicar o schema. Verifique os logs:"
  echo "    docker compose logs app"
  echo "    docker compose logs banco-mysql"
  echo ""
  echo "  Você pode tentar manualmente após corrigir o problema:"
  echo "    cd ${APP_DIR} && docker compose exec app node scripts/ensure-schema.js"
  exit 1
fi

# ── Status dos containers ───────────────────────────────────────────────────
echo ""
docker compose ps | grep -qE "wapi_weaver_app.*(Up|running)"   && print_ok "wapi_weaver_app:   RUNNING" || print_error "wapi_weaver_app:   FALHOU"
docker compose ps | grep -qE "wapi_weaver_mysql.*(Up|running)" && print_ok "wapi_weaver_mysql: RUNNING" || print_error "wapi_weaver_mysql: FALHOU"
docker compose ps | grep -qE "wapi_weaver_redis.*(Up|running)" && print_ok "wapi_weaver_redis: RUNNING" || true

# ---------------------------------------------------------------------------
# 7. Configurar Nginx como reverse proxy
# ---------------------------------------------------------------------------
print_step "[7/8] Configurando Nginx como reverse proxy..."

cat > /etc/nginx/sites-available/wapi-weaver <<NGINXEOF
server {
    listen 80;
    server_name ${DOMAIN};

    # Segurança básica
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header X-XSS-Protection "1; mode=block";

    # Upload e timeout
    proxy_read_timeout    180s;
    proxy_connect_timeout 60s;
    client_max_body_size  25M;

    # Let's Encrypt challenge
    location /.well-known/acme-challenge/ {
        root /var/www/html;
        allow all;
    }

    # ── Webhook Mercado Pago — endpoint PRINCIPAL ─────────────────────────
    # Registre esta URL no painel MP: Integrações > Webhooks
    location /api/webhooks/mercadopago {
        proxy_pass http://127.0.0.1:3003;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 30s;
    }

    # ── Webhook Mercado Pago — endpoint ALTERNATIVO (Edge Function fallback) ──
    # URL alternativa: ${SITE_URL}/functions/v1/mercadopago-webhook
    location /functions/v1/mercadopago-webhook {
        proxy_pass http://127.0.0.1:3003;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 30s;
    }

    # ── Tráfego geral ─────────────────────────────────────────────────────
    location / {
        proxy_pass http://127.0.0.1:3003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/wapi-weaver /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

nginx -t && systemctl restart nginx
print_ok "Nginx configurado e reiniciado."

# ── SSL com Let's Encrypt ───────────────────────────────────────────────────
if [ "${INSTALL_SSL:-n}" = "s" ]; then
  echo ""
  print_step "  Instalando certificado SSL com Let's Encrypt..."
  if [ -n "${SSL_EMAIL:-}" ]; then
    certbot --authenticator webroot --installer nginx \
      -w /var/www/html -d "$DOMAIN" \
      --non-interactive --agree-tos --email "$SSL_EMAIL" --redirect
  else
    certbot --authenticator webroot --installer nginx \
      -w /var/www/html -d "$DOMAIN" \
      --non-interactive --agree-tos --register-unsafely-without-email --redirect
  fi
  print_ok "SSL instalado. HTTPS habilitado para ${DOMAIN}."
  systemctl enable certbot.timer || true
fi

# ── Firewall ───────────────────────────────────────────────────────────────
if command -v ufw &>/dev/null; then
  ufw allow 22/tcp  >/dev/null 2>&1 || true
  ufw allow 80/tcp  >/dev/null 2>&1 || true
  ufw allow 443/tcp >/dev/null 2>&1 || true
  ufw --force enable >/dev/null 2>&1 || true
  print_ok "Firewall (UFW): portas 22, 80 e 443 liberadas."
fi

# ---------------------------------------------------------------------------
# 8. Resumo final
# ---------------------------------------------------------------------------
print_step "[8/8] Instalação finalizada!"

echo ""
echo -e "${GREEN}"
echo "========================================================================"
echo "    INSTALAÇÃO CONCLUÍDA COM SUCESSO!                                   "
echo "========================================================================"
echo -e "${NC}"

echo ""
echo "  🌐 URL da aplicação: ${SITE_URL}"
echo ""
echo "  ✅ O que foi instalado e configurado:"
echo "     • Docker + MySQL + Redis + App Node.js"
echo "     • Schema completo do banco (incluindo todas as tabelas de billing)"
echo "     • 4 planos padrão semeados (Mensal, Trimestral, Semestral, Anual)"
echo "     • Nginx como reverse proxy com rotas de webhook Mercado Pago"
echo "     • MERCADOPAGO_ENCRYPTION_KEY gerada automaticamente"
echo ""
echo "  🔑 Próximos passos obrigatórios:"
echo "     1. Acesse ${SITE_URL} e crie sua conta de administrador."
echo "     2. Vá em: /licenses → aba 'Gateway de Pagamento'"
echo "        e configure suas credenciais do Mercado Pago."
echo ""
echo "  📡 URLs de Webhook para cadastrar no painel do Mercado Pago:"
echo "     (Integrações → Webhooks → Evento: payment)"
echo ""
echo "     Principal:   ${SITE_URL}/api/webhooks/mercadopago"
echo "     Alternativa: ${SITE_URL}/functions/v1/mercadopago-webhook"
echo ""
echo "  📋 Comandos úteis:"
echo "     Logs da app:    cd ${APP_DIR} && docker compose logs -f app"
echo "     Logs do MySQL:  cd ${APP_DIR} && docker compose logs -f banco-mysql"
echo "     Aplicar schema: cd ${APP_DIR} && docker compose exec app node scripts/ensure-schema.js"
echo "     Reiniciar:      cd ${APP_DIR} && docker compose restart"
echo "     Parar:          cd ${APP_DIR} && docker compose down"
echo "     Atualizar:      cd ${APP_DIR} && git pull && docker compose up -d --build"
echo "                     && docker compose exec app node scripts/ensure-schema.js"
echo ""
echo "  ⚠️  Guarde em local seguro (disponíveis em ${APP_DIR}/.env):"
echo "     DB_PASSWORD, JWT_SECRET, MERCADOPAGO_ENCRYPTION_KEY"
echo ""
echo "========================================================================"
