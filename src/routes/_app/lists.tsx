import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listLists,
  createList,
  deleteList,
  addContactsToList,
  listTags,
  createTag,
  deleteTag,
  getListContacts,
  removeContactFromList,
  importCsvToList,
} from "@/lib/lists.functions";
import { listContacts } from "@/lib/contacts.functions";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2, X, ListChecks, Tags } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { useConfirm } from "@/components/confirm-dialog";

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
  const importCsv = useServerFn(importCsvToList);
  const qc = useQueryClient();
  const confirm = useConfirm();

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

  const memberIds = new Set((members.data ?? []).map((m: any) => m.contact_id));
  const filteredContacts = (contacts.data ?? [])
    .filter(
      (c: any) =>
        !search ||
        c.phone_e164.includes(search) ||
        c.name?.toLowerCase().includes(search.toLowerCase()),
    );

  const handleSelectAll = () => {
    const newPicked = new Set(picked);
    filteredContacts.forEach((c: any) => {
      if (!memberIds.has(c.id)) {
        newPicked.add(c.id);
      }
    });
    setPicked(newPicked);
  };

  const handleClear = () => {
    setPicked(new Set());
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedList) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/);
      const parsedContacts: any[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const sep = line.includes(";") ? ";" : ",";
        const cols = line.split(sep).map(c => c.trim().replace(/^["']|["']$/g, ""));

        if (i === 0 && (
          line.toLowerCase().includes("phone") ||
          line.toLowerCase().includes("telefone") ||
          line.toLowerCase().includes("name") ||
          line.toLowerCase().includes("nome") ||
          line.toLowerCase().includes("email") ||
          line.toLowerCase().includes("e-mail")
        )) {
          continue;
        }

        let phone = "";
        let name = "";
        let email = "";

        if (cols.length >= 1) {
          const col0Clean = cols[0].replace(/\D+/g, "");
          const col1Clean = cols.length > 1 ? cols[1].replace(/\D+/g, "") : "";

          if (col0Clean.length >= 8 && (!col1Clean || col0Clean.length > col1Clean.length)) {
            phone = cols[0];
            name = cols.length > 1 ? cols[1] : "";
            email = cols.length > 2 ? cols[2] : "";
          } else if (cols.length > 1 && col1Clean.length >= 8) {
            name = cols[0];
            phone = cols[1];
            email = cols.length > 2 ? cols[2] : "";
          } else {
            phone = cols[0];
            if (cols.length > 1) name = cols[1];
            if (cols.length > 2) email = cols[2];
          }
        }

        if (phone.replace(/\D+/g, "").length >= 8) {
          parsedContacts.push({ phone, name: name || null, email: email || null });
        }
      }

      if (parsedContacts.length === 0) {
        toast.error("Nenhum contato válido encontrado no arquivo CSV.");
        return;
      }

      try {
        const res = await importCsv({ data: { list_id: selectedList.id, contacts: parsedContacts } });
        toast.success(`${res.importedCount} contatos processados (${res.newContactsCount} novos adicionados)`);
        qc.invalidateQueries({ queryKey: ["lists"] });
        qc.invalidateQueries({ queryKey: ["contacts"] });
        qc.invalidateQueries({ queryKey: ["list-members", selectedList.id] });
      } catch (error: any) {
        toast.error("Erro ao importar CSV: " + error.message);
      }
    };

    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title="Listas & Tags"
        subtitle="Organize seus contatos para segmentar campanhas."
      />

      <div className="flex-1 overflow-y-auto grid gap-6 p-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Listas</h2>
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-1 h-4 w-4" /> Nova lista
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nova lista</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <Label>Nome</Label>
                      <Input
                        value={listForm.name}
                        onChange={(e) => setListForm({ ...listForm, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Descrição</Label>
                      <Input
                        value={listForm.description}
                        onChange={(e) => setListForm({ ...listForm, description: e.target.value })}
                      />
                    </div>
                    <Button
                      className="w-full"
                      onClick={async () => {
                        try {
                          await newList({ data: listForm });
                          toast.success("Lista criada");
                          setListForm({ name: "", description: "" });
                          qc.invalidateQueries({ queryKey: ["lists"] });
                        } catch (e: any) {
                          toast.error(e.message);
                        }
                      }}
                    >
                      Criar
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="mt-3 divide-y">
              {(lists.data ?? []).map((l: any) => (
                <div
                  key={l.id}
                  role="button"
                  tabIndex={0}
                  className={`flex w-full items-center justify-between py-3 text-left hover:bg-muted/30 cursor-pointer ${selectedList?.id === l.id ? "bg-muted/50" : ""}`}
                  onClick={() => {
                    setSelectedList(l);
                    setPicked(new Set());
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedList(l);
                      setPicked(new Set());
                    }
                  }}
                >
                  <div className="px-2">
                    <p className="font-medium">{l.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {l.description ?? "—"} · {l.list_contacts?.[0]?.count ?? 0} contatos
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={async (e) => {
                      e.stopPropagation();
                      const ok = await confirm({
                        title: "Excluir lista?",
                        description: (
                          <>
                            A lista <strong>{l.name}</strong> será removida. Os contatos não serão
                            excluídos.
                          </>
                        ),
                        destructive: true,
                        confirmText: "Excluir",
                      });
                      if (!ok) return;
                      await rmList({ data: { id: l.id } });
                      if (selectedList?.id === l.id) setSelectedList(null);
                      qc.invalidateQueries({ queryKey: ["lists"] });
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
              {(lists.data ?? []).length === 0 && (
                <EmptyState
                  icon={ListChecks}
                  title="Nenhuma lista"
                  description="Crie listas para segmentar campanhas e organizar contatos."
                />
              )}
            </div>
          </Card>

          {selectedList && (
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-base font-semibold">
                  {selectedList.name} — membros
                </h3>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept=".csv,.txt"
                    id="csv-upload-input"
                    className="hidden"
                    onChange={handleCsvUpload}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => document.getElementById("csv-upload-input")?.click()}
                  >
                    Importar CSV
                  </Button>
                </div>
              </div>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <div>
                  <div className="flex items-center justify-between">
                    <Label>Buscar contatos para adicionar</Label>
                    {filteredContacts.length > 0 && (
                      <div className="flex gap-2 text-xs">
                        <button
                          type="button"
                          onClick={handleSelectAll}
                          className="text-primary hover:underline"
                        >
                          Marcar todos
                        </button>
                        <span className="text-muted-foreground">|</span>
                        <button
                          type="button"
                          onClick={handleClear}
                          className="text-muted-foreground hover:underline"
                        >
                          Limpar
                        </button>
                      </div>
                    )}
                  </div>
                  <Input
                    className="mt-1"
                    placeholder="Telefone ou nome…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <div className="mt-2 max-h-72 overflow-auto rounded border">
                    {filteredContacts.slice(0, 500).map((c: any) => {
                      const isMember = memberIds.has(c.id);
                      return (
                        <label
                          key={c.id}
                          className="flex items-center gap-2 border-b px-2 py-1.5 text-sm last:border-0 hover:bg-muted/30"
                        >
                          <input
                            type="checkbox"
                            checked={isMember || picked.has(c.id)}
                            disabled={isMember}
                            onChange={(e) => {
                              if (isMember) return;
                              const n = new Set(picked);
                              e.target.checked ? n.add(c.id) : n.delete(c.id);
                              setPicked(n);
                            }}
                          />
                          <span className="font-mono">+{c.phone_e164}</span>
                          <span className="text-muted-foreground">{c.name ?? ""}</span>
                          {isMember && (
                            <span className="text-[10px] bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded ml-auto">
                              Membro
                            </span>
                          )}
                        </label>
                      );
                    })}
                    {filteredContacts.length === 0 && (
                      <p className="p-3 text-xs text-muted-foreground text-center">Nenhum contato disponível.</p>
                    )}
                  </div>
                  {filteredContacts.length > 500 && (
                    <p className="mt-1 text-xs text-muted-foreground text-center">
                      Exibindo 500 de {filteredContacts.length} contatos. Refine a busca.
                    </p>
                  )}
                  <Button
                    className="mt-2 w-full"
                    disabled={picked.size === 0}
                    onClick={async () => {
                      await addToList({
                        data: { list_id: selectedList.id, contact_ids: [...picked] },
                      });
                      toast.success(`${picked.size} adicionados`);
                      setPicked(new Set());
                      qc.invalidateQueries({ queryKey: ["lists"] });
                      qc.invalidateQueries({ queryKey: ["list-members", selectedList.id] });
                    }}
                  >
                    Adicionar {picked.size > 0 && `(${picked.size})`}
                  </Button>
                </div>
                <div>
                  <Label>Membros atuais ({members.data?.length ?? 0})</Label>
                  <div className="mt-1 max-h-72 overflow-auto rounded border">
                    {(members.data ?? []).map((m: any) => (
                      <div
                        key={m.contact_id}
                        className="flex items-center justify-between border-b px-2 py-1.5 text-sm last:border-0"
                      >
                        <span className="font-mono">+{m.contacts?.phone_e164}</span>
                        <button
                          onClick={async () => {
                            await rmMember({
                              data: { list_id: selectedList.id, contact_id: m.contact_id },
                            });
                            qc.invalidateQueries({ queryKey: ["list-members", selectedList.id] });
                            qc.invalidateQueries({ queryKey: ["lists"] });
                          }}
                        >
                          <X className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </div>
                    ))}
                    {(members.data ?? []).length === 0 && (
                      <p className="p-3 text-xs text-muted-foreground">Sem membros.</p>
                    )}
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
              <Input
                placeholder="nome"
                value={tagForm.name}
                onChange={(e) => setTagForm({ ...tagForm, name: e.target.value })}
              />
              <input
                type="color"
                className="h-9 w-12 rounded-full border-none p-0 overflow-hidden cursor-pointer"
                value={tagForm.color}
                onChange={(e) => setTagForm({ ...tagForm, color: e.target.value })}
              />
              <Button
                onClick={async () => {
                  try {
                    await newTag({ data: tagForm });
                    setTagForm({ name: "", color: "#25D366" });
                    qc.invalidateQueries({ queryKey: ["tags"] });
                  } catch (e: any) {
                    toast.error(e.message);
                  }
                }}
              >
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(tags.data ?? []).map((t: any) => (
                <span
                  key={t.id}
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs text-white"
                  style={{ background: t.color }}
                >
                  {t.name}
                  <button
                    aria-label={`Remover tag ${t.name}`}
                    onClick={async () => {
                      const ok = await confirm({
                        title: "Remover tag?",
                        description: (
                          <>
                            A tag <strong>{t.name}</strong> será removida de todos os contatos.
                          </>
                        ),
                        destructive: true,
                        confirmText: "Remover",
                      });
                      if (!ok) return;
                      await rmTag({ data: { id: t.id } });
                      qc.invalidateQueries({ queryKey: ["tags"] });
                    }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {(tags.data ?? []).length === 0 && (
                <EmptyState
                  icon={Tags}
                  title="Sem tags"
                  description="Tags ajudam a categorizar contatos rapidamente."
                  className="w-full py-8"
                />
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
