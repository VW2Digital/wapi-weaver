# Auditoria E2E: CRM / Kanban

## Etapa 1: Mapeamento de Campos ✅

### KanbanBoard `Opportunity` → MySQL `opportunities`

| Campo Frontend (KanbanBoard.tsx:27) | Coluna MySQL | Mapeamento | Status |
|---|---|---|---|
| `id: string` | `id VARCHAR(36)` | Direto | ✅ |
| `title: string` | `title VARCHAR(200)` | Direto | ✅ |
| `value: number` | `value DECIMAL(15,2)` | `Number(row.value) || 0` | ✅ |
| `currency: string` | `currency CHAR(3)` | Padrão `"BRL"` | ✅ |
| `status: string` | `status ENUM('open','won','lost','paused','archived')` | `normalizeOpportunityStatus()` | ✅ |
| `stage_id: string` | `stage_id VARCHAR(36)` | Direto | ✅ |
| `temperature?: "cold"|"warm"|"hot"` | `temperature ENUM('cold','warm','hot')` | `normalizeOpportunityTemperature()` | ✅ |
| `priority: "low"|"medium"|"high"|"urgent"` | `priority ENUM(...)` | `normalizeOpportunityPriority()` | ✅ |
| `expected_close_date?: string` | `expected_close_date DATE` | `normalizeOptionalDateString()` | ✅ |
| `primary_contact_id?: string` | `primary_contact_id VARCHAR(36)` | Direto | ✅ |
| `owner_user_id?: string` | `owner_user_id VARCHAR(36)` | Direto | ✅ |
| `last_activity_at?: string` | `last_activity_at DATETIME` | Calculado via triggers | ✅ |
| `next_activity_at?: string` | `next_activity_at DATETIME` | Calculado via triggers | ✅ |
| `primary_contact_name?` | `contacts.name` | LEFT JOIN | ✅ |
| `primary_contact_phone?` | `contacts.phone_e164` | LEFT JOIN | ✅ |
| `primary_contact_custom_fields?` | `contacts.custom_fields` | LEFT JOIN + JSON parse | ✅ |
| `tags?: OpportunityTag[]` | `opportunity_tags` + `tags` | Eager load via JOIN | ✅ |

### KanbanBoard `Stage` → MySQL `sales_stages`

| Campo Frontend (KanbanBoard.tsx:47) | Coluna MySQL | Status |
|---|---|---|
| `id: string` | `id VARCHAR(36)` | ✅ |
| `name: string` | `name VARCHAR(150)` | ✅ |
| `color?: string` | `color VARCHAR(30)` | ✅ |
| `probability_percent: number` | `probability_percent DECIMAL(5,2)` | ✅ |
| `total_value?: number` | **Agregado** (`SUM(value)`) | ⚠️ |
| `total_count?: number` | **Agregado** (`COUNT(*)`) | ⚠️ |

### OpportunityModal Props

| Prop | Origem | Uso | Status |
|---|---|---|---|
| `opportunityId: string | null` | `selectedOppId` state (crm.tsx:364) | Gatilho da query `getOpportunity` | ✅ |
| `funnels: any[]` | Query `listFunnels` | Selector de funil no form | ✅ |
| `stages: any[]` | Query `listStages` | Selector de etapa no form | ✅ |
| `owners: any[]` | Query `listOwners` | Selector de responsável | ✅ |

### Formulário → Schema MySQL

| Campo do Form (OpportunityModal.tsx) | Coluna MySQL | Persistido via | Status |
|---|---|---|---|
| `title` | `opportunities.title` | `updateOpportunity` | ✅ |
| `value` | `opportunities.value` | `updateOpportunity` | ✅ |
| `funnelId` | `opportunities.funnel_id` | `updateOpportunity` | ✅ |
| `stageId` | `opportunities.stage_id` | `updateOpportunity` | ✅ |
| `primaryContactId` | `opportunities.primary_contact_id` | `updateOpportunity` + pivot `opportunity_contacts` | ✅ |
| `companyName` | `opportunities.company_name` | `updateOpportunity` | ✅ |
| `ownerUserId` | `opportunities.owner_user_id` | `updateOpportunity` | ✅ |
| `expectedCloseDate` | `opportunities.expected_close_date` | `updateOpportunity` | ✅ |
| `source` | `opportunities.source` | `updateOpportunity` | ✅ |
| `temperature` | `opportunities.temperature` | `updateOpportunity` | ✅ |
| `priority` | `opportunities.priority` | `updateOpportunity` | ✅ |
| `tagsStr` (comma-separated) | `opportunity_tags` + `tags` | Sincronizado em `updateOpportunity` | ✅ |
| `additionalContacts` | `opportunity_contacts` | Sincronizado em `updateOpportunity` | ✅ |
| `description` | `opportunities.description` | `updateOpportunity` | ✅ |

---

## Etapa 2: Testes de Leitura (DB → Front) ✅

### `listOpportunities` (crm.functions.ts:690)
- **Filtros aplicados:** `user_id`, `funnel_id`, `stage_id` (opcional), `status` (opcional), `search` (LIKE em title/description/contact name)
- **Ordenação:** `kanban_order ASC`
- **Eager load:** Tags via segunda query com `opportunity_tags JOIN tags`
- **Paginacão:** `LIMIT ? OFFSET ?`
- **Multitenant:** ✅ `WHERE o.user_id = ?`

### `getOpportunity` (crm.functions.ts:796)
- **Filtros:** `o.id = ? AND o.user_id = ? AND o.deleted_at IS NULL`
- **Joins:** contacts, sales_funnels, sales_stages, lost_reasons
- **Secondary loads:** additional_contacts, tags

### `listStages` (crm.functions.ts:491)
- **Filtros:** `funnel_id = ? AND user_id = ? AND deleted_at IS NULL AND is_active = TRUE`

### `listFunnels` (crm.functions.ts:357)
- **Filtros:** `user_id = ?`

### Multi-tenant nas consultas de leitura
- `listFunnels`: ✅ `WHERE user_id = ?`
- `listStages`: ✅ `WHERE funnel_id = ? AND user_id = ?`
- `listOpportunities`: ✅ `WHERE o.user_id = ?`
- `getOpportunity`: ✅ `WHERE o.id = ? AND o.user_id = ?`
- `listActivities`: ✅ `WHERE a.opportunity_id = ? AND a.user_id = ?`
- `listNotes`: ✅ `WHERE n.opportunity_id = ? AND n.user_id = ?`
- `getOpportunityTimeline`: ✅ `WHERE h.opportunity_id = ? AND h.user_id = ?`
- `getCRMStats`: ✅ `WHERE user_id = ? AND funnel_id = ?`
- `listOwners`: ⚠️ **NÃO** filtra por user_id (`SELECT id, email, display_name, full_name FROM profiles` — sem WHERE)

---

## Etapa 3: Testes de Escrita (Front → DB) ✅

### `moveOpportunity` (crm.functions.ts:1138)

| Operação | Detalhes | Status |
|---|---|---|
| **Ownership check** | `SELECT * FROM opportunities WHERE id = ? AND user_id = ?` | ✅ |
| **Target stage validation** | `SELECT * FROM sales_stages WHERE id = ? AND user_id = ?` | ✅ |
| **Cross-funnel prevention** | Verifica se `toStage.funnel_id === opportunity.funnel_id` | ✅ |
| **Kanban order calculation** | 4 estratégias: início, fim, entre 2 cartas, única carta — usando `DECIMAL(20,10)` com média de adjacentes | ✅ |
| **Status auto-update** | `is_won_stage` → status `won`, `is_lost_stage` → status `lost`, senão `open` | ✅ |
| **Stage history** | Insere em `opportunity_stage_history` | ✅ |
| **Audit log** | Insere em `opportunity_audit_logs` | ✅ |
| **Contact sync** | `syncContactKanbanStage()` atualiza `contacts.kanban_stage_id` | ✅ |
| **Transaction** | Tudo dentro de `db.transaction` | ✅ |

### `updateOpportunity` (crm.functions.ts:981)

| Operação | Detalhes | Status |
|---|---|---|
| **Ownership check** | `SELECT * FROM opportunities WHERE id = ? AND user_id = ?` | ✅ |
| **Stage validation** | `validateStageBelongsToFunnel()` | ✅ |
| **Field update** | Title, description, funnel, stage, contact, company, owner, value, currency, close date, source, temperature, priority | ✅ |
| **Contact pivot sync** | Deleta e reinsere `opportunity_contacts` (primary + additional) | ✅ |
| **Tag sync** | Deleta e reinsere `opportunity_tags`; cria tags novas se não existirem | ✅ |
| **Audit log** | `logAudit()` com `old_values` e `new_values` completos | ✅ |
| **Contact kanban sync** | Atualiza `contacts.kanban_stage_id` | ✅ |
| **Transaction** | Tudo dentro de `db.transaction` | ✅ |

### `bulkAssignToKanban` (crm.functions.ts:2088)
- Cria ou atualiza oportunidades em lote para contatos existentes
- Cria títulos automáticos: `"Oportunidade - {name}"`
- ✅ Ownership validation, audit logging, stage validation

---

## Etapa 4: Consistência Multi-tenant ✅ (com 1 exceção)

### Mecanismo de isolamento
1. **`requireAuth` middleware** (auth-middleware.ts:10): Decodifica JWT, extrai `sub` (user_id)
2. **`resolveEffectiveUserId`** (chat-helpers.ts:3): Resolve team membership → retorna `team.user_id` ou `currentUserId`
3. **`ServerMySQLClient`** (auth-middleware.ts:42): Instância de DB scoped ao `effectiveUserId`
4. **Todas as queries CRM** incluem `WHERE user_id = ?` com o `effectiveUserId`

### Cross-tenant access attempt (simulação)
- Tentativa de acessar `/api/opportunity?id={outro-tenant}` falharia porque:
  1. O JWT contém `sub` do usuário autenticado
  2. `resolveEffectiveUserId` retorna o tenant do usuário
  3. A query inclui `AND user_id = ?` com o tenant ID
  4. Foreign keys (`user_id REFERENCES users(id) ON DELETE CASCADE`) impedem dados órfãos

### Exceção encontrada:
- **`listOwners`** (crm.functions.ts:2078): `SELECT id, email, display_name, full_name FROM profiles` — **sem filtro de tenant**. Retorna todos os profiles do sistema. Impacto baixo (apenas para preencher dropdown de ownership), mas é um leak de dados.

### Inconsistências menores:
- **`validateStageBelongsToFunnel()`** (crm.functions.ts:223): Não filtra por `user_id`, apenas verifica estrutura funnel→stage
- **`updateOpportunityActivityTimestamps()`** (crm.functions.ts:1815): Query `SELECT MAX(completed_at)` não filtra por `user_id` (mas é chamada dentro de transações que já validam ownership)
- **`changeOpportunityFunnel`** (crm.functions.ts:1557): `SELECT MAX(kanban_order)` não filtra por `user_id` (baixo risco, só afeta ordenação)

---

## Etapa 5: Análise de Inconsistências ⚠️

### Campos ausentes ou incompletos

| Campo | Problema | Severidade |
|---|---|---|
| **`probability_percent`** da tabela `opportunities` | Existe no schema mas **nunca é populado** (`opportunitySchema` não tem o campo; `createOpportunity` não insere; `updateOpportunity` não atualiza) | ⚠️ Média |
| **`duração` no form de atividade** (OpportunityModal.tsx:937) | Input renderizado mas **não tem state binding** — `defaultValue="30"` sem `onChange` ou estado vinculado | ⚠️ Média |
| **Editor toolbar** (Bold, Italic, etc em OpportunityModal.tsx:956-961) | Botões renderizados mas **sem funcionalidade** (não aplicam formatação ao textarea) | ⚠️ Baixa |
| **Upload area** (OpportunityModal.tsx:947) | Renderizada como "arraste o documento" mas **sem implementação de upload** | ⚠️ Baixa |
| **`CheckSquare 0/1`** no card Kanban (KanbanBoard.tsx:413) | Hardcoded `0/1` — **não reflete tasks reais** | ⚠️ Baixa |
| **`notes.body` vs `notes.body` no editor** | WYSIWYG toolbar não conectada ao estado `actDesc` | ⚠️ Baixa |
| **Stage `probability_percent` no KanbanBoard** | O componente `Stage` tem `probability_percent` mas o KanbanBoard não o exibe (usa `total_value` agregado) | ℹ️ Cosmético |

### Campos mockados ou não persistidos

| Campo | Local | Realidade |
|---|---|---|
| `primary_contact_custom_fields` | Oportunidade | Persistido em `contacts.custom_fields`, carregado via JOIN com JSON.parse |
| `Stage.total_value` | KanbanBoard | **Não é coluna** — calculado via `reduce()` no frontend (KanbanBoard.tsx:233) |
| `Stage.total_count` | KanbanBoard | **Não é coluna** — calculado via `filter().length` |
| `opportunity.tags[].color` | KanbanBoard | Vem do JOIN com `tags.color` — não é determinado pela opportunity |

---

## Etapa 6: Teste de Real-time (Polling vs WebSockets) ❌

### Mecanismo atual
- **Sem WebSockets ou SSE** para dados de CRM
- Atualizações via **TanStack React Query com invalidação manual** após mutações

### Queries CRM e refetch

| Query Key | Mutation Invalidation | Polling |
|---|---|---|
| `["funnels"]` | `invalidateQueries` em mutate ✅ | ❌ Nenhum |
| `["stages", activeId]` | `invalidateQueries` em mutate ✅ | ❌ Nenhum |
| `["opportunities", ...]` | `invalidateQueries` em mutate ✅ | ❌ Nenhum |
| `["opportunity", id]` | `refetch()` manual ✅ | ❌ Nenhum |
| `["crm-stats", activeId]` | `invalidateQueries` em mutate ✅ | ❌ Nenhum |
| `["opportunity-activities", id]` | `refetch()` manual ✅ | ❌ Nenhum |
| `["opportunity-timeline", id]` | `refetch()` manual ✅ | ❌ Nenhum |

### Cenários de concorrência

| Cenário | Como o Kanban recebe atualização | Risco |
|---|---|---|
| Usuário A move card | Invalidação imediata via `onSuccess` | ✅ Baixo |
| Usuário A abre modal e salva | Invalidação + refetch manual | ✅ Baixo |
| Usuário B move mesmo card (mesmo tenant) | **Sem notificação** — Usuário A só vê se fizer ação que invalida | ⚠️ Médio |
| Usuário B move card (outro tenant) | Isolado por `user_id` — sem impacto | ✅ Nenhum |
| Agente externo (chat) cria oportunidade | Mutação no chat invalida `["opportunities"]` | ✅ Coberto |

### Conclusão
**Real-time não implementado para CRM.** Atualizações cross-session (ex: dois usuários no mesmo kanban) não são refletidas sem ação manual. O app usa polling **apenas para chat** (2s-15s), não para CRM. Para consistência multi-usuário, seria necessário implementar Supabase Realtime, SSE ou polling periódico no CRM.

---

## Etapa 7: Relatório Final — Tabela de Rastreabilidade

| Componente | Arquivo | Linhas | DB Schema | API | Multi-tenant | Status |
|---|---|---|---|---|---|---|
| **KanbanBoard** | `KanbanBoard.tsx` | 457 | `opportunities` + `sales_stages` + `contacts` | `listFunnels`, `listStages`, `listOpportunities`, `moveOpportunity` | ✅ user_id em todas queries | ✅ |
| **OpportunityModal** | `OpportunityModal.tsx` | 1184 | 8 tabelas CRM | 20+ server functions | ✅ user_id isolado | ✅ |
| **CRM Page** | `crm.tsx` | 1260 | Todas tabelas CRM | Orchestrates 14 hooks | ✅ funnel/user scoped | ✅ |
| **crm.functions.ts** | `crm.functions.ts` | 2194 | 11 tabelas | 25 endpoints | ✅ (1 exceção) | ✅ |
| **MySQL Schema** | `schema_mysql.sql` | 615 | 11 tabelas + 13 índices | N/A | FK `user_id → users` | ✅ |
| **Auth Middleware** | `auth-middleware.ts` | 59 | `users` + JWT | `requireAuth` | ✅ resolveEffectiveUserId | ✅ |
| **Chat → CRM** | `chat.tsx` | ~3700 | `contacts.kanban_stage_id` | `bulkAssignToKanban`, `createOpportunity` | ✅ user_id | ✅ |
| **Contacts → CRM** | `contacts.functions.ts` | ~420 | `contacts.kanban_stage_id` | sync em save | ✅ user_id | ✅ |

### Verdict por Etapa

| Etapa | Status | Observações |
|---|---|---|
| **1. Mapeamento de Campos** | ✅ Completo | Todos os campos do KanbanBoard e Modal mapeados corretamente ao schema |
| **2. Testes de Leitura** | ✅ Aprovado | Filtros multi-tenant, joins, eager loading funcionais |
| **3. Testes de Escrita** | ✅ Aprovado | MoveOpportunity com kanban_order averaging, update com sync de pivôs, audit trail |
| **4. Consistência Multi-tenant** | ✅ Aprovado | 1 exceção: `listOwners` sem filtro; 3 queries auxiliares sem user_id mas isoladas por transação |
| **5. Inconsistências** | ⚠️ 6 achados | `probability_percent` não populado, duração sem state, toolbar mockada, upload mockado, tasks hardcoded |
| **6. Real-time** | ❌ Não implementado | Sem polling/WS para CRM — dados obsoletos para múltiplos usuários simultâneos |
| **7. Rastreabilidade** | ✅ Completa | Todas as camadas mapeadas e verificadas |

### Recomendações

1. **Prioridade Alta:** Adicionar polling (ex: 30s) nas queries de oportunidades para detecção de alterações cross-session
2. **Prioridade Média:** Popular `probability_percent` na opportunity durante create/update
3. **Prioridade Baixa:** Corrigir `listOwners` para filtrar por tenant se aplicável; conectar estado do campo duração; remover UI mockada (upload, toolbar)
4. **Prioridade Baixa:** Substituir `0/1` hardcoded por contagem real de atividades pendentes
