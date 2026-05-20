import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listLists, createList, deleteList, addContactsToList,
  listTags, createTag, deleteTag, getListContacts, removeContactFromList,
} from "@/lib/lists.functions";
import { listContacts } from "@/lib/contacts.functions";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/lists")({ component: ListsPage });

function ListsPage() {
  const fetchLists = useServerFn(listLists);
  const fetchTags = useServerFn(listTags);
  const fetchContacts = useServerFn(listContacts);
  const newList = useServerFn(createList);
  const rmList = useServerFn(deleteList);
  const newTag = useServerFn(createTag);
  const rmTag = useServerFn(deleteTag);
  const addToList = useServerFn(addContactsToList);
  const getMembers = useServerFn(getListContacts);
  const rmMember = useServerFn(removeContactFromList);
  const qc = useQueryClient();

  const lists = useQuery({ queryKey: ["lists"], queryFn: () => fetchLists() });
  const tags = useQuery({ queryKey: ["tags"], queryFn: () => fetchTags() });
  const contacts = useQuery({ queryKey: ["contacts"], queryFn: () => fetchContacts() });

  const [listForm, setListForm] = useState({ name: "", description: "" });
  const [tagForm, setTagForm] = useState({ name: "", color: "#25D366" });
  const [selectedList, setSelectedList] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const members = useQuery({
    queryKey: ["list-members", selectedList?.id],
    queryFn: () => getMembers({ data: { list_id: selectedList!.id } }),
    enabled: !!selectedList,
  });

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader title="Listas & Tags" subtitle="Organize seus contatos para segmentar campanhas." />

      <div className="flex-1 overflow-y-auto grid gap-6 p-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Listas</h2>
              <Dialog>
                <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" /> Nova lista</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Nova lista</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>Nome</Label><Input value={listForm.name} onChange={(e) => setListForm({ ...listForm, name: e.target.value })} /></div>
                    <div><Label>Descrição</Label><Input value={listForm.description} onChange={(e) => setListForm({ ...listForm, description: e.target.value })} /></div>
                    <Button className="w-full" onClick={async () => {
                      try { await newList({ data: listForm }); toast.success("Lista criada"); setListForm({ name: "", description: "" }); qc.invalidateQueries({ queryKey: ["lists"] }); } catch (e: any) { toast.error(e.message); }
                    }}>Criar</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="mt-3 divide-y">
              {(lists.data ?? []).map((l: any) => (
                <button key={l.id} className={`flex w-full items-center justify-between py-3 text-left hover:bg-muted/30 ${selectedList?.id === l.id ? "bg-muted/50" : ""}`} onClick={() => { setSelectedList(l); setPicked(new Set()); }}>
                  <div className="px-2">
                    <p className="font-medium">{l.name}</p>
                    <p className="text-xs text-muted-foreground">{l.description ?? "—"} · {l.list_contacts?.[0]?.count ?? 0} contatos</p>
                  </div>
                  <Button size="icon" variant="ghost" onClick={async (e) => { e.stopPropagation(); await rmList({ data: { id: l.id } }); qc.invalidateQueries({ queryKey: ["lists"] }); }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </button>
              ))}
              {(lists.data ?? []).length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">Nenhuma lista.</p>}
            </div>
          </Card>

          {selectedList && (
            <Card className="p-4">
              <h3 className="font-display text-base font-semibold">{selectedList.name} — membros</h3>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Buscar contatos para adicionar</Label>
                  <Input className="mt-1" placeholder="Telefone ou nome…" value={search} onChange={(e) => setSearch(e.target.value)} />
                  <div className="mt-2 max-h-72 overflow-auto rounded border">
                    {(contacts.data ?? []).filter((c: any) => !search || c.phone_e164.includes(search) || c.name?.toLowerCase().includes(search.toLowerCase())).slice(0, 50).map((c: any) => (
                      <label key={c.id} className="flex items-center gap-2 border-b px-2 py-1.5 text-sm last:border-0 hover:bg-muted/30">
                        <input type="checkbox" checked={picked.has(c.id)} onChange={(e) => {
                          const n = new Set(picked); e.target.checked ? n.add(c.id) : n.delete(c.id); setPicked(n);
                        }} />
                        <span className="font-mono">+{c.phone_e164}</span>
                        <span className="text-muted-foreground">{c.name ?? ""}</span>
                      </label>
                    ))}
                  </div>
                  <Button className="mt-2 w-full" disabled={picked.size === 0} onClick={async () => {
                    await addToList({ data: { list_id: selectedList.id, contact_ids: [...picked] } });
                    toast.success(`${picked.size} adicionados`);
                    setPicked(new Set());
                    qc.invalidateQueries({ queryKey: ["lists"] });
                    qc.invalidateQueries({ queryKey: ["list-members", selectedList.id] });
                  }}>Adicionar {picked.size > 0 && `(${picked.size})`}</Button>
                </div>
                <div>
                  <Label>Membros atuais ({members.data?.length ?? 0})</Label>
                  <div className="mt-1 max-h-72 overflow-auto rounded border">
                    {(members.data ?? []).map((m: any) => (
                      <div key={m.contact_id} className="flex items-center justify-between border-b px-2 py-1.5 text-sm last:border-0">
                        <span className="font-mono">+{m.contacts?.phone_e164}</span>
                        <button onClick={async () => {
                          await rmMember({ data: { list_id: selectedList.id, contact_id: m.contact_id } });
                          qc.invalidateQueries({ queryKey: ["list-members", selectedList.id] });
                          qc.invalidateQueries({ queryKey: ["lists"] });
                        }}><X className="h-3 w-3 text-muted-foreground" /></button>
                      </div>
                    ))}
                    {(members.data ?? []).length === 0 && <p className="p-3 text-xs text-muted-foreground">Sem membros.</p>}
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>

        <Card className="h-fit p-4">
          <h2 className="font-display text-lg font-semibold">Tags</h2>
          <div className="mt-3 space-y-2">
            <div className="flex gap-2">
              <Input placeholder="nome" value={tagForm.name} onChange={(e) => setTagForm({ ...tagForm, name: e.target.value })} />
              <input type="color" className="h-9 w-12 rounded border" value={tagForm.color} onChange={(e) => setTagForm({ ...tagForm, color: e.target.value })} />
              <Button onClick={async () => { try { await newTag({ data: tagForm }); setTagForm({ name: "", color: "#25D366" }); qc.invalidateQueries({ queryKey: ["tags"] }); } catch (e: any) { toast.error(e.message); } }}>Add</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(tags.data ?? []).map((t: any) => (
                <span key={t.id} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs text-white" style={{ background: t.color }}>
                  {t.name}
                  <button onClick={async () => { await rmTag({ data: { id: t.id } }); qc.invalidateQueries({ queryKey: ["tags"] }); }}><X className="h-3 w-3" /></button>
                </span>
              ))}
              {(tags.data ?? []).length === 0 && <p className="text-xs text-muted-foreground">Sem tags.</p>}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
