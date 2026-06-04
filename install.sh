#!/usr/bin/env bash
# =============================================================================
#  Instalador para VPS — Disparador WhatsApp (TanStack Start + Lovable Cloud)
# =============================================================================
#  Uso:
#    curl -fsSL "https://raw.githubusercontent.com/<owner>/<repo>/main/install.sh?v=$(date +%s)" -o /tmp/install.sh \
#      && sudo DOMAIN="painel.seudominio.com.br" \
#              PORT="3000" \
#              SUPABASE_URL="https://xxxx.supabase.co" \
#              SUPABASE_PUBLISHABLE_KEY="eyJ..." \
#              SUPABASE_PROJECT_REF="xxxx" \
#              REPO_URL="https://github.com/<owner>/<repo>.git" \
#              REPO_BRANCH="main" \
#              INSTALL_SSL="s" \
#              SSL_EMAIL="voce@dominio.com" \
#              bash /tmp/install.sh
# =============================================================================
set -euo pipefail

# ---------- helpers ----------
log()  { printf "\n\033[1;36m==>\033[0m %s\n" "$*"; }
ok()   { printf "\033[1;32m✓\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m!\033[0m %s\n" "$*"; }
err()  { printf "\033[1;31m✗\033[0m %s\n" "$*" >&2; }
die()  { err "$*"; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Execute como root (use sudo)."

# ---------- params ----------
: "${DOMAIN:?Defina DOMAIN=seu.dominio.com}"
: "${PORT:=3000}"
: "${REPO_URL:?Defina REPO_URL=https://github.com/usuario/repo.git}"
: "${REPO_BRANCH:=main}"
: "${SUPABASE_URL:?Defina SUPABASE_URL}"
: "${SUPABASE_PUBLISHABLE_KEY:?Defina SUPABASE_PUBLISHABLE_KEY}"
: "${SUPABASE_PROJECT_REF:?Defina SUPABASE_PROJECT_REF}"
: "${INSTALL_SSL:=n}"
: "${SSL_EMAIL:=}"

APP_NAME="wapi-disparador"
APP_DIR="/opt/${APP_NAME}"
APP_USER="${APP_NAME}"
SERVICE_FILE="/etc/systemd/system/${APP_NAME}.service"
NGINX_CONF="/etc/nginx/sites-available/${APP_NAME}"

log "Domínio: $DOMAIN | Porta interna: $PORT | Branch: $REPO_BRANCH"

# ---------- 1. Dependências do sistema ----------
log "Atualizando sistema e instalando dependências..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl ca-certificates gnupg git ufw nginx unzip build-essential

# Node 20 (LTS)
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  log "Instalando Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
ok "Node $(node -v)"

# Bun
if ! command -v bun >/dev/null 2>&1; then
  log "Instalando Bun..."
  curl -fsSL https://bun.sh/install | bash
  ln -sf "$HOME/.bun/bin/bun" /usr/local/bin/bun
fi
ok "Bun $(bun -v)"

# ---------- 2. Usuário e diretório ----------
log "Preparando usuário e diretório..."
id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --shell /bin/bash "$APP_USER"

if [ -d "$APP_DIR/.git" ]; then
  log "Atualizando repositório existente em $APP_DIR..."
  sudo -u "$APP_USER" git -C "$APP_DIR" fetch --all --prune
  sudo -u "$APP_USER" git -C "$APP_DIR" reset --hard "origin/$REPO_BRANCH"
else
  log "Clonando repositório em $APP_DIR..."
  rm -rf "$APP_DIR"
  mkdir -p "$APP_DIR"
  chown "$APP_USER:$APP_USER" "$APP_DIR"
  sudo -u "$APP_USER" git clone --branch "$REPO_BRANCH" "$REPO_URL" "$APP_DIR"
fi

# ---------- 3. Arquivo .env ----------
log "Gravando .env..."
cat > "$APP_DIR/.env" <<EOF
VITE_SUPABASE_URL="${SUPABASE_URL}"
VITE_SUPABASE_PUBLISHABLE_KEY="${SUPABASE_PUBLISHABLE_KEY}"
VITE_SUPABASE_PROJECT_ID="${SUPABASE_PROJECT_REF}"
SUPABASE_URL="${SUPABASE_URL}"
SUPABASE_PUBLISHABLE_KEY="${SUPABASE_PUBLISHABLE_KEY}"
EOF
chown "$APP_USER:$APP_USER" "$APP_DIR/.env"
chmod 600 "$APP_DIR/.env"

# Avisa sobre secrets de runtime que NÃO vão no .env público
warn "Configure SUPABASE_SERVICE_ROLE_KEY, WHATSAPP_ACCESS_TOKEN, WHATSAPP_APP_SECRET,"
warn "WHATSAPP_VERIFY_TOKEN e CRON_SECRET no arquivo $APP_DIR/.env antes de iniciar."

# ---------- 4. Instalar deps + build ----------
log "Instalando dependências (bun install)..."
sudo -u "$APP_USER" bash -lc "cd '$APP_DIR' && bun install --frozen-lockfile || bun install"

log "Compilando aplicação (bun run build)..."
sudo -u "$APP_USER" bash -lc "cd '$APP_DIR' && bun run build"

# ---------- 5. Systemd service (wrangler dev como runtime) ----------
log "Criando serviço systemd..."
cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=${APP_NAME} (TanStack Start)
After=network.target

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${APP_DIR}
EnvironmentFile=${APP_DIR}/.env
Environment=NODE_ENV=production
Environment=PORT=${PORT}
ExecStart=/usr/local/bin/bun x wrangler dev --ip 127.0.0.1 --port ${PORT} --local --persist-to ${APP_DIR}/.wrangler
Restart=always
RestartSec=5
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "${APP_NAME}.service"
systemctl restart "${APP_NAME}.service"
ok "Serviço ${APP_NAME} ativo"

# ---------- 6. Nginx reverse proxy ----------
log "Configurando Nginx para ${DOMAIN}..."
cat > "$NGINX_CONF" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    client_max_body_size 25m;

    location / {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 300s;
    }
}
EOF
ln -sf "$NGINX_CONF" "/etc/nginx/sites-enabled/${APP_NAME}"
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
ok "Nginx configurado"

# ---------- 7. Firewall ----------
if command -v ufw >/dev/null 2>&1; then
  log "Liberando portas no firewall (22, 80, 443)..."
  ufw allow OpenSSH || true
  ufw allow 'Nginx Full' || true
  yes | ufw enable || true
fi

# ---------- 8. SSL (Certbot) ----------
if [ "${INSTALL_SSL,,}" = "s" ] || [ "${INSTALL_SSL,,}" = "y" ] || [ "${INSTALL_SSL,,}" = "yes" ]; then
  [ -n "$SSL_EMAIL" ] || die "INSTALL_SSL=s exige SSL_EMAIL=voce@dominio.com"
  log "Instalando Certbot e emitindo certificado para ${DOMAIN}..."
  apt-get install -y certbot python3-certbot-nginx
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$SSL_EMAIL" --redirect
  ok "SSL ativo em https://${DOMAIN}"
fi

# ---------- Final ----------
echo
ok "Instalação concluída!"
echo "  • App:       http://${DOMAIN}  (porta interna ${PORT})"
echo "  • Logs:      journalctl -u ${APP_NAME} -f"
echo "  • Restart:   systemctl restart ${APP_NAME}"
echo "  • Diretório: ${APP_DIR}"
echo
warn "Lembre de editar ${APP_DIR}/.env e adicionar os secrets do WhatsApp/Supabase Service Role,"
warn "depois rode: systemctl restart ${APP_NAME}"
