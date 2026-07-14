# Planos de Rollback e Contingência

Em caso de implantação (Deploy) malsucedida ou interrupção catastrófica durante uma atualização do WAPI Weaver, as seguintes estratégias devem ser ativadas imediatamente.

## 1. Falha Imediata após o Deploy (Erro no Node)
Caso a subida com PM2 acuse erro fatal (Loop Crash):
1. **Identificar Erro no Log**:
```bash
pm2 logs wapi-weaver-crm --lines 100
```
2. **Reverter Repositório (Rollback de Código)**:
```bash
# Volta à última commit estável
git checkout HEAD^1
# Reconstrói
npm run build
pm2 reload wapi-weaver-crm
```

## 2. Corrupção de Banco de Dados ou Migração Incompleta
O WAPI Weaver possui um arquivo base de schema MySQL (`schema_mysql.sql`), e o ambiente local lida com inicialização idempotente (criação se não existir). No entanto, não há um sistema complexo de *migrations* bidirecionais instalado (`up/down` via Prisma, TypeORM).

**Ação Padrão:**
Nunca execute comandos de `ALTER TABLE` diretamente em produção sem ter tirado um dump na hora anterior.
Se o banco foi corrompido, siga o guia em `BACKUP-E-RESTAURACAO.md` e puxe o SQL das horas/dias anteriores.

## 3. Webhook Desligado (Falha de Comunicação Meta)
Se a VPS travar e o Node.js cair por vários minutos, o Webhook da Meta passará a falhar.
A Meta fará tentativas (retries) por até 7 dias com *backoff* exponencial. Assim que o servidor Node retornar, o P-Queue embutido receberá a carga acumulada. Não cancele o servidor; o WAPI Weaver está arquitetado para engolir esse atraso assim que reviver.
