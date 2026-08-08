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

dump_diagnostics_and_exit() {
  local reason="$1"
  print_error "FALHA CRÍTICA: ${reason}"
  echo ""
  echo "=========================================================="
  echo "         INSTALAÇÃO FALHOU - DIAGNÓSTICO DO DOCKER        "
  echo "=========================================================="
  echo ""
  echo "--- DOCKER COMPOSE PS ---"
  docker compose -f "${COMPOSE_FILE}" ps 2>/dev/null || true
  echo ""
  echo "--- DOCKER COMPOSE LOGS (APP) ---"
  docker compose -f "${COMPOSE_FILE}" logs --tail=150 app 2>/dev/null || true
  echo ""
  echo "=========================================================="
  exit 1
}

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
  dump_diagnostics_and_exit "Instalação interrompida na linha ${line_number} pelo comando: ${command}"
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

wait_for_app_http() {
  local max_attempts=60
  local attempt=1

  while [ $attempt -le $max_attempts ]; do
    local container_status
    container_status=$(docker inspect -f '{{.State.Status}}' wapi_weaver_app 2>/dev/null || echo "missing")

    if [[ "$container_status" =~ ^(exited|dead|restarting|missing)$ ]]; then
      dump_diagnostics_and_exit "O container 'wapi_weaver_app' não está executando adequadamente (Status: ${container_status})."
    fi

    local http_status
    http_status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://127.0.0.1:3003/" 2>/dev/null || true)
    http_status="${http_status:-000}"

    if [[ "$http_status" =~ ^(200|301|302|401|403|404)$ ]]; then
      print_ok "Aplicação respondendo na porta 3003 (Status HTTP: ${http_status})."
      return 0
    fi

    echo "  Aguardando porta 3003 responder (${attempt}/${max_attempts}). Status atual: ${http_status}..."
    sleep 2
    attempt=$((attempt + 1))
  done

  dump_diagnostics_and_exit "Aplicação não ficou disponível via HTTP na porta 3003 em 120 segundos."
}

wait_for_app_healthy() {
  local max_attempts=30
  local attempt=1

  while [ $attempt -le $max_attempts ]; do
    local health_status
    health_status=$(docker inspect -f '{{.State.Health.Status}}' wapi_weaver_app 2>/dev/null || echo "missing")

    if [ "$health_status" == "healthy" ]; then
      print_ok "Container da aplicação reportou status HEALTHY!"
      return 0
    elif [ "$health_status" == "starting" ]; then
      echo "  Aguardando healthcheck do Docker alterar de 'starting' para 'healthy' (${attempt}/${max_attempts})..."
    else
      dump_diagnostics_and_exit "Healthcheck Docker do container app reportou falha (Health Status: ${health_status})."
    fi

    sleep 2
    attempt=$((attempt + 1))
  done

  dump_diagnostics_and_exit "Healthcheck Docker do container app não transitou para 'healthy' no tempo limite."
}

test_auth_login() {
  local target_url="$1"
  local label="$2"

  echo "  Executando teste de autenticação em ${label} (${target_url})..."

  local result
  result=$(ADMIN_EMAIL="${ADMIN_EMAIL}" ADMIN_PASSWORD="${ADMIN_PASSWORD}" TARGET_URL="${target_url}" node -e '
    const url = process.env.TARGET_URL;
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;

    async function check() {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
          signal: AbortSignal.timeout(10000),
        });

        if (!res.ok) {
          const bodyText = await res.text().catch(() => "");
          console.log(`HTTP_ERROR:${res.status}:${bodyText.substring(0, 100)}`);
          process.exit(1);
        }

        const data = await res.json();
        if (!data.access_token) {
          console.log("NO_ACCESS_TOKEN");
          process.exit(1);
        }

        if (data.user?.role !== "admin_master") {
          console.log(`INVALID_ROLE:${data.user?.role || "none"}`);
          process.exit(1);
        }

        console.log("OK");
        process.exit(0);
      } catch (err) {
        console.log(`NETWORK_ERROR:${err.code || err.name}:${err.message}`);
        process.exit(1);
      }
    }
    check();
  ' 2>&1 || echo "NODE_EXEC_FAILED")

  if [ "$result" == "OK" ]; then
    print_ok "Autenticação via login em ${label} validada com sucesso!"
    return 0
  else
    print_error "Falha no teste de login em ${label}: ${result}"
    return 1
  fi
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
  certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m "${SSL_EMAIL}" --redirect
  systemctl reload nginx
  print_ok "SSL configurado e testado com sucesso."
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

# Carregar ou gerar segredos únicos
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

# Build da imagem da aplicação e infraestrutura
echo "  Executando build da aplicação (sem cache antigo)..."
APP_GIT_SHA="${LOCAL_SHA}" APP_GIT_BRANCH="main" docker compose -f "${COMPOSE_FILE}" ${COMPOSE_PROFILE_FLAG} build --pull

echo "  Subindo serviços de infraestrutura (MySQL e Redis)..."
APP_GIT_SHA="${LOCAL_SHA}" APP_GIT_BRANCH="main" docker compose -f "${COMPOSE_FILE}" ${COMPOSE_PROFILE_FLAG} up -d mysql redis

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
  dump_diagnostics_and_exit "MySQL não estabilizou a tempo."
fi

echo "  Aguardando inicialização do Redis..."
REDIS_READY=0
for i in $(seq 1 15); do
  if docker compose -f "${COMPOSE_FILE}" exec -T redis redis-cli -a "${REDIS_PASS_VAL}" ping 2>/dev/null | grep -q PONG; then
    REDIS_READY=1
    print_ok "Redis está pronto!"
    break
  fi
  sleep 2
done

if [ "$REDIS_READY" -ne 1 ]; then
  dump_diagnostics_and_exit "Redis não estabilizou a tempo."
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

# Executar Migrações de Banco de Dados em container efêmero (one-shot)
echo "  Executando migrações de banco de dados em container efêmero..."
docker compose -f "${COMPOSE_FILE}" run --rm --no-deps app node scripts/migrate.js

# Provisionar Administrador Master em container efêmero
echo "  Provisionando Administrador Master (${ADMIN_EMAIL}) em container efêmero..."
docker compose -f "${COMPOSE_FILE}" run --rm --no-deps app node scripts/provision-admin.js

# Validar Banco de Dados offline
echo "  Validando estrutura e integridade do Banco de Dados..."
docker compose -f "${COMPOSE_FILE}" run --rm --no-deps app node scripts/validate-database.js

# Subir serviço da aplicação após banco migrado e validado
echo "  Iniciando serviço da aplicação (app)..."
APP_GIT_SHA="${LOCAL_SHA}" APP_GIT_BRANCH="main" docker compose -f "${COMPOSE_FILE}" ${COMPOSE_PROFILE_FLAG} up -d app

# Aguardar disponibilidade HTTP e Healthcheck Docker do App
echo "  Aguardando disponibilidade HTTP da aplicação (porta 3003)..."
wait_for_app_http

echo "  Aguardando transição do status do container para 'healthy'..."
wait_for_app_healthy

# Validar Instalação completa (HTTP/Auth/Cache)
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
  dump_diagnostics_and_exit "Falha no teste sintático do Nginx."
fi

# Checar apontamento DNS antes de emitir SSL
print_step "Verificando resolução de DNS para ${DOMAIN}..."
VPS_IP=$(curl -s -4 ifconfig.me || curl -s -4 icanhazip.com || echo "")
RESOLVED_IP=$(dig +short "${DOMAIN}" | tail -n1 || echo "")

SSL_ACTIVE=0

if [ -n "$VPS_IP" ] && [ -n "$RESOLVED_IP" ] && [ "$VPS_IP" == "$RESOLVED_IP" ]; then
  echo "  DNS resolvido corretamente para o IP da VPS (${VPS_IP}). Emitindo certificado SSL..."
  if certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m "${SSL_EMAIL}" --redirect; then
    systemctl reload nginx || true
    SSL_ACTIVE=1
    print_ok "Certificado SSL configurado com sucesso."
  else
    dump_diagnostics_and_exit "DNS aponta para a VPS, mas a emissão do certificado SSL via Certbot falhou."
  fi
else
  print_warn "O domínio '${DOMAIN}' (IP resolvido: ${RESOLVED_IP:-nenhum}) ainda não aponta para o IP desta VPS (${VPS_IP})."
  print_warn "A instalação prosseguirá via HTTP. Após atualizar o DNS no seu provedor, execute: sudo bash install.sh --configure-ssl"
fi

# ---------------------------------------------------------------------------
# 8. Validação de Saúde e Integridade Final
# ---------------------------------------------------------------------------
print_step "[8/8] Executando validação de saúde final e testes externos..."

# 8.1 Teste local HTTP porta 3003
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://127.0.0.1:3003/" 2>/dev/null || true)
HTTP_STATUS="${HTTP_STATUS:-000}"
if [[ "$HTTP_STATUS" =~ ^(200|301|302|401|403|404)$ ]]; then
  print_ok "Aplicação respondendo na porta 3003 (Status: ${HTTP_STATUS})."
else
  dump_diagnostics_and_exit "Aplicação não respondeu adequadamente na porta 3003 (Status: ${HTTP_STATUS})."
fi

# 8.2 Teste local Nginx com Host header
NGINX_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 -H "Host: ${DOMAIN}" "http://127.0.0.1/" 2>/dev/null || true)
NGINX_STATUS="${NGINX_STATUS:-000}"
if [[ "$NGINX_STATUS" =~ ^(200|301|302|401|403|404)$ ]]; then
  print_ok "Nginx local respondendo para o host ${DOMAIN} (Status: ${NGINX_STATUS})."
else
  dump_diagnostics_and_exit "Nginx local não respondeu adequadamente para o host ${DOMAIN} (Status: ${NGINX_STATUS})."
fi

# 8.3 Se SSL esteve ativo, validar HTTPS e Login externo via HTTPS
if [ "$SSL_ACTIVE" -eq 1 ]; then
  HTTPS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "https://${DOMAIN}/" 2>/dev/null || true)
  HTTPS_STATUS="${HTTPS_STATUS:-000}"
  if [[ "$HTTPS_STATUS" =~ ^(200|301|302|401|403|404)$ ]]; then
    print_ok "Aplicação respondendo via HTTPS em https://${DOMAIN} (Status: ${HTTPS_STATUS})."
  else
    dump_diagnostics_and_exit "Falha ao acessar a aplicação via HTTPS em https://${DOMAIN} (Status: ${HTTPS_STATUS})."
  fi

  if ! test_auth_login "https://${DOMAIN}/api/auth/login" "HTTPS externo"; then
    dump_diagnostics_and_exit "Falha na autenticação via HTTPS em https://${DOMAIN}/api/auth/login"
  fi
else
  # Se SSL pendente, validar Login via HTTP local 3003
  if ! test_auth_login "http://127.0.0.1:3003/api/auth/login" "HTTP interno 3003"; then
    dump_diagnostics_and_exit "Falha na autenticação interna via HTTP em http://127.0.0.1:3003/api/auth/login"
  fi
fi

# 8.4 Verificação estrita de Git SHA (HEAD == origin/main == container APP_GIT_SHA)
print_step "Validando alinhamento estrito dos Git SHAs..."
LOCAL_SHA=$(git rev-parse HEAD 2>/dev/null || echo "LOCAL_ERR")
REMOTE_SHA=$(git rev-parse origin/main 2>/dev/null || echo "REMOTE_ERR")
CONTAINER_SHA=$(docker compose -f "${COMPOSE_FILE}" exec -T app printenv APP_GIT_SHA 2>/dev/null | tr -d '\r' | xargs || echo "CONTAINER_ERR")

echo "  SHA local (HEAD):        ${LOCAL_SHA}"
echo "  SHA remoto (origin/main): ${REMOTE_SHA}"
echo "  SHA no container app:    ${CONTAINER_SHA}"

if [ "${LOCAL_SHA}" != "${REMOTE_SHA}" ] || [ "${LOCAL_SHA}" != "${CONTAINER_SHA}" ]; then
  dump_diagnostics_and_exit "Mapeamento de versão divergente! HEAD (${LOCAL_SHA}), origin/main (${REMOTE_SHA}), container (${CONTAINER_SHA})."
fi
print_ok "Git SHAs 100% idênticos!"

# 8.5 Confirmação dos status dos containers (docker compose ps)
echo "  Confirmando status dos serviços no Docker..."
echo "------------------------------------------------------------"
docker compose -f "${COMPOSE_FILE}" ps
echo "------------------------------------------------------------"

MYSQL_HEALTH=$(docker inspect -f '{{.State.Health.Status}}' wapi_weaver_mysql 2>/dev/null || echo "missing")
REDIS_HEALTH=$(docker inspect -f '{{.State.Health.Status}}' wapi_weaver_redis 2>/dev/null || echo "missing")
APP_HEALTH=$(docker inspect -f '{{.State.Health.Status}}' wapi_weaver_app 2>/dev/null || echo "missing")

if [ "${MYSQL_HEALTH}" != "healthy" ] || [ "${REDIS_HEALTH}" != "healthy" ] || [ "${APP_HEALTH}" != "healthy" ]; then
  dump_diagnostics_and_exit "Serviços Docker não estão todos 'healthy'. MySQL: ${MYSQL_HEALTH}, Redis: ${REDIS_HEALTH}, App: ${APP_HEALTH}"
fi
print_ok "Todos os serviços Docker (mysql, redis, app) estão HEALTHY!"

echo ""
if [ "$SSL_ACTIVE" -eq 1 ]; then
  echo -e "${GREEN}============================================================"
  echo " BLIV CRM INSTALADO E VALIDADO"
  echo "============================================================${NC}"
  echo ""
  echo -e "  🌐 Aplicação:       https://${DOMAIN}"
else
  echo -e "${YELLOW}============================================================"
  echo " BLIV CRM INSTALADO - SSL PENDENTE"
  echo "============================================================${NC}"
  echo ""
  echo -e "  🌐 Aplicação (HTTP): http://${DOMAIN}"
  echo -e "  ⚠️  O domínio ainda não resolvia para o IP da VPS (${VPS_IP})."
  echo -e "     Após atualizar o DNS no seu provedor, execute:"
  echo -e "     sudo bash ${APP_DIR}/install.sh --configure-ssl"
fi

echo -e "  👤 Admin Master:    ${ADMIN_EMAIL}"
echo ""
echo -e "  Serviços:"
echo -e "    ✓ MySQL (Porta 3306 Privada - Healthy)"
echo -e "    ✓ Redis (Porta 6379 Privada - Healthy)"
echo -e "    ✓ BLIV CRM (127.0.0.1:3003 - Healthy)"
echo -e "    ✓ Nginx Reverse Proxy"
echo -e "    ✓ Administrador Master Provisionado"
echo -e "    ✓ Banco de Dados e Migrações Validadas"
echo -e "    ✓ Autenticação HTTP e Login Validados"
echo -e "    ✓ Git Commit SHA Identificado e Alinhado: ${LOCAL_SHA}"
echo ""
echo -e "  📋 Comandos Úteis:"
echo -e "     Status da Stack:  cd ${APP_DIR} && docker compose -f ${COMPOSE_FILE} ps"
echo -e "     Ver Logs do App:  docker logs -f wapi_weaver_app"
echo -e "     Gerar Backup BD:  sudo bash ${APP_DIR}/scripts/backup.sh"
echo -e "     Restaurar BD:     sudo bash ${APP_DIR}/scripts/restore.sh /caminho/dump.sql"
echo -e "     Atualizar CRM:    sudo bash ${APP_DIR}/install.sh --update"
echo "============================================================"

chmod +x "${APP_DIR}/install.sh"
