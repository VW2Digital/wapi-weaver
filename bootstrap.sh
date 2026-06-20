#!/usr/bin/env bash
# ==============================================================================
# BOOTSTRAP DE DEPLOY — DISPARADOR WAPI WEAVER
# Clona do GitHub e aplica todas as configurações de produção automaticamente
# Uso: bash <(curl -fsSL URL_DESTE_SCRIPT)
#   ou copiar e colar diretamente no terminal da VPS
# ==============================================================================

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
print_ok()    { echo -e "${GREEN}✔ $1${NC}"; }
print_step()  { echo -e "${YELLOW}▶ $1${NC}"; }
print_error() { echo -e "${RED}✘ $1${NC}"; exit 1; }

echo -e "${GREEN}"
echo "════════════════════════════════════════════════════════════════"
echo "   BOOTSTRAP DE DEPLOY — DISPARADOR WAPI WEAVER (VW2 Digital)   "
echo "════════════════════════════════════════════════════════════════"
echo -e "${NC}"

[ "$EUID" -ne 0 ] && print_error "Execute como root: sudo bash bootstrap.sh"

# ── Configurações de produção ─────────────────────────────────────────────────
REPO_URL="https://github.com/VW2Digital/wapi-weaver.git"
APP_DIR="/var/www/wapi-weaver"
DOMAIN="wapi.vw2digital.com.br"
CORS_ORIGIN="https://wapi.vw2digital.com.br"
INSTALL_SSL="s"
SSL_EMAIL="adm@vw2digital.com.br"

# Secrets gerados criptograficamente (únicos para esta instalação)
JWT_SECRET=$(openssl rand -hex 64)
DB_PASSWORD=$(openssl rand -hex 16)
DB_ROOT_PASSWORD=$(openssl rand -hex 16)
# ─────────────────────────────────────────────────────────────────────────────

# 1. Memória / Swap
print_step "[1/8] Verificando memória..."
TOTAL_RAM=$(free -m | awk '/^Mem:/{print $2}')
TOTAL_SWAP=$(free -m | awk '/^Swap:/{print $2}')
echo "  RAM: ${TOTAL_RAM}MB | Swap atual: ${TOTAL_SWAP}MB"

if [ "$TOTAL_SWAP" -lt 3000 ]; then
  echo "  Swap insuficiente para o build. Criando swap de 4GB..."
  swapoff /swapfile 2>/dev/null || true
  rm -f /swapfile
  fallocate -l 4G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=4096
  chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q "/swapfile" /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  print_ok "Swap de 4GB configurado (total agora: $(free -m | awk '/^Swap:/{print $2}')MB)."
else
  print_ok "Swap OK (${TOTAL_SWAP}MB disponíveis)."
fi

# 2. Dependências do sistema
print_step "[2/8] Instalando dependências (Docker, Nginx, Certbot, Git)..."
apt-get update -y -qq
apt-get install -y -qq curl git nginx certbot python3-certbot-nginx rsync

if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | bash
  systemctl enable docker && systemctl start docker
fi

if ! docker compose version &>/dev/null 2>&1; then
  apt-get install -y -qq docker-compose-plugin
fi
print_ok "Dependências instaladas."

# 3. Clonar repositório do GitHub
print_step "[3/8] Clonando repositório do GitHub..."
rm -rf "${APP_DIR}"
git clone "${REPO_URL}" "${APP_DIR}"
print_ok "Repositório clonado em ${APP_DIR}."

# 4. Aplicar docker-compose.yml de produção com secrets seguros
print_step "[4/8] Aplicando configurações de produção no docker-compose.yml..."
cat > "${APP_DIR}/docker-compose.yml" <<COMPOSEFILE
services:
  banco-mysql:
    image: mysql:8.0
    container_name: wapi_weaver_mysql
    restart: always
    command: --default-authentication-plugin=mysql_native_password --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci --innodb-buffer-pool-size=256M --innodb-log-file-size=64M
    environment:
      MYSQL_DATABASE: wapi_weaver
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}
      MYSQL_USER: wapi_user
      MYSQL_PASSWORD: ${DB_PASSWORD}
    volumes:
      - mysql_data:/var/lib/mysql
      - ./schema_mysql.sql:/docker-entrypoint-initdb.d/1-schema.sql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "root", "-p${DB_ROOT_PASSWORD}"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 30s

  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: wapi_weaver_app
    restart: always
    ports:
      - "3000:3000"
    environment:
      - DB_HOST=banco-mysql
      - DB_PORT=3306
      - DB_USER=wapi_user
      - DB_PASSWORD=${DB_PASSWORD}
      - DB_NAME=wapi_weaver
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      banco-mysql:
        condition: service_healthy

volumes:
  mysql_data:
COMPOSEFILE
print_ok "docker-compose.yml de produção gerado."

# 5. Criar arquivo .env correspondente para uso local/scripts
print_step "[5/8] Criando arquivo .env de produção..."
cat > "${APP_DIR}/.env" <<ENVFILE
DB_HOST=banco-mysql
DB_PORT=3306
DB_USER=wapi_user
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=wapi_weaver
JWT_SECRET=${JWT_SECRET}
ENVFILE
print_ok ".env configurado."

# 6. Build e inicialização via Docker Compose
print_step "[6/8] Fazendo build e subindo os containers..."
cd "${APP_DIR}"
export DOCKER_BUILDKIT=1
docker compose down --remove-orphans || true
docker compose build --no-cache
docker compose up -d

echo "  Aguardando healthcheck do MySQL (~35s)..."
sleep 35

docker compose check_running_app=$(docker compose ps | grep -q "wapi_weaver_app.*Up\|wapi_weaver_app.*running" && print_ok "App rodando!" || echo "⚠ Verifique: docker compose logs app")
docker compose check_running_db=$(docker compose ps | grep -q "wapi_weaver_mysql.*Up\|wapi_weaver_mysql.*running" && print_ok "MySQL rodando!" || echo "⚠ Verifique: docker compose logs banco-mysql")

# 7. Configurar Nginx
print_step "[7/8] Configurando Nginx como reverse proxy..."
cat > /etc/nginx/sites-available/wapi-weaver <<NGINXEOF
server {
    listen 80;
    server_name ${DOMAIN};

    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header X-XSS-Protection "1; mode=block";
    proxy_read_timeout 120s;
    proxy_connect_timeout 120s;

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
print_ok "Nginx configurado."

# 8. SSL com Let's Encrypt
print_step "[8/8] Instalando certificado SSL..."
if [ "${INSTALL_SSL}" = "s" ]; then
  certbot --nginx -d "${DOMAIN}" \
    --non-interactive --agree-tos \
    --email "${SSL_EMAIL}" --redirect && \
    print_ok "SSL instalado! HTTPS habilitado." || \
    echo -e "${YELLOW}⚠ SSL falhou — confirme que o DNS ${DOMAIN} aponta para este servidor e tente: certbot --nginx -d ${DOMAIN}${NC}"
fi

# Firewall
if command -v ufw &>/dev/null; then
  ufw allow 22/tcp  >/dev/null 2>&1 || true
  ufw allow 80/tcp  >/dev/null 2>&1 || true
  ufw allow 443/tcp >/dev/null 2>&1 || true
  ufw --force enable >/dev/null 2>&1 || true
fi

# Conclusão
echo ""
echo -e "${GREEN}"
echo "════════════════════════════════════════════════════════════════"
echo "   INSTALAÇÃO CONCLUÍDA COM SUCESSO!                          "
echo "════════════════════════════════════════════════════════════════"
echo -e "${NC}"
echo "  🌐  https://${DOMAIN}"
echo ""
echo "  🔑  Crie seu usuário administrador no painel."
echo ""
echo "  📋  Comandos úteis:"
echo "      Logs app:   cd ${APP_DIR} && docker compose logs -f app"
echo "      Logs MySQL: cd ${APP_DIR} && docker compose logs -f banco-mysql"
echo "      Status:     cd ${APP_DIR} && docker compose ps"
echo "      Reiniciar:  cd ${APP_DIR} && docker compose restart"
echo "════════════════════════════════════════════════════════════════"
