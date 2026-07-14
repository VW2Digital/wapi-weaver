# Backup e Restauração de Dados MySQL

## 1. Backups Diários Manuais/Automáticos
Garantir o backup do banco MySQL Docker é vital para evitar perdas do CRM de clientes.

### Criando Dump SQL
Rodando de fora do container:
```bash
docker exec wapi_weaver_mysql mysqldump -u wapi_user -p"S0xbxPfKazBVT8JFy1UEOjIsrjox" wapi_weaver > /caminho/seguro/backup_wapi_weaver_$(date +%F).sql
```
*Dica: Adicione esse comando em uma Job Cron (`crontab -e`) rodando às 3:00 da manhã, compactando o arquivo com `tar.gz`.*

## 2. Processo de Restauração em Caso de Desastre
Se os dados de um cliente foram expurgados indevidamente ou houve corrupção total do banco.

1. **Subir um MySQL limpo (caso falha total do volume):**
```bash
docker-compose down -v
docker-compose up -d
```
2. **Restaurar o Dump salvo:**
```bash
cat /caminho/seguro/backup_wapi_weaver_2026-XX-XX.sql | docker exec -i wapi_weaver_mysql mysql -u wapi_user -p"S0xbxPfKazBVT8JFy1UEOjIsrjox" wapi_weaver
```
3. **Reiniciar o Backend da Aplicação:**
Isso forçará a aplicação Node (PM2 ou Vite server local) a reler o estado final restaurado sem caches órfãos.
```bash
pm2 restart wapi-weaver-crm
```
