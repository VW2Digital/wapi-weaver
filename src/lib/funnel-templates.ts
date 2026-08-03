export interface FunnelTemplateStage {
  name: string;
  color: string;
  probability_percent: number;
  is_won_stage?: boolean;
  is_lost_stage?: boolean;
  description?: string;
}

export interface FunnelTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  iconName: string;
  badgeColor: string;
  stages: FunnelTemplateStage[];
}

export const FUNNEL_TEMPLATES: FunnelTemplate[] = [
  {
    id: "b2b-sales",
    name: "Vendas B2B Outbound",
    category: "Vendas & Negócios",
    description: "Ideal para prospecção ativa de empresas, agendamento de reuniões e fechamento de contratos.",
    iconName: "Briefcase",
    badgeColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    stages: [
      { name: "Prospecção", color: "#3b82f6", probability_percent: 10 },
      { name: "Contato Realizado", color: "#06b6d4", probability_percent: 25 },
      { name: "Reunião Agendada", color: "#8b5cf6", probability_percent: 40 },
      { name: "Proposta Enviada", color: "#f59e0b", probability_percent: 65 },
      { name: "Em Negociação", color: "#ec4899", probability_percent: 85 },
      { name: "Fechado / Ganho", color: "#10b981", probability_percent: 100, is_won_stage: true },
      { name: "Perdido", color: "#ef4444", probability_percent: 0, is_lost_stage: true },
    ],
  },
  {
    id: "inbound-leads",
    name: "Qualificação de Leads (Inbound)",
    category: "Marketing & Vendas",
    description: "Para capturar contatos do site/WhatsApp, qualificar oportunidades (MQL/SQL) e converter em vendas.",
    iconName: "Filter",
    badgeColor: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800",
    stages: [
      { name: "Novo Lead", color: "#6366f1", probability_percent: 10 },
      { name: "Em Qualificação", color: "#0284c7", probability_percent: 30 },
      { name: "Lead Qualificado (SQL)", color: "#14b8a6", probability_percent: 50 },
      { name: "Apresentação de Solução", color: "#f59e0b", probability_percent: 70 },
      { name: "Contrato / Proposta", color: "#8b5cf6", probability_percent: 90 },
      { name: "Cliente Convertido", color: "#10b981", probability_percent: 100, is_won_stage: true },
      { name: "Desqualificado", color: "#ef4444", probability_percent: 0, is_lost_stage: true },
    ],
  },
  {
    id: "services-agency",
    name: "Prestação de Serviços & Projetos",
    category: "Serviços & Consultoria",
    description: "Perfeito para agências, consultorias e freelancers gerenciarem orçamentos e propostas.",
    iconName: "FileText",
    badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    stages: [
      { name: "Briefing Recebido", color: "#64748b", probability_percent: 15 },
      { name: "Diagnóstico / Orçamento", color: "#06b6d4", probability_percent: 35 },
      { name: "Proposta Apresentada", color: "#eab308", probability_percent: 60 },
      { name: "Ajuste de Escopo", color: "#a855f7", probability_percent: 80 },
      { name: "Contrato Assinado", color: "#10b981", probability_percent: 100, is_won_stage: true },
      { name: "Proposta Recusada", color: "#ef4444", probability_percent: 0, is_lost_stage: true },
    ],
  },
  {
    id: "post-sales-cs",
    name: "Pós-Venda & Onboarding (CS)",
    category: "Customer Success",
    description: "Acompanhe o onboarding do cliente, suporte inicial, retenção e oportunidades de upsell.",
    iconName: "HeartHandshake",
    badgeColor: "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-200 dark:border-pink-800",
    stages: [
      { name: "Boas-Vindas / Kickoff", color: "#3b82f6", probability_percent: 20 },
      { name: "Configuração & Setup", color: "#0284c7", probability_percent: 40 },
      { name: "Treinamento Concluído", color: "#8b5cf6", probability_percent: 70 },
      { name: "Cliente Ativo", color: "#10b981", probability_percent: 90 },
      { name: "Fidelizado / Renovado", color: "#059669", probability_percent: 100, is_won_stage: true },
      { name: "Cancelado / Churn", color: "#ef4444", probability_percent: 0, is_lost_stage: true },
    ],
  },
  {
    id: "ecommerce-launch",
    name: "Lançamento & Recuperação de Vendas",
    category: "E-Commerce & Digital",
    description: "Acompanhe inscritos, engajados em grupos VIP, checkouts iniciados e recuperação de carrinho.",
    iconName: "ShoppingCart",
    badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    stages: [
      { name: "Inscrito no Evento", color: "#6366f1", probability_percent: 15 },
      { name: "Engajado no VIP", color: "#06b6d4", probability_percent: 35 },
      { name: "Checkout Iniciado", color: "#f59e0b", probability_percent: 65 },
      { name: "Recuperação de Carrinho", color: "#e11d48", probability_percent: 80 },
      { name: "Venda Concluída", color: "#10b981", probability_percent: 100, is_won_stage: true },
      { name: "Abandono Definitivo", color: "#94a3b8", probability_percent: 0, is_lost_stage: true },
    ],
  },
  {
    id: "recruitment-rh",
    name: "Recrutamento & Seleção (RH)",
    category: "Recursos Humanos",
    description: "Gerencie o fluxo de candidatos, entrevistas, testes técnicos e contratações da empresa.",
    iconName: "Users",
    badgeColor: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800",
    stages: [
      { name: "Candidatura Recebida", color: "#64748b", probability_percent: 10 },
      { name: "Triagem de Currículo", color: "#0284c7", probability_percent: 30 },
      { name: "Entrevista RH", color: "#8b5cf6", probability_percent: 50 },
      { name: "Teste Técnico", color: "#f59e0b", probability_percent: 70 },
      { name: "Entrevista Gestor", color: "#ec4899", probability_percent: 85 },
      { name: "Contratado", color: "#10b981", probability_percent: 100, is_won_stage: true },
      { name: "Não Aprovado", color: "#ef4444", probability_percent: 0, is_lost_stage: true },
    ],
  },
];
