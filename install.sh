#!/usr/bin/env bash
# ==============================================================================
# INSTALADOR AUTOMATIZADO - DISPARADOR WAPI WEAVER (DOCKER COMPOSE)
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
  echo "    INSTALADOR OFICIAL - DISPARADOR WAPI WEAVER (DOCKER + NGINX + SSL)  "
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
print_step "[1/7] Coletando parâmetros de configuração..."

# ── Variáveis interativas ───────────────────────────────────────────────────

if [ -z "${DOMAIN:-}" ]; then
  read -p "Digite o domínio da aplicação (ex: wapi.vw2digital.com.br): " DOMAIN
  if [ -z "$DOMAIN" ]; then
    echo -e "${RED}Erro: O domínio é obrigatório.${NC}"
    exit 1
  fi
fi

if [ -z "${INSTALL_SSL:-}" ]; then
  read -p "Deseja instalar SSL com Let's Encrypt? (s/n): " INSTALL_SSL
fi

if [ -z "${SSL_EMAIL:-}" ] && { [ "$INSTALL_SSL" = "s" ] || [ "$INSTALL_SSL" = "S" ]; }; then
  read -p "Digite o e-mail para o SSL (ex: adm@vw2digital.com.br): " SSL_EMAIL
fi

# Define CORS dinamicamente com base no domínio
CORS_ORIGIN="https://${DOMAIN}"
if [ "${INSTALL_SSL}" != "s" ] && [ "${INSTALL_SSL}" != "S" ]; then
  CORS_ORIGIN="http://${DOMAIN}"
fi

echo ""
echo "  Domínio: $DOMAIN"
echo "  CORS:    $CORS_ORIGIN"
echo "  SSL:     ${INSTALL_SSL:-n}"
echo ""
print_ok "Parâmetros carregados."

# ---------------------------------------------------------------------------
# 2. Verificar/configurar swap (essencial para VPS com pouca RAM no build)
# ---------------------------------------------------------------------------
print_step "[2/7] Verificando memória e swap..."

TOTAL_RAM=$(free -m | awk '/^Mem:/{print $2}')
TOTAL_SWAP=$(free -m | awk '/^Swap:/{print $2}')
echo "  RAM: ${TOTAL_RAM}MB | Swap atual: ${TOTAL_SWAP}MB"

if [ "$TOTAL_SWAP" -lt 3000 ]; then
  echo "  Swap insuficiente para o build (mínimo de 3GB recomendado). Criando swap de 4GB..."
  swapoff /swapfile 2>/dev/null || true
  rm -f /swapfile
  fallocate -l 4G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=4096
  chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q "/swapfile" /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  print_ok "Swap de 4GB configurado (total agora: $(free -m | awk '/^Swap:/{print $2}')MB)."
else
  print_ok "Memória suficiente (RAM: ${TOTAL_RAM}MB, Swap: ${TOTAL_SWAP}MB)."
fi

# ---------------------------------------------------------------------------
# 3. Instalar dependências do sistema
# ---------------------------------------------------------------------------
print_step "[3/7] Instalando dependências do sistema (Docker, Nginx, Certbot)..."

apt-get update -y -qq

# Nginx e Certbot
apt-get install -y -qq curl git nginx certbot python3-certbot-nginx rsync

# Docker Engine (método oficial)
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
  apt-get install -y -qq docker-compose-plugin
  print_ok "Docker Compose instalado."
else
  print_ok "Docker Compose já instalado: $(docker compose version)"
fi

# ---------------------------------------------------------------------------
# 4. Preparar código da aplicação
# ---------------------------------------------------------------------------
print_step "[4/7] Preparando código da aplicação em ${APP_DIR}..."

mkdir -p /var/www

# Se estamos rodando de dentro do diretório do projeto, copiar. Senão, clonar.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -f "${SCRIPT_DIR}/docker-compose.yml" ]; then
  echo "  Copiando arquivos locais para ${APP_DIR}..."
  rsync -a --delete \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='dist' \
    "${SCRIPT_DIR}/" "${APP_DIR}/"
else
  echo "  Clonando repositório para ${APP_DIR}..."
  rm -rf "${APP_DIR}"
  git clone https://github.com/VW2Digital/wapi-weaver.git "${APP_DIR}"
fi

print_ok "Código da aplicação pronto."

# ---------------------------------------------------------------------------
# 5. Configurar variáveis de ambiente e secrets
# ---------------------------------------------------------------------------
print_step "[5/7] Configurando variáveis de ambiente de produção..."

# Criar .env se não existir
if [ ! -f "${APP_DIR}/.env" ]; then
  echo "  Gerando .env com segredos seguros..."
  JWT_SEC=$(openssl rand -hex 32)
  DB_PASS=$(openssl rand -hex 16)
  DB_ROOT_PASS=$(openssl rand -hex 16)
  
  cat > "${APP_DIR}/.env" <<EOF
DB_HOST=banco-mysql
DB_PORT=3306
DB_USER=wapi_user
DB_PASSWORD=${DB_PASS}
DB_NAME=wapi_weaver
JWT_SECRET=${JWT_SEC}
EOF
  
  # Atualiza também no docker-compose.yml as senhas do container MySQL
  sed -i "s/MYSQL_ROOT_PASSWORD: .*/MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASS}/" "${APP_DIR}/docker-compose.yml"
  sed -i "s/MYSQL_PASSWORD: .*/MYSQL_PASSWORD: ${DB_PASS}/" "${APP_DIR}/docker-compose.yml"
  sed -i "s/DB_PASSWORD=.*/DB_PASSWORD=${DB_PASS}/" "${APP_DIR}/docker-compose.yml"
  sed -i "s/JWT_SECRET=.*/JWT_SECRET=${JWT_SEC}/" "${APP_DIR}/docker-compose.yml"
else
  echo "  Arquivo .env já existe, mantendo configurações."
fi

print_ok "Configurações aplicadas."

# ---------------------------------------------------------------------------
# 6. Build e inicialização via Docker Compose
# ---------------------------------------------------------------------------
print_step "[6/7] Fazendo build da aplicação e subindo os containers..."

cd "${APP_DIR}"

docker compose down --remove-orphans || true

# Build da imagem da aplicação
export DOCKER_BUILDKIT=1
docker compose build --no-cache

# Subir todos os serviços em background
docker compose up -d

echo ""
echo "  Aguardando a aplicação inicializar (healthcheck do MySQL pode levar ~30s)..."
sleep 35

# Verificar se os containers estão rodando
if docker compose ps | grep -q "wapi_weaver_app.*Up\|wapi_weaver_app.*running"; then
  print_ok "Container da aplicação está rodando!"
else
  print_error "Container da aplicação pode não ter iniciado corretamente."
  echo "  Verifique os logs com: docker compose logs app"
fi

if docker compose ps | grep -q "wapi_weaver_mysql.*Up\|wapi_weaver_mysql.*running"; then
  print_ok "Container do MySQL está rodando!"
else
  print_error "Container do MySQL pode não ter iniciado corretamente."
  echo "  Verifique os logs com: docker compose logs banco-mysql"
fi

# ---------------------------------------------------------------------------
# 7. Configurar Nginx como reverse proxy
# ---------------------------------------------------------------------------
print_step "[7/7] Configurando Nginx como reverse proxy..."

cat > /etc/nginx/sites-available/wapi-weaver <<NGINXEOF
server {
    listen 80;
    server_name ${DOMAIN};

    # Segurança básica
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header X-XSS-Protection "1; mode=block";

    # Aumentar timeout para uploads/APIs lentas
    proxy_read_timeout 120s;
    proxy_connect_timeout 120s;

    # Todo o tráfego vai para o container Node/Vite na porta 3000
    location / {
        proxy_pass http://127.0.0.1:3000;
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

# SSL com Let's Encrypt
if [ "${INSTALL_SSL:-n}" = "s" ] || [ "${INSTALL_SSL:-n}" = "S" ]; then
  echo ""
  print_step "  Instalando certificado SSL com Let's Encrypt..."
  if [ -n "${SSL_EMAIL:-}" ]; then
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "$SSL_EMAIL" --redirect
  else
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect
  fi
  print_ok "SSL instalado! HTTPS habilitado para ${DOMAIN}."

  # Renovação automática já é configurada pelo certbot, mas garantir o timer
  systemctl enable certbot.timer || true
fi

# Firewall
if command -v ufw &>/dev/null; then
  ufw allow 22/tcp  >/dev/null 2>&1 || true
  ufw allow 80/tcp  >/dev/null 2>&1 || true
  ufw allow 443/tcp >/dev/null 2>&1 || true
  ufw --force enable >/dev/null 2>&1 || true
fi

# ---------------------------------------------------------------------------
# Finalização
# ---------------------------------------------------------------------------
echo ""
echo -e "${GREEN}"
echo "========================================================================"
echo "    INSTALAÇÃO CONCLUÍDA COM SUCESSO!                                   "
echo "========================================================================"
echo -e "${NC}"

PROTOCOL="http"
[ "${INSTALL_SSL:-n}" = "s" ] || [ "${INSTALL_SSL:-n}" = "S" ] && PROTOCOL="https"

echo ""
echo "  🌐 URL da aplicação: ${PROTOCOL}://${DOMAIN}"
echo ""
echo "  🔑 Credenciais de acesso padrão:"
echo "     Acesse o domínio e crie sua conta de administrador local."
echo ""
echo "  📋 Comandos úteis:"
echo "     Ver logs da aplicação:  cd ${APP_DIR} && docker compose logs -f app"
echo "     Ver logs do MySQL:      cd ${APP_DIR} && docker compose logs -f banco-mysql"
echo "     Reiniciar tudo:         cd ${APP_DIR} && docker compose restart"
echo "     Parar tudo:             cd ${APP_DIR} && docker compose down"
echo "     Atualizar aplicação:    cd ${APP_DIR} && git pull && docker compose up -d --build"
echo ""
echo "========================================================================"
