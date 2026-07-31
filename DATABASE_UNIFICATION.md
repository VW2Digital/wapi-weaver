# MANUAL DO ARQUITETO: Arquitetura de Banco de Dados Único (wapi-weaver)

Seguindo as boas práticas do desenvolvimento de software ("Single Source of Truth" & "Single Database Instance Per Microservice/Monolith"), toda a aplicação **wapi-weaver** utiliza **UM ÚNICO BANCO DE DADOS CONSOLIDADO**.

---

## 1. Definição do Banco de Dados Oficial

- **SGBD:** MySQL 8.0
- **Nome do Banco (Database):** `wapi_weaver`
- **CharSet / Collation:** `utf8mb4_unicode_ci`
- **Pool de Conexão Central:** `src/lib/db.ts` (`mysql2/promise`)
- **Filtro Multi-Tenant:** `WHERE tenant_id = ?` (ou `user_id = ?`) aplicado em todas as tabelas e queries.

---

## 2. Eliminação de Redundâncias

Para evitar ambiguidades ou conexões paralelas não autorizadas:
1. **Remoção do PostgreSQL Legado:** O diretório `postgres_legacy/` contendo scripts de PostgreSQL de instâncias passadas foi completamente **deletado**.
2. **Eliminação de Schemas Temporários:** Todos os arquivos de dump e JSONs temporários foram limpos.
3. **Fonte da Verdade para Migrações:** O script `scripts/ensure-schema.js` e a query declarativa `schema_mysql.sql` concentram 100% da criação e atualização de tabelas (autenticação, CRM, contatos, bot, DS agente, licenças, webhooks).

---

## 3. Estrutura de Conexão na Aplicação

```
                           +----------------------------+
                           |     Aplicação Bliv         |
                           |       (wapi-weaver)        |
                           +-------------+--------------+
                                         |
                                         v
                           +----------------------------+
                           |      src/lib/db.ts         |
                           |   (Pool Único MySQL)       |
                           +-------------+--------------+
                                         |
                                         v
                           +----------------------------+
                           |  MySQL 8.0 (wapi_weaver)   |
                           |        Porta 3306          |
                           +----------------------------+
```

---

## 4. Manutenção e Garantia do Schema Único

Para garantir que o banco esteja sempre com todas as tabelas e colunas em dia, execute o comando oficial:

```powershell
npm run db:ensure
```
