import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { usePageHeader } from "@/components/layout/page-header-provider";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  BookOpen,
  Search,
  MessageSquare,
  Bot,
  Webhook,
  Megaphone,
  Kanban,
  Code2,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  Sparkles,
  ShieldCheck,
  Zap,
  Settings,
  HelpCircle,
  FileText,
  ArrowUpRight,
  Terminal,
} from "lucide-react";
import { toast } from "sonner";

function DocsPage() {
  const [search, setSearch] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);

  usePageHeader({
    title: "Ajuda & Documentação",
    subtitle: "Guias passo a passo, manuais de configuração, APIs e integrações da plataforma.",
  });

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    toast.success("Código copiado para a área de transferência!");
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const curlExample = `curl -X POST "https://seu-dominio.com.br/api/webhooks/incoming" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: SUA_CHAVE_API_AQUI" \\
  -d '{
    "phone": "5511999998888",
    "name": "Carlos Silva",
    "email": "carlos@empresa.com",
    "custom_fields": {
      "empresa": "Tech Solutions",
      "cargo": "Gerente de TI",
      "origem": "Campanha Facebook"
    }
  }'`;

  const nodeExample = `const fetch = require('node-fetch');

async function enviarContato() {
  const response = await fetch('https://seu-dominio.com.br/api/webhooks/incoming', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': 'SUA_CHAVE_API_AQUI'
    },
    body: JSON.stringify({
      phone: '5511999998888',
      name: 'Carlos Silva',
      email: 'carlos@empresa.com',
      custom_fields: {
        empresa: 'Tech Solutions',
        cargo: 'Gerente de TI'
      }
    })
  });

  const result = await response.json();
  console.log(result);
}

enviarContato();`;

  const pythonExample = `import requests

url = "https://seu-dominio.com.br/api/webhooks/incoming"
headers = {
    "Content-Type": "application/json",
    "X-API-Key": "SUA_CHAVE_API_AQUI"
}

payload = {
    "phone": "5511999998888",
    "name": "Carlos Silva",
    "email": "carlos@empresa.com",
    "custom_fields": {
        "empresa": "Tech Solutions",
        "cargo": "Gerente de TI"
    }
}

response = requests.post(url, json=payload, headers=headers)
print(response.json())`;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <div className="flex-1 overflow-y-auto p-6 space-y-8 max-w-7xl mx-auto w-full">
        {/* Banner Superior com Pesquisa */}
        <div className="relative rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 md:p-8 overflow-hidden shadow-sm">
          <div className="absolute right-0 top-0 -mt-8 -mr-8 h-48 w-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

          <div className="max-w-2xl space-y-4 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 text-primary text-xs font-semibold">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Central de Conhecimento & Integrações</span>
            </div>

            <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              Como podemos ajudar você hoje?
            </h1>

            <p className="text-sm text-muted-foreground leading-relaxed">
              Explore nossos tutoriais passo a passo para conectar o WhatsApp Cloud API oficial da Meta, criar Agentes de IA inteligentes, integrar webhooks e enviar disparos em massa.
            </p>

            {/* Input de Pesquisa */}
            <div className="relative mt-2">
              <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar por WhatsApp Cloud API, Agente de IA, Webhooks, CSV..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-11 bg-background/80 backdrop-blur-sm border-border text-sm shadow-sm rounded-xl focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>
          </div>
        </div>

        {/* Atalhos Rápidos */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Link
            to="/settings"
            search={{ s: undefined }}
            className="flex flex-col items-center justify-center p-4 rounded-xl border border-border/80 bg-card hover:bg-muted/40 transition-all hover:scale-[1.02] text-center gap-2 group"
          >
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-500 group-hover:scale-110 transition-transform">
              <MessageSquare className="h-5 w-5" />
            </div>
            <span className="text-xs font-medium text-foreground">Cloud API</span>
          </Link>

          <Link
            to="/ds-agente"
            className="flex flex-col items-center justify-center p-4 rounded-xl border border-border/80 bg-card hover:bg-muted/40 transition-all hover:scale-[1.02] text-center gap-2 group"
          >
            <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-500 group-hover:scale-110 transition-transform">
              <Bot className="h-5 w-5" />
            </div>
            <span className="text-xs font-medium text-foreground">DS Agente IA</span>
          </Link>

          <Link
            to="/webhooks"
            className="flex flex-col items-center justify-center p-4 rounded-xl border border-border/80 bg-card hover:bg-muted/40 transition-all hover:scale-[1.02] text-center gap-2 group"
          >
            <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-500 group-hover:scale-110 transition-transform">
              <Webhook className="h-5 w-5" />
            </div>
            <span className="text-xs font-medium text-foreground">Webhooks</span>
          </Link>

          <Link
            to="/campaigns"
            className="flex flex-col items-center justify-center p-4 rounded-xl border border-border/80 bg-card hover:bg-muted/40 transition-all hover:scale-[1.02] text-center gap-2 group"
          >
            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-500 group-hover:scale-110 transition-transform">
              <Megaphone className="h-5 w-5" />
            </div>
            <span className="text-xs font-medium text-foreground">Campanhas</span>
          </Link>

          <Link
            to="/crm"
            className="flex flex-col items-center justify-center p-4 rounded-xl border border-border/80 bg-card hover:bg-muted/40 transition-all hover:scale-[1.02] text-center gap-2 group"
          >
            <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-500 group-hover:scale-110 transition-transform">
              <Kanban className="h-5 w-5" />
            </div>
            <span className="text-xs font-medium text-foreground">CRM & Kanban</span>
          </Link>

          <a
            href="#api-doc"
            className="flex flex-col items-center justify-center p-4 rounded-xl border border-border/80 bg-card hover:bg-muted/40 transition-all hover:scale-[1.02] text-center gap-2 group"
          >
            <div className="p-2.5 rounded-lg bg-cyan-500/10 text-cyan-500 group-hover:scale-110 transition-transform">
              <Code2 className="h-5 w-5" />
            </div>
            <span className="text-xs font-medium text-foreground">API REST</span>
          </a>
        </div>

        {/* Guias Principais divididos em Abas */}
        <Tabs defaultValue="whatsapp" className="space-y-6">
          <TabsList className="bg-muted/50 p-1 rounded-xl gap-1 flex flex-wrap h-auto">
            <TabsTrigger value="whatsapp" className="gap-2 text-xs py-2 px-3 rounded-lg">
              <MessageSquare className="h-4 w-4 text-emerald-500" /> WhatsApp Cloud API
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-2 text-xs py-2 px-3 rounded-lg">
              <Bot className="h-4 w-4 text-purple-500" /> Agentes de IA & Bots
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="gap-2 text-xs py-2 px-3 rounded-lg">
              <Webhook className="h-4 w-4 text-amber-500" /> Webhooks & Integrações
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="gap-2 text-xs py-2 px-3 rounded-lg">
              <Megaphone className="h-4 w-4 text-blue-500" /> Disparos & Importação
            </TabsTrigger>
            <TabsTrigger value="crm" className="gap-2 text-xs py-2 px-3 rounded-lg">
              <Kanban className="h-4 w-4 text-indigo-500" /> CRM & Funis
            </TabsTrigger>
          </TabsList>

          {/* ABA 1: WhatsApp Cloud API */}
          <TabsContent value="whatsapp" className="space-y-4">
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-2">
                <MessageSquare className="h-5 w-5 text-emerald-500" />
                Como Conectar o WhatsApp Cloud API Oficial da Meta
              </h3>
              <p className="text-xs text-muted-foreground mb-6">
                Siga este tutorial para vincular sua conta do WhatsApp Business Cloud API diretamente na plataforma com suporte oficial e alta taxa de entrega.
              </p>

              <Accordion type="single" collapsible defaultValue="wapi-1" className="w-full">
                <AccordionItem value="wapi-1">
                  <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                    1. Obter as Credenciais no Meta Business Suite
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 text-xs text-muted-foreground leading-relaxed pt-2">
                    <ol className="list-decimal pl-5 space-y-2">
                      <li>
                        Acesse o painel para desenvolvedores da Meta em{" "}
                        <a
                          href="https://developers.facebook.com"
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary underline inline-flex items-center gap-1 font-medium"
                        >
                          developers.facebook.com <ExternalLink className="h-3 w-3" />
                        </a>
                      </li>
                      <li>Crie ou selecione um aplicativo do tipo <strong>Empresarial (Business)</strong>.</li>
                      <li>Adicione o produto <strong>WhatsApp</strong> ao aplicativo.</li>
                      <li>
                        Na aba <strong>WhatsApp &gt; Configuração de API</strong>, copie os seguintes dados:
                        <ul className="list-disc pl-5 mt-1 space-y-1 font-mono text-[11px] text-foreground">
                          <li>ID do número de telefone (Phone Number ID)</li>
                          <li>ID da conta do WhatsApp Business (WABA ID)</li>
                        </ul>
                      </li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="wapi-2">
                  <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                    2. Gerar Token Permanente de Usuário do Sistema
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 text-xs text-muted-foreground leading-relaxed pt-2">
                    <p>
                      Para evitar desconexões a cada 24 horas, gere um <strong>Token de Usuário do Sistema Permanente</strong> no Meta Business Manager:
                    </p>
                    <ol className="list-decimal pl-5 space-y-2">
                      <li>Acesse <strong>Configurações do Negócio &gt; Usuários do Sistema</strong>.</li>
                      <li>Crie um usuário com função de <strong>Administrador</strong>.</li>
                      <li>Clique em <strong>Gerar novo token</strong> e selecione o aplicativo criado.</li>
                      <li>Marque as permissões obrigatórias: <code>whatsapp_business_messaging</code> e <code>whatsapp_business_management</code>.</li>
                      <li>Copie e guarde o token gerado em um local seguro.</li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="wapi-3">
                  <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                    3. Inserir Credenciais na Plataforma
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 text-xs text-muted-foreground leading-relaxed pt-2">
                    <p>
                      Acesse a página de{" "}
                      <Link to="/settings" search={{ s: undefined }} className="text-primary underline font-medium">
                        Configurações &gt; Meta Cloud API
                      </Link>{" "}
                      e cole o <strong>Phone Number ID</strong>, <strong>WABA ID</strong> e <strong>Token de Acesso</strong>. Clique em <strong>Salvar Alterações</strong>.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="wapi-4">
                  <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                    4. Configurar Webhook de Mensagens Recebidas
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 text-xs text-muted-foreground leading-relaxed pt-2">
                    <p>
                      No painel da Meta, vá em <strong>WhatsApp &gt; Configuração</strong> na seção Webhook:
                    </p>
                    <div className="bg-muted p-3 rounded-lg font-mono text-[11px] space-y-1.5 border border-border">
                      <p><strong>URL de retorno de chamada:</strong> https://seu-dominio.com.br/api/webhooks/whatsapp</p>
                      <p><strong>Token de verificação:</strong> (Copie a chave configurada na aba Configurações)</p>
                    </div>
                    <p>
                      Clique em <strong>Verificar e Salvar</strong> e em seguida assine o campo <code>messages</code>.
                    </p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </Card>
          </TabsContent>

          {/* ABA 2: Agentes de IA & Bots */}
          <TabsContent value="ai" className="space-y-4">
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-2">
                <Bot className="h-5 w-5 text-purple-500" />
                DS Agente — Atendimento Humanizado com Inteligência Artificial
              </h3>
              <p className="text-xs text-muted-foreground mb-6">
                O DS Agente utiliza modelos avançados de IA para atender seus clientes 24h por dia, responder dúvidas complexas, coletar dados e avançar oportunidades no CRM.
              </p>

              <Accordion type="single" collapsible defaultValue="ai-1" className="w-full">
                <AccordionItem value="ai-1">
                  <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                    1. Criando um Novo Agente de IA
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 text-xs text-muted-foreground leading-relaxed pt-2">
                    <p>
                      Acesse{" "}
                      <Link to="/ds-agente" className="text-primary underline font-medium">
                        Automações &gt; DS Agente
                      </Link>{" "}
                      e clique em <strong>+ Novo Agente</strong>. Defina um nome (ex: <em>Assistente Comercial</em>) e selecione o modelo de linguagem (Gemini ou OpenAI).
                    </p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="ai-2">
                  <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                    2. Prompt de Instruções &amp; Personalidade
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 text-xs text-muted-foreground leading-relaxed pt-2">
                    <p>
                      No campo <strong>Prompt de Sistema</strong>, escreva o comportamento do agente. Exemplo:
                    </p>
                    <div className="bg-muted p-3 rounded-lg font-mono text-[11px] leading-normal border border-border whitespace-pre-wrap">
{`Você é a Sofia, consultora de vendas sênior da empresa Bliv.
Seu objetivo é cumprimentar o cliente com empatia, entender as necessidades dele e agendar uma demonstração.
Regras:
- Seja sempre educada, clara e objetiva.
- Nunca invente preços ou prazos não confirmados.
- Ao identificar interesse do cliente, ofereça os horários disponíveis.`}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="ai-3">
                  <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                    3. Adicionando Base de Conhecimento (Documentos e PDFs)
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 text-xs text-muted-foreground leading-relaxed pt-2">
                    <p>
                      Na aba <strong>Conhecimento</strong> do Agente, envie arquivos PDF, manuais ou FAQs em texto. A IA lerá todo o conteúdo e responderá dúvidas dos clientes com base estrita nesses documentos.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="ai-4">
                  <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                    4. Ferramentas Habilitadas (Tools &amp; Actions)
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 text-xs text-muted-foreground leading-relaxed pt-2">
                    <p>
                      O DS Agente pode realizar ações automáticas durante a conversa:
                    </p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li><strong>Mover Card no Kanban:</strong> Avança o lead para "Qualificado" ou "Reunião Agendada".</li>
                      <li><strong>Adicionar Tag:</strong> Categoriza o cliente com tags como "Interesse em B2B".</li>
                      <li><strong>Transferir para Atendente Humano:</strong> Pausa o agente e notifica a equipe.</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </Card>
          </TabsContent>

          {/* ABA 3: Webhooks & Integrações */}
          <TabsContent value="webhooks" className="space-y-4">
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-2">
                <Webhook className="h-5 w-5 text-amber-500" />
                Integração via Webhook de Entrada
              </h3>
              <p className="text-xs text-muted-foreground mb-6">
                Envie dados de formulários do seu site, Elementor, Hotmart, Kiwify ou CRM externo diretamente para a plataforma.
              </p>

              <div className="space-y-4" id="api-doc">
                <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Endpoint de Ingestão:
                  </span>
                  <div className="flex items-center gap-2 bg-background p-2.5 rounded-lg border font-mono text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-300">
                      POST
                    </Badge>
                    <span>https://seu-dominio.com.br/api/webhooks/incoming</span>
                  </div>
                </div>

                {/* Exemplo cURL */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Terminal className="h-4 w-4 text-primary" /> Requisição cURL
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs gap-1"
                      onClick={() => copyToClipboard(curlExample, "curl")}
                    >
                      {copiedIndex === "curl" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedIndex === "curl" ? "Copiado!" : "Copiar cURL"}
                    </Button>
                  </div>
                  <pre className="p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto border leading-relaxed">
                    {curlExample}
                  </pre>
                </div>

                {/* Exemplo Node.js */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Code2 className="h-4 w-4 text-blue-500" /> Exemplo JavaScript / Node.js
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs gap-1"
                      onClick={() => copyToClipboard(nodeExample, "node")}
                    >
                      {copiedIndex === "node" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedIndex === "node" ? "Copiado!" : "Copiar JS"}
                    </Button>
                  </div>
                  <pre className="p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto border leading-relaxed">
                    {nodeExample}
                  </pre>
                </div>

                {/* Exemplo Python */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Code2 className="h-4 w-4 text-purple-500" /> Exemplo Python
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs gap-1"
                      onClick={() => copyToClipboard(pythonExample, "py")}
                    >
                      {copiedIndex === "py" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedIndex === "py" ? "Copiado!" : "Copiar Python"}
                    </Button>
                  </div>
                  <pre className="p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto border leading-relaxed">
                    {pythonExample}
                  </pre>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* ABA 4: Disparos & Importação */}
          <TabsContent value="campaigns" className="space-y-4">
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-2">
                <Megaphone className="h-5 w-5 text-blue-500" />
                Disparos em Massa &amp; Importação de Contatos
              </h3>
              <p className="text-xs text-muted-foreground mb-6">
                Aprenda a importar listas de contatos com validação de colunas e enviar campanhas de mensagens segmentadas.
              </p>

              <Accordion type="single" collapsible defaultValue="camp-1" className="w-full">
                <AccordionItem value="camp-1">
                  <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                    1. Importando Contatos via Arquivo CSV
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 text-xs text-muted-foreground leading-relaxed pt-2">
                    <p>
                      Na página de{" "}
                      <Link to="/lists" className="text-primary underline font-medium">
                        Listas &amp; Tags
                      </Link>
                      , clique em <strong>Importar CSV</strong>.
                    </p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>O sistema exibirá uma amostra real das células do seu arquivo.</li>
                      <li>Mapeie as colunas para <strong>Telefone (Obrigatório)</strong>, <strong>Nome</strong>, <strong>E-mail</strong> ou <strong>Campos Personalizados</strong> (Ex: Endereço, Profissão, Empresa).</li>
                      <li>Colunas indesejadas podem ser marcadas para serem <strong>Ignoradas</strong>.</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="camp-2">
                  <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                    2. Limite de Tamanho de Arquivos de Mídia
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 text-xs text-muted-foreground leading-relaxed pt-2">
                    <p>
                      O sistema aceita upload de arquivos de imagem, vídeo e documentos de até <strong>20MB</strong> nas mensagens de campanha e no atendimento individual do chat.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="camp-3">
                  <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                    3. Regra da Janela de 24 Horas vs HSM Templates
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 text-xs text-muted-foreground leading-relaxed pt-2">
                    <p>
                      Para enviar mensagens ativas para clientes que não conversam com sua empresa há mais de 24h, a Meta exige o uso de <strong>Templates Aprovados (HSM)</strong>. Mensagens de texto livre só podem ser enviadas dentro da janela ativa de 24h.
                    </p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </Card>
          </TabsContent>

          {/* ABA 5: CRM & Funis */}
          <TabsContent value="crm" className="space-y-4">
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-2">
                <Kanban className="h-5 w-5 text-indigo-500" />
                Gestão de Funis de Vendas &amp; Kanban
              </h3>
              <p className="text-xs text-muted-foreground mb-6">
                Organize seus leads em etapas visuais do Kanban e gerencie o progresso das suas negociações.
              </p>

              <Accordion type="single" collapsible defaultValue="crm-1" className="w-full">
                <AccordionItem value="crm-1">
                  <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                    1. Criando Funis a partir de Templates Prontos
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 text-xs text-muted-foreground leading-relaxed pt-2">
                    <p>
                      Na página de{" "}
                      <Link to="/crm" className="text-primary underline font-medium">
                        CRM &amp; Kanban
                      </Link>
                      , clique em <strong>Novo Funil</strong> e navegue até a aba <strong>Modelos Prontos</strong>. Você pode escolher entre 6 modelos pré-configurados:
                    </p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Vendas B2B Outbound (Prospecção &gt; Qualificação &gt; Proposta &gt; Fechado)</li>
                      <li>Qualificação Inbound Lead</li>
                      <li>Prestação de Serviços</li>
                      <li>Customer Success &amp; Onboarding</li>
                      <li>Lançamentos &amp; E-Commerce</li>
                      <li>Recrutamento &amp; Seleção RH</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="crm-2">
                  <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                    2. Navegação em 3 Etapas no Menu do Chat
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 text-xs text-muted-foreground leading-relaxed pt-2">
                    <p>
                      Na tela de atendimento do <strong>Chat</strong>, clique no botão <strong>Kanban</strong> para visualizar os funis do seu usuário e mover o lead diretamente para a etapa desejada (Ex: <em>Kanban &gt; Funil de Vendas &gt; Proposta Enviada</em>).
                    </p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_app/docs")({ component: DocsPage });
