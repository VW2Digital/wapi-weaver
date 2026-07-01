# Módulo de Licenças — Design Document

## 1. Visão Geral

Módulo administrativo para gerenciamento e geração de licenças de software. Permite criar, renovar, bloquear, cancelar e monitorar licenças de forma centralizada. Apenas usuários com role `admin` têm acesso.

## 2. Arquitetura

O módulo segue o padrão existente do projeto (TanStack Router, TanStack Start, React 19, shadcn/ui):

- **Páginas**: `src/routes/_app/licenses/` (protegidas por role admin)
- **APIs públicas**: `src/routes/api/licenses/` (ativação e verificação, sem auth)
- **APIs administrativas**: `src/routes/api/admin/licenses/` (protegidas por `requireAuth` + role admin)
- **Server Functions**: `src/lib/licenses.functions.ts` (lógica de negócio com `requireAuth` ou raw `db` queries)
- **Migração SQL**: Adicionar tabelas ao `schema_mysql.sql`

### 2.1 Árvore de Rotas

```
src/routes/
  _app/
    licenses/
      dashboard.tsx   → /licenses/dashboard
      index.tsx       → /licenses (listagem)
      create.tsx      → /licenses/create
      $id.tsx         → /licenses/$id (detalhes)
  api/
    licenses/
      activate.ts     → POST /api/licenses/activate (público)
      check.ts        → POST /api/licenses/check (público)
    admin/
      licenses/
        index.ts      → GET /api/admin/licenses (admin)
        [id].ts       → GET /api/admin/licenses/:id (admin)
        create.ts     → POST /api/admin/licenses/create (admin)
        renew.ts      → POST /api/admin/licenses/renew (admin)
        block.ts      → POST /api/admin/licenses/block (admin)
        cancel.ts     → POST /api/admin/licenses/cancel (admin)
        reactivate.ts → POST /api/admin/licenses/reactivate (admin)
        update-domain.ts → POST /api/admin/licenses/update-domain (admin)
```

## 3. Banco de Dados

### 3.1 Tabela `licenses`

```sql
CREATE TABLE IF NOT EXISTS licenses (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  customer_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(50) NULL,
  license_key_hash VARCHAR(64) NOT NULL,
  license_key_prefix VARCHAR(20) NOT NULL,
  plan_name VARCHAR(100) NOT NULL,
  status ENUM('active', 'expired', 'cancelled', 'blocked') NOT NULL DEFAULT 'active',
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,
  allowed_domain VARCHAR(255) NULL,
  max_activations INT NOT NULL DEFAULT 1,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 3.2 Tabela `license_activations`

```sql
CREATE TABLE IF NOT EXISTS license_activations (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  license_id VARCHAR(36) NOT NULL,
  activation_id VARCHAR(64) NOT NULL UNIQUE,
  installation_id VARCHAR(255) NULL,
  domain VARCHAR(255) NULL,
  server_ip VARCHAR(45) NULL,
  fingerprint_hash VARCHAR(64) NULL,
  status ENUM('active', 'inactive', 'blocked') NOT NULL DEFAULT 'active',
  activated_at DATETIME NULL,
  last_seen_at DATETIME NULL,
  deactivated_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 3.3 Tabela `license_events`

```sql
CREATE TABLE IF NOT EXISTS license_events (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  license_id VARCHAR(36) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  description TEXT NULL,
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## 4. Geração de Chave de Licença

### 4.1 Formato

`VW2-PRO-XXXX-XXXX-XXXX`

Onde `XXXX` são 4 caracteres hexadecimais (0-9, A-F) gerados com `crypto.randomBytes`.

### 4.2 Armazenamento Seguro

- `license_key_hash`: SHA-256 da chave completa (64 caracteres hexadecimais)
- `license_key_prefix`: Primeiros 13 caracteres (`VW2-PRO-XXXX`) para identificação visual
- A chave original **nunca** é salva no banco

### 4.3 Exibição da Chave

Após criar a licença, exibir a chave original **uma única vez** via toast + mensagem em tela com aviso para copiar antes de sair.

## 5. Token Assinado (License Token)

Endpoints públicos (`/api/licenses/activate` e `/api/licenses/check`) retornam um token JWT assinado.

### 5.1 Payload

```typescript
{
  license_id: string;
  activation_id: string;
  plan_name: string;
  domain: string;
  fingerprint_hash: string;
  issued_at: number;  // Unix timestamp
  token_expires_at: number;  // Unix timestamp (ex: 1 hora)
  license_ends_at: string;  // ISO date
  status: string;
}
```

### 5.2 Chaves

- `LICENSE_PRIVATE_KEY` — variável de ambiente (PEM), usada para assinar tokens
- `LICENSE_PUBLIC_KEY` — variável de ambiente (PEM), usada pela aplicação cliente para validar tokens

Se não configuradas, usar o `JWT_SECRET` como fallback.

## 6. Lógica de Validação

### 6.1 Ativação (`POST /api/licenses/activate`)

Recebe: `{ license_key, domain, fingerprint_hash, installation_id }`

1. Calcular SHA-256 da `license_key`
2. Buscar licença por `license_key_hash`
3. Validar:
   - Licença existe
   - Status é `active`
   - `ends_at > now()`
   - `allowed_domain` corresponde (se definido)
   - `max_activations` não foi excedido
4. Criar/reativar activation
5. Gerar token assinado
6. Retornar token + dados da licença (sem a chave original)
7. Registrar evento `licença ativada`

### 6.2 Verificação (`POST /api/licenses/check`)

Recebe: `{ license_key, domain, fingerprint_hash, installation_id }`

1. Calcular SHA-256 da `license_key`
2. Buscar licença por `license_key_hash`
3. Validar mesmas regras da ativação
4. Atualizar `last_seen_at` na activation
5. Gerar novo token assinado
6. Retornar token + status

## 7. Páginas do Módulo

### 7.1 Dashboard (`/licenses/dashboard`)

Cards com:
- Total de licenças ativas
- Total de licenças vencidas
- Total de licenças bloqueadas
- Total de licenças canceladas
- Licenças vencendo nos próximos 7 dias
- Últimas ativações realizadas (tabela resumida)

### 7.2 Listagem (`/licenses`)

Tabela com:
- Nome do cliente, E-mail, Telefone, Plano, Status, Domínio, Datas, Ativações
- Ações: Ver detalhes, Renovar, Bloquear, Cancelar
- Filtros: Status, Plano, Cliente, Domínio, Data de vencimento

### 7.3 Gerar Licença (`/licenses/create`)

Formulário:
- Nome do cliente (text)
- E-mail (email)
- Telefone (tel)
- Plano (select: PRO, ENTERPRISE, etc ou custom)
- Duração (select: 30, 90, 180, 365, ou custom)
- Domínio autorizado (text)
- Máximo de ativações (number, default 1)
- Observações (textarea)

### 7.4 Detalhes (`/licenses/$id`)

Exibe:
- Dados do cliente, Plano, Status, Domínio, Datas
- Ativações usadas / máximo
- Tabela de ativações (IP, fingerprint, installation_id, última validação)
- Histórico de eventos (license_events)
- Ações: Renovar, Bloquear/Cancelar, Alterar domínio/plano/data

## 8. Ações Administrativas (via API)

### 8.1 Renovar
- Recebe: `license_id, new_ends_at` ou `license_id, extra_days`
- Atualiza `ends_at`, registra evento `licença renovada`

### 8.2 Bloquear
- Seta status `blocked`, desativa ativações ativas, registra evento

### 8.3 Cancelar
- Seta status `cancelled`, desativa ativações ativas, registra evento

### 8.4 Reativar
- Seta status `active` (se blocked), registra evento

### 8.5 Alterar Domínio
- Atualiza `allowed_domain`, registra evento

## 9. Sidebar

Adicionar ao `NAV` em `_app.tsx`:

```typescript
{
  to: "/licenses",
  label: "Licenças",
  icon: KeyRound,
  children: [
    { to: "/licenses/dashboard", label: "Dashboard", icon: BarChart3 },
    { to: "/licenses", label: "Licenças", icon: FileKey },
    { to: "/licenses/create", label: "Gerar Licença", icon: PlusCircle },
  ],
}
```

- Visível apenas para admin (filtrar como nas outras seções admin)
- Usar rota raiz `/licenses` já que não há página sem prefixo (usar `index.tsx` como listagem)

Ajustar rota:
- `index.tsx` → `/licenses` (listagem)
- `dashboard.tsx` → `/licenses/dashboard`
- `create.tsx` → `/licenses/create`
- `$id.tsx` → `/licenses/$id`

## 10. Segurança

- Rotas públicas (`/api/licenses/*`): sem autenticação (validação via chave + hash)
- Rotas admin (`/api/admin/licenses/*` + páginas): `requireAuth` + verificação de role `admin`
- Chave original nunca salva no banco (apenas hash SHA-256)
- Token assinado para validação cliente-side
- CSRF já coberto pelo middleware existente

## 11. Dependências

Todas já existentes no projeto:
- `crypto` (nativo Node) — hash SHA-256, geração de bytes aleatórios
- `jsonwebtoken` — assinatura de tokens
- `uuid` — geração de IDs (UUID v4)

Ícones necessários (lucide-react): `KeyRound`, `FileKey`, `PlusCircle`, `BarChart3`, `ShieldAlert`, `RefreshCw`, `Ban`, `CheckCircle`, `Globe`, `Calendar`

## 12. Variáveis de Ambiente

```
LICENSE_PRIVATE_KEY=   # Opcional. PEM para assinar license tokens. Fallback: JWT_SECRET
LICENSE_PUBLIC_KEY=    # Opcional. PEM para validar license tokens. Fallback: JWT_SECRET
```

Nenhuma variável `APP_MODE` — o controle é feito por role `admin`.
