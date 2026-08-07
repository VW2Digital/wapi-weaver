#!/usr/bin/env bash
# ==============================================================================
# INSTALADOR DE PRODUÇÃO - BLIV CRM / WAPI WEAVER
# ==============================================================================
# Alvo: Ubuntu 20.04 / 22.04 / 24.04 LTS / Debian 11+
# Uso:  sudo bash install.sh [opções]
# ==============================================================================

set -Eeuo pipefail

LOG_FILE="/var/log/blivcrm-install.log"
exec > >(tee -a "${LOG_FILE}") 2>&1

# Cores para terminal
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

APP_DIR="/var/www/wapi-weaver"
COMPOSE_FILE="docker-compose.production.yml"

UPDATE_MODE=0
FRESH_DATABASE=0
FORCE_CLONE=0
CONFIGURE_SSL_ONLY=0
ENABLE_PHPMYADMIN="n"
DATABASE_DUMP=""

error_handler() {
  local exit_code=$1
  local line_number=$2
  local command="$3"
  echo ""
  echo -e "${RED}=====================================================${NC}"
  echo -e "${RED} ❌ ERRO CRÍTICO NA INSTALAÇÃO${NC}"
  echo -e "${RED} Linha: ${line_number} | Código de erro: ${exit_code}${NC}"
  echo -e "${RED} Comando que falhou: ${command}${NC}"
  echo -e "${RED} Consulte o log detalhado em: ${LOG_FILE}${NC}"
  echo -e "${RED}=====================================================${NC}"
  exit "${exit_code}"
}

trap 'error_handler $? $LINENO "$BASH_COMMAND"' ERR

show_usage() {
  cat <<EOF
Uso: sudo bash install.sh [opções]

Opções:
  --update                Atualiza o código da aplicação, roda migrações e reinicia os serviços.
  --fresh-database        Faz backup prévio e recria o banco de dados do zero.
  --database-dump=ARQUIVO Restaura um arquivo de dump (.sql ou .sql.gz) no banco.
  --force-clone           Força o download limpo do código do GitHub.
  --configure-ssl         Executa apenas a emissão/configuração do certificado SSL Let's Encrypt.
  -h, --help              Exibe esta ajuda.
EOF
}

# Processar argumentos da linha de comando
for arg in "$@"; do
  case "$arg" in
    --update)
      UPDATE_MODE=1
      ;;
    --fresh-database)
      FRESH_DATABASE=1
      ;;
    --force-clone|-f)
      FORCE_CLONE=1
      ;;
    --configure-ssl)
      CONFIGURE_SSL_ONLY=1
      ;;
    --database-dump=*)
      DATABASE_DUMP="${arg#*=}"
      FRESH_DATABASE=1
      ;;
    -h|--help)
      show_usage
      exit 0
      ;;
    *)
      echo "Opção desconhecida: $arg"
      show_usage
      exit 1
      ;;
  esac
done

print_header() {
  echo -e "${GREEN}"
  echo "=========================================================="
  echo "         BLIV CRM / WAPI WEAVER - INSTALADOR DE PRODUÇÃO  "
  echo "=========================================================="
  echo -e "${NC}"
}

print_step() {
  echo ""
  echo -e "${BLUE}==>${NC} ${GREEN}$1${NC}"
}

print_ok() {
  echo -e "  ${GREEN}✓ $1${NC}"
}

print_warn() {
  echo -e "  ${YELLOW}⚠️ $1${NC}"
}

print_error() {
  echo -e "  ${RED}❌ $1${NC}"
}

# ---------------------------------------------------------------------------
# 0. Verificação de permissões e ambiente básico
# ---------------------------------------------------------------------------
print_header

if [ "$(id -u)" -ne 0 ]; then
  print_error "Este script precisa ser executado como root (use: sudo bash install.sh)."
  exit 1
fi

# Se for apenas configuração de SSL
if [ "$CONFIGURE_SSL_ONLY" -eq 1 ]; then
  print_step "Executando apenas configuração de SSL Let's Encrypt..."
  if [ ! -f "${APP_DIR}/.env" ]; then
    print_error "Arquivo .env não encontrado em ${APP_DIR}."
    exit 1
  fi
  DOMAIN=$(grep '^CORS_ALLOWED_ORIGINS=' "${APP_DIR}/.env" 2>/dev/null | cut -d '=' -f2- | sed 's|https://||g' | tr -d '"' | tr -d "'" || true)
  if [ -z "$DOMAIN" ]; then
    read -p "Digite o domínio para emissão do SSL: " DOMAIN
  fi
  read -p "Digite o e-mail para avisos do SSL: " SSL_EMAIL
  certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m "${SSL_EMAIL}" --redirect || true
  systemctl reload nginx || true
  print_ok "SSL configurado."
  exit 0
fi

# ---------------------------------------------------------------------------
# 1. Coleta interativa de parâmetros (Instalação Nova ou Update)
# ---------------------------------------------------------------------------
print_step "[1/8] Coletando parâmetros de configuração..."

DOMAIN=""
ADMIN_EMAIL=""
ADMIN_PASSWORD=""
SSL_EMAIL=""

if [ "$UPDATE_MODE" -eq 0 ]; then
  # 1.1 Domínio
  while true; do
    if [ -f "${APP_DIR}/.env" ]; then
      DOMAIN_ENV=$(grep '^CORS_ALLOWED_ORIGINS=' "${APP_DIR}/.env" 2>/dev/null | cut -d '=' -f2- | sed 's|https://||g' | tr -d '"' | tr -d "'" || true)
      if [ -n "$DOMAIN_ENV" ]; then
        DOMAIN="$DOMAIN_ENV"
      fi
    fi
    if [ -z "$DOMAIN" ]; then
      read -p "Digite o domínio da aplicação (ex: app.seudominio.com): " DOMAIN
    fi
    DOMAIN=$(echo "$DOMAIN" | tr '[:upper:]' '[:lower:]' | sed 's|https://||g' | sed 's|http://||g' | tr -d '/' | xargs)
    if [ -n "$DOMAIN" ]; then
      break
    else
      print_error "Domínio inválido. Tente novamente."
      DOMAIN=""
    fi
  done

  # 1.2 E-mail do Admin Master
  while true; do
    if [ -f "${APP_DIR}/.env" ]; then
      ADMIN_EMAIL_ENV=$(grep '^ADMIN_EMAIL=' "${APP_DIR}/.env" 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'" || true)
      if [ -n "$ADMIN_EMAIL_ENV" ]; then
        ADMIN_EMAIL="$ADMIN_EMAIL_ENV"
      fi
    fi
    if [ -z "$ADMIN_EMAIL" ]; then
      read -p "Digite o E-mail do Administrador Master: " ADMIN_EMAIL
    fi
    ADMIN_EMAIL=$(echo "$ADMIN_EMAIL" | tr '[:upper:]' '[:lower:]' | xargs)
    if [[ "$ADMIN_EMAIL" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
      break
    else
      print_error "E-mail inválido. Tente novamente."
      ADMIN_EMAIL=""
    fi
  done

  # 1.3 Senha do Admin Master
  while true; do
    if [ -z "$ADMIN_PASSWORD" ]; then
      echo -n "Digite a senha do Administrador Master (mínimo 6 caracteres): "
      read -s ADMIN_PASSWORD
      echo ""
    fi
    ADMIN_PASSWORD=$(echo "$ADMIN_PASSWORD" | xargs)
    if [ ${#ADMIN_PASSWORD} -ge 6 ]; then
      break
    else
      print_error "A senha deve conter no mínimo 6 caracteres."
      ADMIN_PASSWORD=""
    fi
  done

  # 1.4 E-mail para SSL Let's Encrypt
  while true; do
    read -p "Digite o e-mail para cadastro no SSL Let's Encrypt: " SSL_EMAIL
    SSL_EMAIL=$(echo "$SSL_EMAIL" | tr '[:upper:]' '[:lower:]' | xargs)
    if [[ "$SSL_EMAIL" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
      break
    else
      print_error "E-mail de SSL inválido. Tente novamente."
      SSL_EMAIL=""
    fi
  done

  # 1.5 phpMyAdmin opcional
  read -p "Deseja habilitar o phpMyAdmin interno? (s/N): " ENABLE_PHPMYADMIN
  ENABLE_PHPMYADMIN=$(echo "$ENABLE_PHPMYADMIN" | tr '[:upper:]' '[:lower:]' | xargs)

fi

# ---------------------------------------------------------------------------
# 2. Verificação de memória e swap
# ---------------------------------------------------------------------------
print_step "[2/8] Verificando recursos do sistema (RAM e Swap)..."

TOTAL_RAM=$(free -m | awk '/^Mem:/{print $2}')
TOTAL_SWAP=$(free -m | awk '/^Swap:/{print $2}')
echo "  RAM total: ${TOTAL_RAM}MB | Swap atual: ${TOTAL_SWAP}MB"

if [ "$TOTAL_SWAP" -lt 3000 ]; then
  print_warn "Swap abaixo de 3GB. Configurando swapfile de 4GB para garantir builds seguros..."
  swapoff /swapfile 2>/dev/null || true
  rm -f /swapfile
  fallocate -l 4G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=4096
  chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q "/swapfile" /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  print_ok "Swapfile de 4GB configurado com sucesso."
else
  print_ok "Memória suficiente."
fi

# ---------------------------------------------------------------------------
# 3. Instalando dependências do sistema e Firewall
# ---------------------------------------------------------------------------
print_step "[3/8] Instalando dependências do sistema e configurando Firewall..."

apt-get update -y -qq
apt-get install -y -qq curl git nginx certbot python3-certbot-nginx rsync ufw dnsutils

# Configurar UFW com segurança
echo "  Configurando regras do UFW (liberando apenas SSH 22, HTTP 80, HTTPS 443)..."
ufw allow 22/tcp >/dev/null 2>&1 || true
ufw allow 80/tcp >/dev/null 2>&1 || true
ufw allow 443/tcp >/dev/null 2>&1 || true
ufw --force enable >/dev/null 2>&1 || true
print_ok "Firewall UFW habilitado com segurança (portas 3306, 6379 e 3003 mantidas privadas)."

# Instalar Docker Engine oficial
if ! command -v docker &>/dev/null; then
  echo "  Instalando Docker Engine..."
  curl -fsSL https://get.docker.com | bash
  systemctl enable docker
  systemctl start docker
  print_ok "Docker Engine instalado."
else
  print_ok "Docker já instalado: $(docker --version)"
fi

# Instalar Docker Compose Plugin v2
if ! docker compose version &>/dev/null 2>&1; then
  echo "  Instalando Docker Compose Plugin v2..."
  apt-get install -y -qq docker-compose-plugin || true
fi

if docker compose version &>/dev/null 2>&1; then
  print_ok "Docker Compose v2 pronto: $(docker compose version)"
else
  print_error "Docker Compose Plugin v2 não está disponível."
  exit 1
fi

# ---------------------------------------------------------------------------
# 4. Preparar e Sincronizar código da aplicação via Git (origin/main)
# ---------------------------------------------------------------------------
print_step "[4/8] Sincronizando código-fonte estritamente a partir do GitHub (origin/main)..."

mkdir -p /var/www

if [ ! -d "${APP_DIR}/.git" ]; then
  echo "  Executando git clone inicial da branch main..."
  rm -rf "${APP_DIR}"
  git clone --branch main https://github.com/VW2Digital/wapi-weaver.git "${APP_DIR}"
  cd "${APP_DIR}"
else
  cd "${APP_DIR}"
  echo "  Verificando modificações locais descartáveis em ${APP_DIR}..."
  LOCAL_MODS=$(git status --porcelain --untracked-files=no || echo "")
  if [ -n "${LOCAL_MODS}" ]; then
    print_warn "Modificações locais em arquivos rastreados detectadas na VPS (serão descartadas):"
    echo "${LOCAL_MODS}"
  fi

  echo "  Sincronizando com origin/main (git fetch & reset --hard)..."
  git fetch origin main
  git checkout main
  git reset --hard origin/main
  git clean -fd
fi

# Validação estrita do Commit SHA
EXPECTED_SHA=$(git rev-parse origin/main)
LOCAL_SHA=$(git rev-parse HEAD)

echo "  Commit local (HEAD):   ${LOCAL_SHA}"
echo "  Commit origin/main:  ${EXPECTED_SHA}"

if [ "${LOCAL_SHA}" != "${EXPECTED_SHA}" ]; then
  print_error "FALHA: HEAD local (${LOCAL_SHA}) difere de origin/main (${EXPECTED_SHA})."
  exit 1
fi

UNTRACKED_DIRTY=$(git status --porcelain --untracked-files=no)
if [ -n "${UNTRACKED_DIRTY}" ]; then
  print_error "FALHA: Working tree rastreado não está limpo após reset:"
  echo "${UNTRACKED_DIRTY}"
  exit 1
fi

# Salvar o SHA implantado no arquivo .deploy-version
DEPLOYED_AT_ISO=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
cat > "${APP_DIR}/.deploy-version" <<VERSIONEOF
GIT_BRANCH=main
GIT_SHA=${LOCAL_SHA}
DEPLOYED_AT=${DEPLOYED_AT_ISO}
VERSIONEOF
chmod 644 "${APP_DIR}/.deploy-version"

print_ok "Código-fonte 100% alinhado com origin/main. Commit implantado: ${LOCAL_SHA}"

# ---------------------------------------------------------------------------
# 5. Configurar variáveis de ambiente e secrets no .env
# ---------------------------------------------------------------------------
print_step "[5/8] Gerando segredos e configurando o arquivo .env..."

ENV_FILE="${APP_DIR}/.env"

# Carregar ou gerar segredos únicos (sem reutilização de senhas)
JWT_SECRET_VAL=$(grep '^JWT_SECRET=' "${ENV_FILE}" 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'" || true)
[ -n "${JWT_SECRET_VAL}" ] || JWT_SECRET_VAL=$(openssl rand -hex 32)

MYSQL_ROOT_PASS_VAL=$(grep '^MYSQL_ROOT_PASSWORD=' "${ENV_FILE}" 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'" || true)
[ -n "${MYSQL_ROOT_PASS_VAL}" ] || MYSQL_ROOT_PASS_VAL=$(openssl rand -hex 24)

DB_PASS_VAL=$(grep '^DB_PASSWORD=' "${ENV_FILE}" 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'" || true)
[ -n "${DB_PASS_VAL}" ] || DB_PASS_VAL=$(openssl rand -hex 24)

REDIS_PASS_VAL=$(grep '^REDIS_PASSWORD=' "${ENV_FILE}" 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'" || true)
[ -n "${REDIS_PASS_VAL}" ] || REDIS_PASS_VAL=$(openssl rand -hex 24)

MP_ENC_KEY_VAL=$(grep '^MERCADOPAGO_ENCRYPTION_KEY=' "${ENV_FILE}" 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'" || true)
[ -n "${MP_ENC_KEY_VAL}" ] || MP_ENC_KEY_VAL=$(openssl rand -hex 32)

# Gravar o arquivo .env
cat > "${ENV_FILE}" <<EOF
# Configuração do Banco de Dados (MySQL)
DB_HOST="mysql"
DB_PORT="3306"
DB_USER="wapi_user"
DB_PASSWORD="${DB_PASS_VAL}"
DB_NAME="wapi_weaver"
MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASS_VAL}"

# Configuração de Cache e Filas (Redis)
REDIS_HOST="redis"
REDIS_PORT="6379"
REDIS_PASSWORD="${REDIS_PASS_VAL}"

# Segurança e Runtime
JWT_SECRET="${JWT_SECRET_VAL}"
NODE_ENV="production"
PORT=3000
MERCADOPAGO_ENCRYPTION_KEY="${MP_ENC_KEY_VAL}"

# Domínio e CORS
APP_URL="https://${DOMAIN}"
CORS_ALLOWED_ORIGINS="https://${DOMAIN}"

# Administrador Master
ADMIN_EMAIL="${ADMIN_EMAIL}"
ADMIN_PASSWORD="${ADMIN_PASSWORD}"
EOF

chmod 600 "${ENV_FILE}"
print_ok "Arquivo .env gerado e protegido (chmod 600)."

# ---------------------------------------------------------------------------
# 6. Subir a Stack Docker Compose e aplicar Migrações
# ---------------------------------------------------------------------------
print_step "[6/8] Inicializando a stack Docker e aplicando migrações..."

# Se houver backup prévio antes do fresh install
if [ "$FRESH_DATABASE" -eq 1 ] && [ -f "${APP_DIR}/scripts/backup.sh" ]; then
  print_warn "Executando backup prévio de segurança do banco..."
  bash "${APP_DIR}/scripts/backup.sh" || true
fi

# Definir se phpMyAdmin deve rodar
COMPOSE_PROFILE_FLAG=""
if [[ "${ENABLE_PHPMYADMIN}" == "s" ]]; then
  COMPOSE_PROFILE_FLAG="--profile phpmyadmin"
fi

# Build e inicialização dos containers com injeção do Commit SHA
echo "  Executando build da aplicação (sem cache antigo) e inicialização dos serviços..."
APP_GIT_SHA="${LOCAL_SHA}" APP_GIT_BRANCH="main" docker compose -f "${COMPOSE_FILE}" ${COMPOSE_PROFILE_FLAG} build --pull
APP_GIT_SHA="${LOCAL_SHA}" APP_GIT_BRANCH="main" docker compose -f "${COMPOSE_FILE}" ${COMPOSE_PROFILE_FLAG} up -d

echo "  Aguardando inicialização do banco MySQL..."
MYSQL_READY=0
for i in $(seq 1 30); do
  if docker compose -f "${COMPOSE_FILE}" exec -T mysql mysqladmin ping -u wapi_user -p"${DB_PASS_VAL}" --silent >/dev/null 2>&1; then
    MYSQL_READY=1
    print_ok "MySQL está pronto!"
    break
  fi
  sleep 2
done

if [ "$MYSQL_READY" -ne 1 ]; then
  print_error "MySQL não estabilizou a tempo."
  exit 1
fi

# Importação de Dump se fornecido
if [ -n "$DATABASE_DUMP" ] && [ -f "$DATABASE_DUMP" ]; then
  print_step "Importando dump do banco de dados (${DATABASE_DUMP})..."
  if [[ "$DATABASE_DUMP" == *.gz ]]; then
    gunzip -c "$DATABASE_DUMP" | docker compose -f "${COMPOSE_FILE}" exec -T mysql mysql -u wapi_user -p"${DB_PASS_VAL}" wapi_weaver
  else
    docker compose -f "${COMPOSE_FILE}" exec -T mysql mysql -u wapi_user -p"${DB_PASS_VAL}" wapi_weaver < "$DATABASE_DUMP"
  fi
  print_ok "Dump do banco importado com sucesso."
fi

# Executar Migrações de Banco de Dados
echo "  Executando migrações de banco de dados..."
docker compose -f "${COMPOSE_FILE}" exec -T app node scripts/migrate.js

# Provisionar Administrador Master
echo "  Provisionando Administrador Master (${ADMIN_EMAIL})..."
docker compose -f "${COMPOSE_FILE}" exec -T app node scripts/provision-admin.js

# Validar Instalação
echo "  Executando validador automatizado pós-instalação..."
docker compose -f "${COMPOSE_FILE}" exec -T app node scripts/validate-installation.js

print_ok "Stack de containers e banco de dados validados com sucesso."

# ---------------------------------------------------------------------------
# 7. Configuração do Nginx e SSL Let's Encrypt
# ---------------------------------------------------------------------------
print_step "[7/8] Configurando Nginx Reverse Proxy e SSL..."

NGINX_CONF="/etc/nginx/sites-available/wapi-weaver"
cat > "${NGINX_CONF}" <<NGINXEOF
server {
    listen 80;
    server_name ${DOMAIN};

    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header X-XSS-Protection "1; mode=block";

    proxy_read_timeout 120s;
    proxy_connect_timeout 120s;
    client_max_body_size 50M;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
        allow all;
    }

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

ln -sf "${NGINX_CONF}" /etc/nginx/sites-enabled/wapi-weaver
rm -f /etc/nginx/sites-enabled/default || true

if nginx -t; then
  systemctl reload nginx
  print_ok "Nginx reconfigurado e testado com sucesso."
else
  print_error "Falha no teste sintático do Nginx. A configuração anterior foi preservada."
  exit 1
fi

# Checar apontamento DNS antes de emitir SSL
print_step "Verificando resolução de DNS para ${DOMAIN}..."
VPS_IP=$(curl -s -4 ifconfig.me || curl -s -4 icanhazip.com || echo "")
RESOLVED_IP=$(dig +short "${DOMAIN}" | tail -n1 || echo "")

if [ -n "$VPS_IP" ] && [ "$VPS_IP" == "$RESOLVED_IP" ]; then
  echo "  DNS resolvido corretamente para o IP da VPS (${VPS_IP}). Emitindo certificado SSL..."
  certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m "${SSL_EMAIL}" --redirect || print_warn "Falha ao emitir SSL com Certbot."
  systemctl reload nginx || true
  print_ok "Certificado SSL configurado com sucesso."
else
  print_warn "O domínio '${DOMAIN}' (IP: ${RESOLVED_IP:-não resolvido}) ainda não aponta para o IP desta VPS (${VPS_IP})."
  print_warn "A aplicação está instalada via HTTP. Após atualizar o DNS no seu provedor, execute:"
  print_warn "  sudo bash install.sh --configure-ssl"
fi

# ---------------------------------------------------------------------------
# 8. Validação de Saúde Final
# ---------------------------------------------------------------------------
print_step "[8/8] Executando validação de saúde final..."

sleep 3

# Testar se o Nginx responde em HTTP
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:3003" || echo "000")
if [[ "$HTTP_STATUS" =~ ^(200|301|302|404)$ ]]; then
  print_ok "Aplicação respondendo na porta 3003 (Status: ${HTTP_STATUS})."
else
  print_error "Aplicação não respondeu na porta 3003 (Status: ${HTTP_STATUS})."
  exit 1
fi

echo ""
echo -e "${GREEN}============================================================"
echo " BLIV CRM / WAPI WEAVER - INSTALADO COM SUCESSO"
echo "============================================================${NC}"
echo ""
echo -e "  🌐 Aplicação:       https://${DOMAIN}"
echo -e "  👤 Admin Master:    ${ADMIN_EMAIL}"
echo ""
echo -e "  Serviços:"
echo -e "    ✓ MySQL (Porta 3306 Privada)"
echo -e "    ✓ Redis (Porta 6379 Privada)"
echo -e "    ✓ BLIV CRM (127.0.0.1:3003)"
echo -e "    ✓ Nginx Reverse Proxy (Portas 80/443)"
echo -e "    ✓ Administrador Master Provisionado"
echo -e "    ✓ Banco de Dados e Migrações Validadas"
echo -e "    ✓ Autenticação HTTP Validada"
echo ""
echo -e "  📋 Comandos Úteis:"
echo -e "     Status da Stack:  cd ${APP_DIR} && docker compose -f ${COMPOSE_FILE} ps"
echo -e "     Ver Logs do App:  docker logs -f wapi_weaver_app"
echo -e "     Gerar Backup BD:  sudo bash ${APP_DIR}/scripts/backup.sh"
echo -e "     Restaurar BD:     sudo bash ${APP_DIR}/scripts/restore.sh /caminho/dump.sql"
echo -e "     Atualizar CRM:    sudo bash ${APP_DIR}/install.sh --update"
echo "============================================================"

chmod +x "${APP_DIR}/install.sh"
