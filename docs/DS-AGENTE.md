# Módulo DS Agente - Documentação

## Visão Geral
O módulo DS Agente permite a criação e gerenciamento de agentes de Inteligência Artificial nativamente no Wapi Weaver CRM. A principal premissa deste módulo é ser um orquestrador de IA isolado por *tenant* (Inquilino / Empresa) operando sob o banco de dados principal (MySQL), e se conectando diretamente com fluxos (Funis do CRM) e conexões de WhatsApp (Instâncias Baileys/Evolution).

**IMPORTANTE:** O sistema foi projetado para NÃO depender do Supabase ou qualquer outro BaaS de terceiros. Todo o armazenamento, isolamento de dados e consultas são feitos pelo MySQL com o pacote `mysql2`.

## Arquitetura de Dados
Foram criadas 9 entidades no banco de dados para suportar as operações, todas possuindo a chave de isolamento `tenant_id` garantindo o Multi-Tenant.
1. `ds_agent_folders` - Pastas para organizar os agentes de IA.
2. `ds_agents` - O agente em si (configurações globais de comportamento).
3. `ds_agent_subagents` - Sub-agentes que podem assumir etapas de raciocínio.
4. `ds_agent_knowledge` - Arquivos e textos que formam a Base de Conhecimento (RAG).
5. `ds_agent_tools` - Ferramentas que o agente pode chamar via Function Calling (Webhook, Pesquisar Cliente, etc).
6. `ds_agent_assignments` - Regras de atribuição (onde o agente atuará: ex. Funil de Vendas).
7. `ds_agent_sessions` - Controle das sessões abertas de chat com cada contato do CRM.
8. `ds_agent_usage` - Métricas consolidadas de requisições, custos e contagem de tokens por agente.
9. `ds_agent_logs` - Histórico de log detalhado para debug de comportamentos falhos.

O schema pode ser gerado/atualizado executando o script de migração:
`npx tsx scripts/ds-agente-schema.ts`

## Segurança
- As chaves de API (`api_key`) de provedores (OpenAI, Anthropic, Gemini, etc.) são criptografadas no banco utilizando `aes-256-gcm`.
- A chave de criptografia é derivada da variável de ambiente `JWT_SECRET` (utilizando os primeiros 32 caracteres) ou de uma chave padrão codificada (`DS_CRYPTO_FALLBACK_KEY`).
- Utilitários disponíveis em: `src/lib/ds-crypto.ts`.

## UI/Componentes
As interfaces foram divididas para otimizar o carregamento e navegação de estado do TanStack Start. O ponto de entrada principal é `src/routes/_app/ai-agent.tsx`.
A renderização e navegação de estado interno fica contida em `AiAgentManager` (`src/components/ai-agent/AiAgentManager.tsx`).

### Editor do Agente (5 Abas)
Ao editar um Agente, a UI é renderizada no arquivo `AgentEditor.tsx`, que provê:
1. **Treinamento (`TrainingTab.tsx`)**: Prompts primários de comportamento e variáveis de contexto do CRM.
2. **Conhecimento (`KnowledgeTab.tsx`)**: Repositório de documentos/URLs do Agente.
3. **Ferramentas (`ToolsTab.tsx`)**: Mapeamento de integrações externas.
4. **Integrações (`IntegrationTab.tsx`)**: Vincular o agente a uma Conexão do WhatsApp ou um Funil específico.
5. **Teste (`TestTab.tsx`)**: Simulador rápido de resposta para validar a temperatura e o comportamento.
6. **Uso (`UsageTab.tsx`)**: Métricas de mensagens, custos e contagem total de interações.

## Configurações de Comportamento (Limites e Intervenção)
Na janela de configurações de comportamento (engrenagem), os usuários podem ajustar:
- **Temperatura / Max Tokens:** Precisão x Criatividade.
- **Answer Only Assigned:** Restringir respostas apenas se o agente estiver assinado ao ticket.
- **Pause on Human:** Pausar automaticamente a IA caso o usuário (Atendente Humano) envie uma mensagem.
- **Tempo de Espera:** Adicionar atraso artificial na digitação/envio (humanização).
- **Limite de Mensagens:** Limite configurável para acionar transferência humana após X mensagens trocadas na mesma sessão.

## Considerações para Execução
Para o sistema funcionar, lembre-se de que a instância da conexão do WhatsApp (Engine) deve interagir com as Server Functions em `src/lib/ds-agent.functions.ts` toda vez que receber uma mensagem de um contato cujo Funil esteja assinado para IA. Recomendamos a injeção desse fluxo de captura no arquivo `webhooks.server.ts` e/ou diretamente em `src/components/crm/board/Column.tsx` no drop/assign do contato.
