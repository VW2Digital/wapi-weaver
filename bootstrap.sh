#!/usr/bin/env bash
# ==============================================================================
# BOOTSTRAP DE INSTALAÇÃO - WAPI WEAVER (VPS + DOCKER COMPOSE)
# ==============================================================================
# Alvo: Ubuntu 20.04 / 22.04 / 24.04 LTS
# ==============================================================================

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}========================================================================${NC}"
echo -e "${GREEN}    INICIANDO BOOTSTRAP DO WAPI WEAVER...                               ${NC}"
echo -e "${GREEN}========================================================================${NC}"

# Verificar se roda como root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Erro: Por favor, execute este script como root (sudo bash)${NC}"
  exit 1
fi

# Instalar dependências básicas para clonar o repositório
echo -e "${YELLOW}Instalando dependências básicas (curl, git, rsync)...${NC}"
apt-get update -y -qq
apt-get install -y -qq curl git rsync

APP_DIR="/var/www/wapi-weaver"
mkdir -p /var/www

# Fazer backup do arquivo .env se ele existir
if [ -f "${APP_DIR}/.env" ]; then
  echo "Salvando backup do arquivo .env atual..."
  cp "${APP_DIR}/.env" /tmp/wapi-weaver-env-backup
fi

echo -e "${YELLOW}Clonando repositório do Wapi Weaver para ${APP_DIR}...${NC}"
rm -rf "${APP_DIR}"
git clone https://github.com/VW2Digital/wapi-weaver.git "${APP_DIR}"

# Restaurar o arquivo .env do backup
if [ -f /tmp/wapi-weaver-env-backup ]; then
  echo "Restaurando o arquivo .env do backup..."
  cp /tmp/wapi-weaver-env-backup "${APP_DIR}/.env"
  rm -f /tmp/wapi-weaver-env-backup
fi

cd "${APP_DIR}"

echo -e "${GREEN}Repositório clonado! Iniciando script de instalação oficial...${NC}"
echo ""

# Executar o instalador completo oficial
bash install.sh
