#!/usr/bin/env bash
# ==============================================================================
# INSTALADOR AUTOMATIZADO - WAPI WEAVER (VPS + DOCKER COMPOSE)
# ==============================================================================
# Alvo: Ubuntu 20.04 / 22.04 / 24.04 LTS
# ==============================================================================

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}"
echo "========================================================================"
echo "    INSTALADOR OFICIAL - WAPI WEAVER (VPS + DOCKER + MYSQL)             "
echo "========================================================================"
echo "  Propriedade Intelectual: VW2 Digital. Todos os direitos reservados.   "
echo "                                                                        "
echo "  AVISO: Esta aplicação é de propriedade exclusiva da VW2 Digital.      "
echo "  A empresa NÃO se responsabiliza pelo uso indevido, abusivo ou ilegal   "
echo "  deste software realizado por terceiros ou clientes.                    "
echo "========================================================================"
echo -e "${NC}"

# Verificar se roda como root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Erro: Por favor, execute este script como root (sudo bash)${NC}"
  exit 1
fi

# 1. Carregar variáveis de ambiente ou solicitar interativamente
echo -e "${YELLOW}[1/8] Validando parâmetros de entrada...${NC}"

# Tentar carregar configurações existentes do .env e Nginx para atualização
APP_DIR="/var/www/wapi-weaver"
ENV_FILE="${APP_DIR}/.env"
NGINX_FILE="/etc/nginx/sites-available/wapi-weaver"

EXISTING_DOMAIN=""
EXISTING_DB_PASSWORD=""
EXISTING_JWT_SECRET=""
EXISTING_SSL_EMAIL=""
EXISTING_INSTALL_SSL="n"

if [ -f "$ENV_FILE" ]; then
  echo -e "${YELLOW}Instalação anterior detectada em $APP_DIR. Carregando configurações...${NC}"
  EXISTING_DB_PASSWORD=$(grep -E "^DB_PASSWORD=" "$ENV_FILE" | cut -d'=' -f2- | xargs)
  EXISTING_JWT_SECRET=$(grep -E "^JWT_SECRET=" "$ENV_FILE" | cut -d'=' -f2- | xargs)
  
  if [ -f "$NGINX_FILE" ]; then
    EXISTING_DOMAIN=$(grep -E "server_name" "$NGINX_FILE" | head -n 1 | sed 's/^[[:space:]]*server_name[[:space:]]*//' | sed 's/;.*//' | xargs)
    if grep -q "listen 443" "$NGINX_FILE" 2>/dev/null; then
      EXISTING_INSTALL_SSL="s"
    fi
  fi
  
  echo -e "${GREEN}Configurações encontradas:${NC}"
  echo "- Domínio: $EXISTING_DOMAIN"
  echo "- SSL Ativo: $EXISTING_INSTALL_SSL"
  echo "- Senha do Banco: ********"
  echo ""
  read -p "Deseja reutilizar estas configurações para atualizar? (S/n): " REUSE_CONF
  REUSE_CONF=$(echo "$REUSE_CONF" | tr '[:upper:]' '[:lower:]' | xargs)
  
  if [[ -z "$REUSE_CONF" || "$REUSE_CONF" == "s" ]]; then
    DB_PASSWORD="$EXISTING_DB_PASSWORD"
    JWT_SECRET="$EXISTING_JWT_SECRET"
    echo -e "${GREEN}Configurações base (Banco/JWT) carregadas. O domínio e SSL serão confirmados a seguir.${NC}"
  fi
fi

# Validador de Domínio
while true; do
  if [ -z "${DOMAIN:-}" ]; then
    if [ -n "$EXISTING_DOMAIN" ]; then
      read -p "Digite o domínio da aplicação [$EXISTING_DOMAIN]: " DOMAIN
      DOMAIN="${DOMAIN:-$EXISTING_DOMAIN}"
    else
      read -p "Digite o domínio da aplicação: " DOMAIN
    fi
  fi
  DOMAIN=$(echo "$DOMAIN" | xargs)
  if [[ "$DOMAIN" =~ ^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
    break
  else
    echo -e "${RED}Erro: Domínio inválido. Digite um domínio válido.${NC}"
    DOMAIN=""
  fi
done

# Validador de SSL
while true; do
  if [ -z "${INSTALL_SSL:-}" ]; then
    if [ -n "$EXISTING_INSTALL_SSL" ]; then
      read -p "Deseja instalar SSL com Let's Encrypt? (s/n) [$EXISTING_INSTALL_SSL]: " INSTALL_SSL
      INSTALL_SSL="${INSTALL_SSL:-$EXISTING_INSTALL_SSL}"
    else
      read -p "Deseja instalar SSL com Let's Encrypt? (s/n): " INSTALL_SSL
    fi
  fi
  INSTALL_SSL=$(echo "$INSTALL_SSL" | tr '[:upper:]' '[:lower:]' | xargs)
  if [[ "$INSTALL_SSL" == "s" || "$INSTALL_SSL" == "n" ]]; then
    break
  else
    echo -e "${RED}Erro: Opção inválida. Responda apenas com 's' ou 'n'.${NC}"
    INSTALL_SSL=""
  fi
done

# Validador de E-mail do SSL
if [[ "$INSTALL_SSL" == "s" && -z "${SSL_EMAIL:-}" ]]; then
  while true; do
    read -p "Digite o e-mail para o SSL: " SSL_EMAIL
    SSL_EMAIL=$(echo "$SSL_EMAIL" | xargs)
    if [[ "$SSL_EMAIL" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
      break
    else
      echo -e "${RED}Erro: E-mail inválido. Digite um e-mail válido.${NC}"
      SSL_EMAIL=""
    fi
  done
fi

# Validador de Senha do BD
while true; do
  if [ -z "${DB_PASSWORD:-}" ]; then
    if [ -n "$EXISTING_DB_PASSWORD" ]; then
      echo -n "Digite a senha desejada para o banco de dados (deixe vazio para manter a atual): "
      read -s DB_PASSWORD
      echo ""
      DB_PASSWORD="${DB_PASSWORD:-$EXISTING_DB_PASSWORD}"
    else
      echo -n "Digite a senha desejada para o banco de dados: "
      read -s DB_PASSWORD
      echo ""
    fi
  fi
  DB_PASSWORD=$(echo "$DB_PASSWORD" | xargs)
  if [ -z "$DB_PASSWORD" ]; then
    echo -e "${RED}Erro: A senha do banco de dados é obrigatória.${NC}"
  elif [ ${#DB_PASSWORD} -lt 8 ]; then
    echo -e "${RED}Erro: A senha deve ter pelo menos 8 caracteres.${NC}"
    DB_PASSWORD=""
  elif [[ "$DB_PASSWORD" =~ [[:space:]] ]]; then
    echo -e "${RED}Erro: A senha não deve conter espaços.${NC}"
    DB_PASSWORD=""
  else
    break
  fi
done

echo -e "${GREEN}Parâmetros carregados!${NC}"
echo "- Domínio: $DOMAIN"
echo "- SSL: $INSTALL_SSL"
if [[ "$INSTALL_SSL" == "s" && -n "$SSL_EMAIL" ]]; then
  echo "- E-mail do SSL: $SSL_EMAIL"
fi
echo "- Senha do BD: ********"
echo ""

# Verificar e configurar swap se necessário (essencial para VPS com pouca memória)
echo -e "${YELLOW}Verificando swap e memória física...${NC}"
TOTAL_RAM=$(free -m | awk '/^Mem:/{print $2}')
TOTAL_SWAP=$(free -m | awk '/^Swap:/{print $2}')

if [ "$TOTAL_RAM" -lt 2500 ] && [ "$TOTAL_SWAP" -lt 2000 ]; then
  echo -e "${YELLOW}Detectada memória física baixa ($TOTAL_RAM MB) e pouco/nenhum swap ($TOTAL_SWAP MB).${NC}"
  echo -e "${YELLOW}Criando arquivo de swap temporário de 4GB para garantir estabilidade da VPS...${NC}"
  
  if [ -f /swapfile ]; then
    swapoff /swapfile || true
    rm -f /swapfile
  fi
  
  fallocate -l 4G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=4096
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  
  # Adicionar no /etc/fstab se não estiver lá
  if ! grep -q "/swapfile" /etc/fstab; then
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
  fi
  echo -e "${GREEN}Swap de 4GB configurado com sucesso!${NC}"
else
  echo -e "${GREEN}Memória RAM ($TOTAL_RAM MB) e Swap ($TOTAL_SWAP MB) suficientes para o build.${NC}"
fi

# 2. Instalação de Dependências do Sistema
echo -e "${YELLOW}[2/8] Instalando dependências do sistema (Git, Nginx, Docker, Certbot)...${NC}"
apt-get update -y -qq
apt-get install -y -qq curl git nginx certbot python3-certbot-nginx rsync

if ! command -v docker &>/dev/null; then
  echo "Instalando Docker Engine..."
  curl -fsSL https://get.docker.com | bash
  systemctl enable docker
  systemctl start docker
fi

if ! docker compose version &>/dev/null 2>&1; then
  echo "Instalando Docker Compose Plugin..."
  apt-get install -y -qq docker-compose-plugin
fi

echo -e "${GREEN}Dependências instaladas!${NC}"

# 3. Preparando o Código da Aplicação
echo -e "${YELLOW}[3/8] Clonando e preparando o código da aplicação...${NC}"
APP_DIR="/var/www/wapi-weaver"
mkdir -p /var/www

# Fazer backup do arquivo .env se ele existir
if [ -f "${APP_DIR}/.env" ]; then
  echo "Salvando backup do arquivo .env atual..."
  cp "${APP_DIR}/.env" /tmp/wapi-weaver-env-backup
fi

echo "Clonando repositório para ${APP_DIR}..."
cd /var/www
rm -rf "${APP_DIR}"
git clone https://github.com/VW2Digital/wapi-weaver.git "${APP_DIR}"

# Restaurar o arquivo .env do backup
if [ -f /tmp/wapi-weaver-env-backup ]; then
  echo "Restaurando o arquivo .env do backup..."
  cp /tmp/wapi-weaver-env-backup "${APP_DIR}/.env"
  rm -f /tmp/wapi-weaver-env-backup
fi

cd "${APP_DIR}"
echo -e "${GREEN}Código clonado com sucesso!${NC}"

# 4. Criando Segredos e Configurações
echo -e "${YELLOW}[4/8] Gerando chaves de segurança e arquivo .env...${NC}"

if [ -z "${JWT_SECRET:-}" ]; then
  JWT_SECRET=$(openssl rand -hex 64)
fi
DB_ROOT_PASSWORD="$DB_PASSWORD"

# Só criar o .env se ele não existir (caso contrário, o backup restaurou)
if [ ! -f "${APP_DIR}/.env" ]; then
  cat > "${APP_DIR}/.env" <<EOF
DB_HOST=banco-mysql
DB_PORT=3306
DB_USER=wapi_user
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=wapi_weaver
JWT_SECRET=${JWT_SECRET}
EOF
else
  # Garante que a senha e segredos no .env existente coincidam com as variáveis da sessão
  # para que o compose use as variáveis corretas
  echo "Arquivo .env existente preservado."
fi

echo -e "${GREEN}Configurações locais aplicadas!${NC}"

# 5. Aplicar docker-compose de produção
echo -e "${YELLOW}[5/8] Configurando o docker-compose.yml...${NC}"

cat > "${APP_DIR}/docker-compose.yml" <<COMPOSEFILE
services:
  banco-mysql:
    image: mysql:8.0
    container_name: wapi_weaver_mysql
    restart: always
    command: --default-authentication-plugin=mysql_native_password --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci --innodb-buffer-pool-size=256M --innodb-log-file-size=64M
    environment:
      MYSQL_DATABASE: wapi_weaver
      MYSQL_ROOT_PASSWORD: '${DB_ROOT_PASSWORD}'
      MYSQL_USER: wapi_user
      MYSQL_PASSWORD: '${DB_PASSWORD}'
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
    volumes:
      - wapi_weaver_uploads:/app/public/uploads
    depends_on:
      banco-mysql:
        condition: service_healthy

volumes:
  mysql_data:
  wapi_weaver_uploads:
COMPOSEFILE
echo -e "${GREEN}Docker-compose gerado!${NC}"

# 6. Build e Execução dos Containers
echo -e "${YELLOW}[6/8] Fazendo build da aplicação e subindo os serviços (pode demorar alguns minutos)...${NC}"
export DOCKER_BUILDKIT=1
docker compose down --remove-orphans || true
docker compose build --no-cache
docker compose up -d

echo -e "${YELLOW}Aguardando a aplicação inicializar (healthcheck do MySQL)...${NC}"
APP_READY=0
for attempt in $(seq 1 30); do
  if docker compose ps app 2>/dev/null | grep -Eq "(Up|running)" && ! docker compose ps app 2>/dev/null | grep -qi "restarting"; then
    APP_READY=1
    break
  fi
  echo -e "${YELLOW}  App ainda iniciando... tentativa ${attempt}/30${NC}"
  sleep 5
done

if [ "$APP_READY" -eq 1 ]; then
  echo -e "${YELLOW}Aplicando validação automática de schema no banco existente...${NC}"
  if docker compose exec -T app node scripts/ensure-schema.js; then
    echo -e "${GREEN}Schema validado com sucesso!${NC}"
  else
    echo -e "${RED}Erro: Falha ao validar o schema. Verifique os logs usando: docker compose logs app${NC}"
    exit 1
  fi
else
  echo -e "${RED}Erro: O container da aplicação não estabilizou a tempo para rodar a validação do schema.${NC}"
  echo -e "${RED}Verifique os logs usando: docker compose logs app${NC}"
  exit 1
fi

echo -e "${GREEN}Containers rodando com sucesso!${NC}"

# 7. Configurando o Servidor Nginx
echo -e "${YELLOW}[7/8] Configurando Nginx como Reverse Proxy...${NC}"

cat << EOF > /etc/nginx/sites-available/wapi-weaver
server {
    listen 80;
    server_name ${DOMAIN};

    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header X-XSS-Protection "1; mode=block";
    proxy_read_timeout 120s;
    proxy_connect_timeout 120s;
    client_max_body_size 20M;

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
EOF

ln -sf /etc/nginx/sites-available/wapi-weaver /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx

echo -e "${GREEN}Nginx configurado!${NC}"

# 8. SSL com Let's Encrypt
echo -e "${YELLOW}[8/8] Solicitando certificado SSL (se aplicável)...${NC}"
if [ "$INSTALL_SSL" = "s" ] || [ "$INSTALL_SSL" = "S" ]; then
  if [ -n "$SSL_EMAIL" ]; then
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "$SSL_EMAIL" --redirect
  else
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect
  fi
  echo -e "${GREEN}SSL configurado com sucesso! Acesso HTTPS habilitado.${NC}"
fi

# Firewall
if command -v ufw &>/dev/null; then
  ufw allow 22/tcp  >/dev/null 2>&1 || true
  ufw allow 80/tcp  >/dev/null 2>&1 || true
  ufw allow 443/tcp >/dev/null 2>&1 || true
  ufw --force enable >/dev/null 2>&1 || true
fi

# Finalizando
echo -e "${GREEN}"
echo "========================================================================"
echo "    INSTALAÇÃO CONCLUÍDA COM SUCESSO!                                   "
echo "========================================================================"
echo -e "${NC}"
echo "Acesse a aplicação pelo navegador em:"
if [ "$INSTALL_SSL" = "s" ] || [ "$INSTALL_SSL" = "S" ]; then
  echo -e "${GREEN}https://$DOMAIN${NC}"
else
  echo -e "${GREEN}http://$DOMAIN${NC}"
fi
echo ""
echo "------------------------------------------------------------------------"
echo "Credenciais do Banco de Dados Interno:"
echo "- Usuário: wapi_user"
echo "- Senha:   ******** (gravada no arquivo .env)"
echo "------------------------------------------------------------------------"
echo "Comandos úteis:"
echo "Ver logs do App: cd /var/www/wapi-weaver && docker compose logs -f app"
echo "Reiniciar App:   cd /var/www/wapi-weaver && docker compose restart"
echo "========================================================================"
