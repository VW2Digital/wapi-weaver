import React, { useState } from "react";
import { RefreshCw, BarChart2, DollarSign, Activity, Cpu, PieChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface UsageData {
  summary: {
    total_tokens: number;
    custo_estimado: number;
    requisicoes: number;
    media_por_req: number;
  };
  tokens_por_dia: Array<{ date: string; tokens: number }>;
  por_categoria: {
    action_analysis: number;
    completion: number;
    embedding: number;
    query_rewriting: number;
    transcription: number;
  };
  detalhamento_por_modelo: Array<{
    modelo: string;
    provider: string;
    tokens: number;
    requisicoes: number;
    custo: number;
  }>;
}

interface TabUsageReportProps {
  usageData?: UsageData;
  onRefresh?: () => void;
}

export function TabUsageReport({ usageData, onRefresh }: TabUsageReportProps) {
  const [range, setRange] = useState("30d");

  const defaultData: UsageData = {
    summary: {
      total_tokens: 45200,
      custo_estimado: 0.0904,
      requisicoes: 38,
      media_por_req: 1189,
    },
    tokens_por_dia: [
      { date: "18/07", tokens: 2500 },
      { date: "19/07", tokens: 3800 },
      { date: "20/07", tokens: 4100 },
      { date: "21/07", tokens: 3200 },
      { date: "22/07", tokens: 5100 },
      { date: "23/07", tokens: 4900 },
      { date: "24/07", tokens: 3000 },
      { date: "25/07", tokens: 2800 },
      { date: "26/07", tokens: 4200 },
      { date: "27/07", tokens: 3900 },
      { date: "28/07", tokens: 2100 },
      { date: "29/07", tokens: 1900 },
      { date: "30/07", tokens: 3700 },
    ],
    por_categoria: {
      action_analysis: 20,
      completion: 55,
      embedding: 10,
      query_rewriting: 10,
      transcription: 5,
    },
    detalhamento_por_modelo: [
      { modelo: "gpt-4o-mini", provider: "OpenAI Padrão", tokens: 33900, requisicoes: 28, custo: 0.0508 },
      { modelo: "gpt-4o", provider: "OpenAI Padrão", tokens: 11300, requisicoes: 10, custo: 0.0396 },
    ],
  };

  const data = usageData || defaultData;
  const maxTokens = Math.max(...data.tokens_por_dia.map((d) => d.tokens), 100);

  const categories = [
    { label: "Action Analysis", key: "action_analysis", pct: data.por_categoria.action_analysis, color: "#F23869" },
    { label: "Completion", key: "completion", pct: data.por_categoria.completion, color: "#D93B92" },
    { label: "Embedding", key: "embedding", pct: data.por_categoria.embedding, color: "#BF39B6" },
    { label: "Query Rewriting", key: "query_rewriting", pct: data.por_categoria.query_rewriting, color: "#F26A4B" },
    { label: "Transcription", key: "transcription", pct: data.por_categoria.transcription, color: "#3b82f6" },
  ];

  return (
    <div className="space-y-6">
      {/* Title & Refresh Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-display font-bold text-foreground flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-primary" /> Relatório de Uso
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Acompanhe o consumo de tokens, requisições e custo acumulado do agente.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-40 bg-background border-border text-xs text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border text-popover-foreground text-xs">
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRefresh}
            className="border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Tokens</span>
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <Cpu className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-display font-bold text-foreground mt-2">
            {data.summary.total_tokens.toLocaleString("pt-BR")}
          </p>
          <span className="text-[10px] text-muted-foreground mt-1 block">Consumo total do agente</span>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Custo Estimado</span>
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-display font-bold text-foreground mt-2">
            ${data.summary.custo_estimado.toFixed(4)} USD
          </p>
          <span className="text-[10px] text-muted-foreground mt-1 block">Baseado nas tabelas dos provedores</span>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Requisições</span>
            <div className="rounded-lg bg-blue-500/10 p-2 text-blue-600 dark:text-blue-400">
              <Activity className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-display font-bold text-foreground mt-2">{data.summary.requisicoes}</p>
          <span className="text-[10px] text-muted-foreground mt-1 block">Chamadas efetuadas à API</span>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Média / Requisição</span>
            <div className="rounded-lg bg-purple-500/10 p-2 text-purple-600 dark:text-purple-400">
              <BarChart2 className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-display font-bold text-foreground mt-2">
            {data.summary.media_por_req.toLocaleString("pt-BR")} tokens
          </p>
          <span className="text-[10px] text-muted-foreground mt-1 block">Tokens médios por mensagem</span>
        </div>
      </div>

      {/* Charts Grid: Bar Chart & Donut Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar Chart: Tokens por Dia */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-6 space-y-4 shadow-sm">
          <h4 className="text-sm font-display font-bold text-foreground flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-primary" /> Tokens por Dia
          </h4>

          <div className="h-56 flex items-end justify-between gap-2 pt-6">
            {data.tokens_por_dia.map((d, i) => {
              const heightPct = Math.max(10, Math.round((d.tokens / maxTokens) * 100));
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 group relative">
                  <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-popover border border-border text-popover-foreground text-[10px] px-1.5 py-0.5 rounded pointer-events-none whitespace-nowrap z-10 shadow-md">
                    {d.tokens} tokens
                  </div>
                  <div
                    style={{ height: `${heightPct}%` }}
                    className="w-full bg-primary/80 group-hover:bg-primary transition-all rounded-t-md"
                  />
                  <span className="text-[10px] text-muted-foreground truncate w-full text-center">
                    {d.date}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Donut / Category Breakdown */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4 shadow-sm">
          <h4 className="text-sm font-display font-bold text-foreground flex items-center gap-2">
            <PieChart className="h-4 w-4 text-primary" /> Por Categoria
          </h4>

          {/* Central Donut Graphic */}
          <div className="flex justify-center py-4">
            <div className="relative h-32 w-32 rounded-full border-8 border-primary/20 flex items-center justify-center">
              <span className="text-lg font-extrabold text-primary font-display">100%</span>
            </div>
          </div>

          <div className="space-y-2">
            {categories.map((c) => (
              <div key={c.key} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                  <span className="text-foreground font-medium">{c.label}</span>
                </div>
                <span className="font-semibold text-muted-foreground">{c.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Model Breakdown Table */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4 shadow-sm">
        <h4 className="text-sm font-display font-bold text-foreground">Detalhamento por Modelo</h4>
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="border-border hover:bg-muted/40">
              <TableHead className="text-muted-foreground font-semibold">Modelo</TableHead>
              <TableHead className="text-muted-foreground font-semibold">Provedor</TableHead>
              <TableHead className="text-right text-muted-foreground font-semibold">Tokens</TableHead>
              <TableHead className="text-right text-muted-foreground font-semibold">Requisições</TableHead>
              <TableHead className="text-right text-muted-foreground font-semibold">Custo Estimado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.detalhamento_por_modelo.map((m, idx) => (
              <TableRow key={idx} className="border-border/60 hover:bg-muted/30">
                <TableCell className="font-semibold text-foreground">{m.modelo}</TableCell>
                <TableCell className="text-muted-foreground">{m.provider}</TableCell>
                <TableCell className="text-right text-foreground font-mono">
                  {m.tokens.toLocaleString("pt-BR")}
                </TableCell>
                <TableCell className="text-right text-foreground font-mono">{m.requisicoes}</TableCell>
                <TableCell className="text-right text-primary font-mono font-semibold">
                  ${m.custo.toFixed(4)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
