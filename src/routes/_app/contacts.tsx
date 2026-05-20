import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listContacts, createContact, deleteContact, bulkUpsertContacts } from "@/lib/contacts.functions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Trash2, Upload, Plus } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import Papa from "papaparse";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/_app/contacts")({ component: ContactsPage });

function ContactsPage() {
  const fetch = useServerFn(listContacts);
  const create = useServerFn(createContact);
  const del = useServerFn(deleteContact);
  const bulk = useServerFn(bulkUpsertContacts);
  const qc = useQueryClient();
  const { data: contacts, isLoading } = useQuery({ queryKey: ["contacts"], queryFn: () => fetch() });
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ phone: "", name: "", email: "" });

  const createMut = useMutation({
    mutationFn: (d: typeof form) => create({ data: d as any }),
    onSuccess: () => { toast.success("Contato adicionado"); setOpen(false); setForm({ phone: "", name: "", email: "" }); qc.invalidateQueries({ queryKey: ["contacts"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contacts"] }),
  });

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
      qc.invalidateQueries({ queryKey: ["contacts"] });
    } catch (err: any) {
      toast.error(err.message ?? "Falha ao importar");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const filtered = (contacts ?? []).filter((c: any) =>
    !search || c.phone_e164.includes(search) || c.name?.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
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
      <div className="p-6">
        <Card>
          <div className="border-b p-3">
            <Input placeholder="Buscar por nome, telefone ou e-mail…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr><th className="p-3">Telefone</th><th className="p-3">Nome</th><th className="p-3">E-mail</th><th className="p-3">Origem</th><th className="p-3"></th></tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Carregando…</td></tr>}
                {!isLoading && filtered.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Nenhum contato.</td></tr>}
                {filtered.map((c: any) => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3 font-mono">+{c.phone_e164}</td>
                    <td className="p-3">{c.name ?? "—"}</td>
                    <td className="p-3 text-muted-foreground">{c.email ?? "—"}</td>
                    <td className="p-3 text-xs"><span className="rounded bg-muted px-2 py-0.5">{c.source ?? "—"}</span></td>
                    <td className="p-3 text-right">
                      <Button size="icon" variant="ghost" onClick={() => delMut.mutate(c.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
