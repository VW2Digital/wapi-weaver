import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTemplates, syncTemplatesFromMeta, seedSampleTemplates, deleteTemplate, deleteTemplatesBulk } from "@/lib/templates.functions";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WhatsAppPreview } from "@/components/whatsapp-preview";
import { RefreshCw, Sparkles, FileText, Plus, Trash2, X, Info, Megaphone, Bell, ShieldCheck, Wallet, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";
import { CardGridSkeleton } from "@/components/table-skeleton";
import { TemplateBuilderDialog } from "@/components/template-builder-dialog";
import { useConfirm } from "@/components/confirm-dialog";

export const Route = createFileRoute("/_app/templates")({ component: TemplatesPage });

const statusColors: Record<string, string> = {
  APPROVED: "bg-success/15 text-success",
  PENDING: "bg-warning/15 text-warning-foreground",
  REJECTED: "bg-destructive/15 text-destructive",
  PAUSED: "bg-muted text-muted-foreground",
  DISABLED: "bg-muted text-muted-foreground",
};

function TemplatesPage() {
  const fetch = useServerFn(listTemplates);
  const sync = useServerFn(syncTemplatesFromMeta);
  const seed = useServerFn(seedSampleTemplates);
  const remove = useServerFn(deleteTemplate);
  const removeBulk = useServerFn(deleteTemplatesBulk);
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { data, isLoading } = useQuery({ queryKey: ["templates"], queryFn: () => fetch() });
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const syncMut = useMutation({
    mutationFn: () => sync(),
    onSuccess: (r) => { toast.success(`${r.synced} templates sincronizados`); qc.invalidateQueries({ queryKey: ["templates"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const seedMut = useMutation({
    mutationFn: () => seed(),
    onSuccess: (r) => { toast.success(`${r.inserted} templates de exemplo adicionados`); qc.invalidateQueries({ queryKey: ["templates"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const bulkMut = useMutation({
    mutationFn: (ids: string[]) => removeBulk({ data: { ids } }),
    onSuccess: (r) => {
      toast.success(`${r.deleted} templates excluídos`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["templates"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return (data ?? []).filter((t: any) => {
      const matchesSearch = !s || t.name.toLowerCase().includes(s) || t.status.toLowerCase().includes(s) || (t.category ?? "").toLowerCase().includes(s);
      const matchesCategory = !categoryFilter || (t.category ?? "").toLowerCase() === categoryFilter.toLowerCase();
      return matchesSearch && matchesCategory;
    });
  }, [data, search, categoryFilter]);

  const allSelected = filtered.length > 0 && filtered.every((t: any) => selected.has(t.id));
  const someSelected = selected.size > 0;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map((t: any) => t.id)));
  }

  async function bulkDelete() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const ok = await confirm({
      title: `Excluir ${ids.length} templates?`,
      description: <>Os templates selecionados serão removidos aqui e na Meta (quando aplicável). Esta ação não pode ser desfeita.</>,
      destructive: true,
      confirmText: "Excluir todos",
    });
    if (!ok) return;
    bulkMut.mutate(ids);
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title="Templates"
        subtitle="Modelos aprovados pela Meta. São obrigatórios para iniciar uma conversa."
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => seedMut.mutate()} disabled={seedMut.isPending}>
              <Sparkles className="mr-2 h-4 w-4" /> Carregar exemplos
            </Button>
            <Button variant="outline" onClick={() => syncMut.mutate()} disabled={syncMut.isPending}>
              <RefreshCw className="mr-2 h-4 w-4" /> Sincronizar
            </Button>
            <TemplateBuilderDialog
              trigger={<Button><Plus className="mr-2 h-4 w-4" /> Novo template</Button>}
            />
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <InfoSection />
        {isLoading && <CardGridSkeleton count={6} />}
        {!isLoading && (data ?? []).length === 0 && (
          <Card>
            <EmptyState
              icon={FileText}
              title="Nenhum template ainda"
              description="Sincronize seus templates aprovados pela Meta ou carregue exemplos para começar."
              action={
                <div className="flex gap-2">
                  <TemplateBuilderDialog
                    trigger={<Button><Plus className="mr-2 h-4 w-4" /> Criar template</Button>}
                  />
                  <Button variant="outline" onClick={() => seedMut.mutate()} disabled={seedMut.isPending}>
                    <Sparkles className="mr-2 h-4 w-4" /> Exemplos
                  </Button>
                  <Button variant="outline" onClick={() => syncMut.mutate()} disabled={syncMut.isPending}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Sincronizar
                  </Button>
                </div>
              }
            />
          </Card>
        )}
        {!isLoading && (data ?? []).length > 0 && (
          <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              className="max-w-sm"
              placeholder="Buscar template por nome, status ou categoria…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select
              value={categoryFilter ?? "all"}
              onValueChange={(v) => setCategoryFilter(v === "all" ? null : v)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="Marketing">Marketing</SelectItem>
                <SelectItem value="Utility">Utility</SelectItem>
                <SelectItem value="Authentication">Authentication</SelectItem>
              </SelectContent>
            </Select>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
              Selecionar todos ({filtered.length})
            </label>
            {someSelected && (
              <div className="ml-auto flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-sm">
                <span className="font-medium">{selected.size} selecionado(s)</span>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={bulkDelete}
                  disabled={bulkMut.isPending}
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" /> Excluir
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((t: any) => {
            const isChecked = selected.has(t.id);
            return (
              <Card key={t.id} className={cn("overflow-hidden transition-all duration-300 hover:shadow-md hover:-translate-y-0.5", isChecked ? "ring-2 ring-primary" : "")}>
                <div className="border-b p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggle(t.id)}
                        aria-label={`Selecionar ${t.name}`}
                      />
                      <p className="font-medium truncate">{t.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusColors[t.status] ?? "bg-muted"}`}>{t.status}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Excluir template"
                        onClick={async () => {
                          const isRemote = t.meta_template_id && !t.meta_template_id.startsWith("sample_") && !t.meta_template_id.startsWith("local_");
                          const ok = await confirm({
                            title: "Excluir template?",
                            description: <>O template <strong>{t.name}</strong> será removido aqui{isRemote ? " e na Meta" : ""}.</>,
                            destructive: true,
                            confirmText: "Excluir",
                          });
                          if (!ok) return;
                          try {
                            await remove({ data: { id: t.id } });
                            toast.success("Template removido");
                            qc.invalidateQueries({ queryKey: ["templates"] });
                          } catch (e: any) { toast.error(e.message); }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{t.language} · {t.category ?? "—"}</p>
                </div>
                <div className="p-4">
                  <WhatsAppPreview components={t.components ?? []} />
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function InfoSection() {
  const categories = [
    {
      icon: Megaphone,
      name: "Marketing",
      desc: "Promoções, ofertas, novidades, convites e atualizações da marca.",
      price: "~R$ 0,20 – 0,40",
      tone: "bg-primary/10 text-primary",
    },
    {
      icon: Bell,
      name: "Utility",
      desc: "Confirmações, atualizações de conta, lembretes e notificações transacionais.",
      price: "~R$ 0,08 – 0,15",
      tone: "bg-warning/15 text-warning-foreground",
    },
    {
      icon: ShieldCheck,
      name: "Authentication",
      desc: "Códigos de verificação (OTP) para login, cadastro e recuperação de conta.",
      price: "~R$ 0,03 – 0,06",
      tone: "bg-success/15 text-success",
    },
  ];

  const tips = [
    { title: "Janela de 24h (grátis)", desc: "Mensagens dentro de 24h após o cliente iniciar o contato não são cobradas." },
    { title: "Use Utility no lugar de Marketing", desc: "Economize até 70% reclassificando notificações transacionais corretamente." },
    { title: "Prefira Authentication para OTP", desc: "É a categoria mais barata — apenas código + botão de copiar." },
    { title: "Incentive o cliente a iniciar", desc: "QR codes, links wa.me e chatbots no site abrem janelas gratuitas de 24h." },
  ];

  const [open, setOpen] = useState(false);
  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 border-b bg-muted/40 p-4 text-left transition hover:bg-muted/60"
      >
        <Info className="h-4 w-4 text-primary" />
        <h2 className="font-display text-base font-semibold">Informações sobre templates</h2>
        <ChevronDown className={`ml-auto h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
      <div className="grid gap-6 p-5 lg:grid-cols-2">
        <div>
          <h3 className="mb-3 text-sm font-semibold">Categorias oferecidas pela Meta</h3>
          <div className="space-y-2">
            {categories.map((c) => (
              <div key={c.name} className="flex items-start gap-3 rounded-lg border bg-card/50 p-3">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${c.tone}`}>
                  <c.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{c.name}</p>
                    <span className="text-xs font-medium tabular-nums text-muted-foreground">{c.price}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{c.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Wallet className="h-4 w-4 text-success" /> Formas mais baratas de enviar
          </h3>
          <ul className="space-y-2">
            {tips.map((t) => (
              <li key={t.title} className="rounded-lg border bg-card/50 p-3">
                <p className="text-sm font-medium">{t.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{t.desc}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-muted-foreground">
            * Valores aproximados para o Brasil. Podem variar conforme o BSP e atualizações da Meta.
          </p>
        </div>
      </div>
      )}
    </Card>
  );
}
