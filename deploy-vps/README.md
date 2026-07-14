# Deploy VPS — Wapi Weaver

Scripts para instalar e atualizar o CRM Wapi Weaver em servidores VPS Linux (Ubuntu 20.04+).

---

## Instalação completa (primeira vez)

```bash
sudo bash /var/www/wapi-weaver/install.sh
```

---

## Atualização (sem reinstalar do zero)

```bash
bash <(curl -fsSL "https://raw.githubusercontent.com/VW2Digital/wapi-weaver/main/deploy-vps/update.sh")
```

Ou, se o repositório já estiver clonado no servidor:

```bash
sudo bash /var/www/wapi-weaver/deploy-vps/update.sh
```

### O que o `update.sh` faz?

| Etapa | Ação | Dados afetados |
|---|---|---|
| **1. Backup** | Dump SQL compactado do banco | Salvo em `/var/backups/wapi-weaver/` |
| **2. Git pull** | Puxa código mais recente | Só arquivos de código |
| **3. .env** | Adiciona novas variáveis faltantes | Nunca sobrescreve valores existentes |
| **4. Rebuild** | Reconstrói apenas o container `app` | MySQL e Redis continuam no ar |
| **5. Schema** | Migrações incrementais via `ensure-schema.js` | Nunca apaga dados |

---

## Rollback

```bash
gunzip -c /var/backups/wapi-weaver/wapi_weaver_backup_YYYYMMDD_HHMMSS.sql.gz \
  | docker compose exec -T banco-mysql mysql -u root -p<MYSQL_ROOT_PASSWORD> wapi_weaver
```

---

## Modo silencioso (CI/CD)

```bash
AUTO_CONFIRM=1 sudo bash /var/www/wapi-weaver/deploy-vps/update.sh
```
