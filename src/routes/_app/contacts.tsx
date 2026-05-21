import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listContacts, createContact, deleteContact, bulkUpsertContacts,
  bulkDeleteContacts, bulkSetOptOut, bulkAddContactsToList, bulkAddTagToContacts,
} from "@/lib/contacts.functions";
import { listLists, listTags } from "@/lib/lists.functions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub,
  DropdownMenuSubTrigger, DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Trash2, Upload, Plus, Users, MoreHorizontal, ListPlus, Tag as TagIcon, ShieldOff, ShieldCheck } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { EmptyState } from "@/components/empty-state";
import { DataPagination } from "@/components/data-pagination";
import { useConfirm } from "@/components/confirm-dialog";
import { TableSkeleton } from "@/components/table-skeleton";

export const Route = createFileRoute("/_app/contacts")({ component: ContactsPage });

const PAGE_SIZE = 50;

function ContactsPage() {
  const fetch = useServerFn(listContacts);
  const fetchLists = useServerFn(listLists);
  const fetchTags = useServerFn(listTags);
  const create = useServerFn(createContact);
  const del = useServerFn(deleteContact);
  const bulk = useServerFn(bulkUpsertContacts);
  const bulkDel = useServerFn(bulkDeleteContacts);
  const bulkOpt = useServerFn(bulkSetOptOut);
  const bulkAddList = useServerFn(bulkAddContactsToList);
  const bulkAddTag = useServerFn(bulkAddTagToContacts);
  const qc = useQueryClient();
  const confirm = useConfirm();

  const { data: contacts, isLoading } = useQuery({ queryKey: ["contacts"], queryFn: () => fetch() });
  const lists = useQuery({ queryKey: ["lists"], queryFn: () => fetchLists() });
  const tags = useQuery({ queryKey: ["tags"], queryFn: () => fetchTags() });

  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ phone: "", name: "", email: "" });
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const createMut = useMutation({
    mutationFn: (d: typeof form) => create({ data: d as any }),
    onSuccess: () => { toast.success("Contato adicionado"); setOpen(false); setForm({ phone: "", name: "", email: "" }); qc.invalidateQueries({ queryKey: ["contacts"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["contacts"] });

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    let rows: any[] = [];
    try {
      if (f.name.endsWith(".csv")) {
        const text = await f.text();
        const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
        rows = parsed.data as any[];
      } else {
        const buf = await f.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      }
      const mapped = rows.map((r) => {
        const get = (...keys: string[]) => keys.map((k) => r[k] ?? r[k.toLowerCase()] ?? r[k.toUpperCase()]).find((v) => v != null && v !== "");
        const known = ["phone", "telefone", "celular", "name", "nome", "email", "e-mail"];
        const custom: Record<string, any> = {};
        for (const k of Object.keys(r)) {
          if (!known.includes(k.toLowerCase()) && r[k] != null && r[k] !== "") custom[k] = r[k];
        }
        return {
          phone: String(get("phone", "telefone", "celular") ?? ""),
          name: get("name", "nome") ?? null,
          email: get("email", "e-mail") ?? null,
          custom_fields: custom,
        };
      }).filter((r) => r.phone);
      if (mapped.length === 0) { toast.error("Nenhum telefone encontrado"); return; }
      const res = await bulk({ data: { rows: mapped } });
      toast.success(`${res.inserted} contatos importados${res.invalid ? `, ${res.invalid} inválidos` : ""}`);
      invalidate();
    } catch (err: any) {
      toast.error(err.message ?? "Falha ao importar");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return (contacts ?? []).filter((c: any) =>
      !s || c.phone_e164.includes(search) || c.name?.toLowerCase().includes(s) || c.email?.toLowerCase().includes(s)
    );
  }, [contacts, search]);

  const total = filtered.length;
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const allPagePicked = pageRows.length > 0 && pageRows.every((c: any) => picked.has(c.id));

  const togglePage = (checked: boolean) => {
    const n = new Set(picked);
    pageRows.forEach((c: any) => checked ? n.add(c.id) : n.delete(c.id));
    setPicked(n);
  };
  const toggleOne = (id: string, checked: boolean) => {
    const n = new Set(picked);
    checked ? n.add(id) : n.delete(id);
    setPicked(n);
  };

  const handleDeleteOne = async (id: string, label: string) => {
    const ok = await confirm({
      title: "Excluir contato?",
      description: <>Tem certeza que deseja excluir <strong>{label}</strong>? Esta ação não pode ser desfeita.</>,
      destructive: true, confirmText: "Excluir",
    });
    if (!ok) return;
    await del({ data: { id } });
    invalidate();
  };

  const handleBulkDelete = async () => {
    const ids = [...picked];
    const ok = await confirm({
      title: `Excluir ${ids.length} contato${ids.length === 1 ? "" : "s"}?`,
      description: "Esta ação não pode ser desfeita.",
      destructive: true, confirmText: "Excluir",
    });
    if (!ok) return;
    await bulkDel({ data: { ids } });
    setPicked(new Set());
    toast.success(`${ids.length} contatos excluídos`);
    invalidate();
  };

  const handleBulkOptOut = async (opted_out: boolean) => {
    const ids = [...picked];
    await bulkOpt({ data: { ids, opted_out } });
    toast.success(opted_out ? `${ids.length} marcados como opt-out` : `${ids.length} reativados`);
    setPicked(new Set());
    invalidate();
  };

  const handleAddToList = async (list_id: string, listName: string) => {
    const ids = [...picked];
    await bulkAddList({ data: { list_id, contact_ids: ids } });
    toast.success(`${ids.length} adicionados a "${listName}"`);
    qc.invalidateQueries({ queryKey: ["lists"] });
  };

  const handleAddTag = async (tag_id: string, tagName: string) => {
    const ids = [...picked];
    await bulkAddTag({ data: { tag_id, contact_ids: ids } });
    toast.success(`Tag "${tagName}" aplicada a ${ids.length} contatos`);
  };

  const goPage = (p: number) => { setPage(p); setPicked(new Set()); };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title="Contatos"
        subtitle={`${contacts?.length ?? 0} contato${(contacts?.length ?? 0) === 1 ? "" : "s"} cadastrado${(contacts?.length ?? 0) === 1 ? "" : "s"}.`}
        action={
          <div className="flex gap-2">
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" hidden onChange={handleFile} />
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" /> Importar CSV/XLSX
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" /> Novo contato</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Novo contato</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5"><Label>Telefone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+55 11 99999-0000" /></div>
                  <div className="space-y-1.5"><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>E-mail</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                  <Button onClick={() => createMut.mutate(form)} disabled={createMut.isPending} className="w-full">Adicionar</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto p-6">
        <Card>
          <div className="flex flex-wrap items-center gap-2 border-b p-3">
            <Input
              className="max-w-sm"
              placeholder="Buscar por nome, telefone ou e-mail…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
            {picked.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{picked.size} selecionado{picked.size === 1 ? "" : "s"}</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline"><MoreHorizontal className="mr-1 h-4 w-4" /> Ações em lote</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuLabel>Aplicar a {picked.size} contatos</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger><ListPlus className="mr-2 h-4 w-4" /> Adicionar a lista</DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="max-h-72 overflow-auto">
                        {(lists.data ?? []).length === 0 && <DropdownMenuItem disabled>Nenhuma lista</DropdownMenuItem>}
                        {(lists.data ?? []).map((l: any) => (
                          <DropdownMenuItem key={l.id} onClick={() => handleAddToList(l.id, l.name)}>{l.name}</DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger><TagIcon className="mr-2 h-4 w-4" /> Aplicar tag</DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="max-h-72 overflow-auto">
                        {(tags.data ?? []).length === 0 && <DropdownMenuItem disabled>Nenhuma tag</DropdownMenuItem>}
                        {(tags.data ?? []).map((t: any) => (
                          <DropdownMenuItem key={t.id} onClick={() => handleAddTag(t.id, t.name)}>
                            <span className="mr-2 inline-block h-3 w-3 rounded-full" style={{ background: t.color }} />{t.name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleBulkOptOut(true)}>
                      <ShieldOff className="mr-2 h-4 w-4" /> Marcar como opt-out
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkOptOut(false)}>
                      <ShieldCheck className="mr-2 h-4 w-4" /> Remover opt-out
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={handleBulkDelete}>
                      <Trash2 className="mr-2 h-4 w-4" /> Excluir selecionados
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button size="sm" variant="ghost" onClick={() => setPicked(new Set())}>Limpar</Button>
              </div>
            )}
          </div>
          <div className="overflow-auto">
            {isLoading ? (
              <p className="p-8 text-center text-muted-foreground">Carregando…</p>
            ) : total === 0 ? (
              <EmptyState
                icon={Users}
                title={search ? "Nenhum contato encontrado" : "Nenhum contato ainda"}
                description={search ? "Tente uma busca diferente." : "Importe um CSV/XLSX ou adicione manualmente seu primeiro contato."}
                action={!search && (
                  <Button onClick={() => fileRef.current?.click()}>
                    <Upload className="mr-2 h-4 w-4" /> Importar contatos
                  </Button>
                )}
              />
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 border-b bg-muted text-left text-xs uppercase text-foreground">
                  <tr>
                    <th className="w-10 p-3">
                      <Checkbox checked={allPagePicked} onCheckedChange={(c) => togglePage(!!c)} aria-label="Selecionar página" />
                    </th>
                    <th className="p-3">Telefone</th><th className="p-3">Nome</th><th className="p-3">E-mail</th><th className="p-3">Origem</th><th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((c: any) => (
                    <tr key={c.id} className={`border-b last:border-0 hover:bg-muted/30 ${picked.has(c.id) ? "bg-muted/40" : ""}`}>
                      <td className="p-3">
                        <Checkbox checked={picked.has(c.id)} onCheckedChange={(v) => toggleOne(c.id, !!v)} aria-label={`Selecionar ${c.phone_e164}`} />
                      </td>
                      <td className="p-3 font-mono">+{c.phone_e164}{c.opted_out && <span className="ml-2 rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] text-destructive">opt-out</span>}</td>
                      <td className="p-3">{c.name ?? "—"}</td>
                      <td className="p-3 text-muted-foreground">{c.email ?? "—"}</td>
                      <td className="p-3 text-xs"><span className="rounded bg-muted px-2 py-0.5">{c.source ?? "—"}</span></td>
                      <td className="p-3 text-right">
                        <Button size="icon" variant="ghost" aria-label="Excluir" onClick={() => handleDeleteOne(c.id, c.name ?? `+${c.phone_e164}`)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {total > PAGE_SIZE && (
            <DataPagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={goPage} />
          )}
        </Card>
      </div>
    </div>
  );
}
