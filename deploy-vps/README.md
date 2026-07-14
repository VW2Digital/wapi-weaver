# Deploy VPS — Wapi Weaver

Scripts para instalar e atualizar o CRM Wapi Weaver em servidores VPS Linux (Ubuntu 20.04+).

---

## Instalação completa (primeira vez)

Execute na raiz do servidor como root:

```bash
sudo bash install.sh
```

Ou, se preferir fazer o download direto:

```bash
bash <(curl -fsSL "https://raw.githubusercontent.com/VW2Digital/wapi-weaver/main/install.sh")
```

---

## Atualização (sem reinstalar do zero)

Use este comando sempre que quiser atualizar o código, o banco de dados ou as dependências:

```bash
bash <(curl -fsSL "https://raw.githubusercontent.com/VW2Digital/wapi-weaver/main/deploy-vps/update.sh")
```

Ou, se já tiver o repositório clonado no servidor:

```bash
sudo bash /var/www/wapi-weaver/deploy-vps/update.sh
```

### O que o `update.sh` faz?

| Etapa | Ação | Dados afetados |
|---|---|---|
| **1. Backup** | Cria dump SQL compactado do banco | Salvo em `/var/backups/wapi-weaver/` |
| **2. Git pull** | Puxa o código mais recente do repositório | Só arquivos de código |
| **3. .env** | Adiciona novas variáveis faltantes (ex: `MERCADOPAGO_ENCRYPTION_KEY`) | Nunca sobrescreve valores existentes |
| **4. Rebuild** | Reconstrói apenas o container `app` | MySQL e Redis continuam rodando |
| **5. Schema** | Aplica migrações incrementais via `ensure-schema.js` | Nunca apaga dados existentes |

> **Os dados do banco, uploads e configurações no `.env` são preservados integralmente.**

---

## Como fazer rollback

Se algo der errado após uma atualização, restaure o backup criado automaticamente:

```bash
# Listar backups disponíveis
ls -lh /var/backups/wapi-weaver/

# Restaurar o backup mais recente (substitua o nome do arquivo)
gunzip -c /var/backups/wapi-weaver/wapi_weaver_backup_YYYYMMDD_HHMMSS.sql.gz \
  | docker compose exec -T banco-mysql mysql -u root -p<MYSQL_ROOT_PASSWORD> wapi_weaver
```

---

## Atualização silenciosa (sem confirmação interativa)

Para uso em pipelines CI/CD:

```bash
AUTO_CONFIRM=1 sudo bash /var/www/wapi-weaver/deploy-vps/update.sh
```

---

## Comandos úteis no servidor

```bash
# Ver logs ao vivo
cd /var/www/wapi-weaver && docker compose logs -f app

# Aplicar schema manualmente
cd /var/www/wapi-weaver && docker compose exec app node scripts/ensure-schema.js

# Ver status dos containers
cd /var/www/wapi-weaver && docker compose ps

# Reiniciar todos os serviços
cd /var/www/wapi-weaver && docker compose restart
```
