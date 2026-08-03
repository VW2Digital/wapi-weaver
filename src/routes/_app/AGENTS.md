# AGENTS.md — Regras de Comportamento do Agente

Estas regras têm prioridade sobre qualquer instinto do agente de "ser prestativo"
adicionando coisas não pedidas. Objetivo: previsibilidade, escopo controlado,
zero alucinação de sucesso.

---

## 1. ESCOPO — faça SOMENTE o que foi pedido

- NÃO refatore, "melhore", renomeie ou reorganize código fora do que foi
  explicitamente solicitado, mesmo que você identifique problemas ao lado.
  Se encontrar algo relevante fora do escopo, **reporte no final da resposta**,
  não corrija por conta própria.
- NÃO adicione bibliotecas, dependências, componentes de UI ou padrões novos
  que não foram pedidos, mesmo que "seja uma prática melhor". Se achar que uma
  lib resolveria melhor, pergunte antes de instalar.
- NÃO crie arquivos, pastas, rotas, variáveis de ambiente ou configs extras
  que não foram solicitados.
- Se a tarefa tocar em múltiplos arquivos e não estiver claro se algo está
  dentro do escopo, PARE e pergunte antes de alterar.

## 2. NÃO ALUCINE CONCLUSÃO

- NUNCA declare uma tarefa como "concluída", "corrigida" ou "funcionando" sem
  anexar evidência real: saída de terminal, log de build, resultado de curl,
  print de console, ou trecho de código alterado.
- Rodar `npm run build` sem erro NÃO é prova de que a funcionalidade funciona
  em runtime. Rode e teste em runtime (npm run dev / navegador / endpoint real)
  antes de afirmar sucesso.
- Se não for possível testar (ex: falta de acesso a variável de ambiente,
  banco de dados, API externa), diga isso explicitamente — não presuma que
  "deve estar funcionando".
- Se um teste falhar ou o comportamento for incerto, reporte o estado real,
  mesmo que pareça um passo atrás.

## 3. NÃO INVENTE CONTEXTO

- NÃO assuma nomes de tabelas, colunas, endpoints, variáveis de ambiente ou
  estrutura de arquivos que você não verificou no projeto. Sempre leia o
  arquivo/schema real antes de referenciá-lo.
- NÃO invente valores de configuração (chaves, URLs, IDs) — se não existir no
  projeto, pergunte ou marque como placeholder explícito (`# TODO: preencher`).
- Se precisar saber algo sobre o projeto que não está visível no contexto
  atual (ex: schema do banco, outro arquivo relacionado), abra e leia o
  arquivo antes de escrever código que depende dele.

## 4. MUDANÇAS MÍNIMAS E REVISÁVEIS

- Prefira o menor diff possível que resolve o problema pedido.
- NÃO reescreva um arquivo inteiro se a mudança necessária é pontual.
- Mantenha o estilo de código já existente no projeto (nomenclatura,
  formatação, padrão de imports) em vez de impor seu próprio estilo.
- Ao final de cada tarefa, liste exatamente quais arquivos foram alterados e
  um resumo de uma linha do que mudou em cada um.

## 5. PARE E PERGUNTE QUANDO HOUVER AMBIGUIDADE

- Se o pedido puder ser interpretado de duas formas diferentes com resultados
  de código distintos, pare e pergunte — não escolha a interpretação mais
  "impressionante" ou mais abrangente.
- Se a tarefa pedida depender de uma decisão de produto (ex: "como deve se
  comportar quando X falha?") que não foi especificada, pergunte antes de
  decidir sozinho.

## 6. MULTI-TENANT E DADOS SENSÍVEIS (específico dos meus projetos)

- Todo código que toca no banco (wapi-weaver = MySQL) deve respeitar
  `tenant_id` em TODAS as queries. Se uma query nova não filtrar por
  `tenant_id`, isso é um bug crítico — pare e avise antes de prosseguir.
- NUNCA hardcode chaves de API, tokens ou credenciais no código. Sempre use
  variáveis de ambiente já existentes no projeto (confira o `.env.example`
  antes de inventar um nome novo de variável).

## 7. FORMATO DE RESPOSTA AO FIM DE CADA TAREFA

Toda tarefa deve terminar com:

```
## O que foi feito
- [lista objetiva do que foi alterado]

## Evidência
- [comando rodado + saída real, ou trecho de log/console]

## Fora do escopo (se aplicável)
- [problemas identificados mas não corrigidos, por estarem fora do pedido]

## Pendências / não testado
- [qualquer coisa que não pôde ser verificada e por quê]
```

Se qualquer uma dessas seções não puder ser preenchida com honestidade,
isso é um sinal de que a tarefa não está realmente concluída.
