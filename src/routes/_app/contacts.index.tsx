import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listContacts,
  createContact,
  updateContact,
  deleteContact,
  bulkUpsertContacts,
  bulkDeleteContacts,
  bulkSetOptOut,
  bulkAddContactsToList,
  bulkAddTagToContacts,
  getContactKanbanStages,
  updateContactProfilePhoto,
} from "@/lib/contacts.functions";
import { listLists, listTags } from "@/lib/lists.functions";
import { usePageHeader } from "@/components/layout/page-header-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Trash2,
  Upload,
  Plus,
  Users,
  MoreHorizontal,
  ListPlus,
  Tag as TagIcon,
  ShieldOff,
  ShieldCheck,
  Pencil,
  MessageSquare,
  User as UserIcon,
  Camera,
  Loader2,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { listCustomFields, getCustomFieldValuesBatch, saveContactCustomFieldValues } from "@/lib/custom-fields.functions";
import { listAllAgents } from "@/lib/assignment.functions";
import { CustomFieldInput } from "@/components/contacts/custom-field-input";
import { ColumnSelector } from "@/components/contacts/column-selector";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { db } from "@/integrations/mysql/client";

const DEFAULT_COLUMNS = ["avatar_url", "name", "phone", "email", "company", "status", "created_at"];
const LS_KEY_PREFIX = "crm_contacts_visible_columns_v1_";
import Papa from "papaparse";
import { CsvMappingModal } from "@/components/contacts/CsvMappingModal";
import * as XLSX from "xlsx";
import { EmptyState } from "@/components/empty-state";
import { DataPagination } from "@/components/data-pagination";
import { useConfirm } from "@/components/confirm-dialog";
import { TableSkeleton } from "@/components/table-skeleton";

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function ContactAvatarCell({ contact: c }: { contact: any }) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const customFields = typeof c.custom_fields === "string"
    ? (() => { try { return JSON.parse(c.custom_fields); } catch { return {}; } })()
    : (c.custom_fields || {});

  const avatarUrl = customFields.avatar_url || customFields.photo_url || null;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx 20MB)");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("O arquivo precisa ser uma imagem");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `contacts/${c.id}/avatar-${Date.now()}.${ext}`;

      const { error: upErr } = await db.storage
        .from("avatars")
        .upload(path, file);

      if (upErr) throw upErr;

      const { data: pub } = db.storage.from("avatars").getPublicUrl(path);
      const url = pub.publicUrl;

      await updateContactProfilePhoto({ data: { id: c.id, avatar_url: url } });

      qc.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Foto do contato atualizada");
    } catch (err: any) {
      toast.error(err.message ?? "Falha ao enviar imagem");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="relative group h-8 w-8 rounded-full overflow-hidden shrink-0 cursor-pointer"
      onClick={(e) => {
        e.stopPropagation();
        fileInputRef.current?.click();
      }}
    >
      {uploading ? (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-full">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        </div>
      ) : (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full z-10">
          <Camera className="h-4 w-4 text-white" />
        </div>
      )}
      <Avatar className="h-8 w-8">
        <AvatarImage src={avatarUrl} alt={c.name || ""} />
        <AvatarFallback className="text-xs">
          {c.name ? getInitials(c.name) : "?"}
        </AvatarFallback>
      </Avatar>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleUpload}
        accept="image/*"
        className="hidden"
      />
    </div>
  );
}

export const Route = createFileRoute("/_app/contacts/")({ component: ContactsPage });

const PAGE_SIZE = 50;

function ContactsPage() {
  const fetch = useServerFn(listContacts);
  const fetchLists = useServerFn(listLists);
  const fetchTags = useServerFn(listTags);
  const create = useServerFn(createContact);
  const update = useServerFn(updateContact);
  const del = useServerFn(deleteContact);
  const bulk = useServerFn(bulkUpsertContacts);
  const bulkDel = useServerFn(bulkDeleteContacts);
  const bulkOpt = useServerFn(bulkSetOptOut);
  const bulkAddList = useServerFn(bulkAddContactsToList);
  const bulkAddTag = useServerFn(bulkAddTagToContacts);
  const qc = useQueryClient();
  const confirm = useConfirm();
  const fetchCustomFields = useServerFn(listCustomFields);
  const fetchAgents = useServerFn(listAllAgents);

  const { data: contacts, isLoading } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => fetch(),
  });
  const lists = useQuery({ queryKey: ["lists"], queryFn: () => fetchLists() });
  const tags = useQuery({ queryKey: ["tags"], queryFn: () => fetchTags() });
  const customFields = useQuery({
    queryKey: ["custom-fields"],
    queryFn: () => fetchCustomFields(),
    staleTime: 60000,
  });
  const agents = useQuery({
    queryKey: ["agents"],
    queryFn: () => fetchAgents(),
    staleTime: 60000,
  });
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});
  const [newContactAvatar, setNewContactAvatar] = useState<string | null>(null);
  const [newContactAvatarUploading, setNewContactAvatarUploading] = useState(false);
  const [editingAvatarUploading, setEditingAvatarUploading] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("crm_contacts_visible_columns") ?? "null") ?? DEFAULT_COLUMNS; } catch { return DEFAULT_COLUMNS; }
  });
  const columnDefs = useMemo(() => {
    const std: { id: string; label: string; group: "standard" | "custom" }[] = [
      { id: "avatar_url", label: "Foto", group: "standard" },
      { id: "name", label: "Nome", group: "standard" },
      { id: "phone", label: "Telefone", group: "standard" },
      { id: "email", label: "E-mail", group: "standard" },
      { id: "company", label: "Empresa", group: "standard" },
      { id: "position", label: "Cargo", group: "standard" },
      { id: "status", label: "Status", group: "standard" },
      { id: "responsible_user_id", label: "Responsável", group: "standard" },
      { id: "created_at", label: "Criado em", group: "standard" },
      { id: "last_contacted_at", label: "Último contato", group: "standard" },
    ];
    const customDefs = (customFields.data as any[] ?? []).filter((f: any) => f.show_on_table && f.is_active).map((f: any) => ({
      id: `cf_${f.id}`, label: f.label, group: "custom" as const,
    }));
    return [...std, ...customDefs];
  }, [customFields.data]);
  const persistVisibleColumns = (ids: string[]) => {
    setVisibleColumns(ids);
    try { localStorage.setItem("crm_contacts_visible_columns", JSON.stringify(ids)); } catch {}
  };

  const navigate = useNavigate();

  const [editingContact, setEditingContact] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    phone: "",
    name: "",
    email: "",
    company: "",
    position: "",
    status: "",
    responsible_user_id: "",
    source: "",
    source_type: "",
    source_name: "",
    source_id: "",
    external_id: "",
    external_contact_id: "",
    metadata: "",
    channel: "whatsapp",
    custom_fields: "",
    opted_out: false,
    is_pinned: false,
    is_archived: false,
    chat_status: "aberto",
    is_unread: false,
    kanban_stage_id: "",
  });
  const [kanbanStages, setKanbanStages] = useState<any[]>([]);
  const [currentKanbanStage, setCurrentKanbanStage] = useState<any | null>(null);
  const [loadingKanban, setLoadingKanban] = useState(false);
 
  const updateMut = useMutation({
    mutationFn: (d: typeof editForm & { id: string }) => update({ data: d as any }),
    onSuccess: () => {
      toast.success("Contato updated");
      setEditingContact(null);
      setEditForm({
        phone: "",
        name: "",
        email: "",
        company: "",
        position: "",
        status: "",
        responsible_user_id: "",
        source: "",
        source_type: "",
        source_name: "",
        source_id: "",
        external_id: "",
        external_contact_id: "",
        metadata: "",
        channel: "whatsapp",
        custom_fields: "",
        opted_out: false,
        is_pinned: false,
        is_archived: false,
        chat_status: "aberto",
        is_unread: false,
        kanban_stage_id: "",
      });
      qc.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ phone: "", name: "", email: "", company: "", position: "", status: "", responsible_user_id: "" });
  const [picked, setPicked] = useState<Set<string>>(new Set());

  // Import wizard states
  const [importRows, setImportRows] = useState<any[]>([]);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState({ phone: "", name: "", email: "" });
  const [isMappingOpen, setIsMappingOpen] = useState(false);

  const createMut = useMutation({
    mutationFn: (d: typeof form & { custom_fields?: any }) => create({ data: d as any }),
    onSuccess: () => {
      toast.success("Contato adicionado");
      setOpen(false);
      setForm({ phone: "", name: "", email: "", company: "", position: "", status: "", responsible_user_id: "" });
      setNewContactAvatar(null);
      qc.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["contacts"] });

  const [csvFileName, setCsvFileName] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    let rows: any[] = [];
    try {
      setCsvFileName(f.name);
      if (f.name.endsWith(".csv")) {
        const text = await f.text();
        const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
        rows = parsed.data as any[];
      } else {
        const buf = await f.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      }
      if (rows.length === 0) {
        toast.error("Nenhum dado encontrado no arquivo.");
        return;
      }

      const headers = Object.keys(rows[0]);
      setImportHeaders(headers);
      setImportRows(rows);
      setIsMappingOpen(true);
    } catch (err: any) {
      toast.error(err.message ?? "Falha ao ler o arquivo");
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleConfirmImport = async (mappedContacts: any[]) => {
    setIsImporting(true);
    try {
      const res = await bulk({ data: { rows: mappedContacts } });
      toast.success(
        `${res.inserted} contatos importados com sucesso${res.invalid ? `, ${res.invalid} inválidos` : ""}`,
      );
      invalidate();
      setIsMappingOpen(false);
      setImportRows([]);
      setImportHeaders([]);
    } catch (err: any) {
      toast.error(err.message ?? "Falha ao importar");
    } finally {
      setIsImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const ALL_SOURCES = ["manual", "webhook", "import", "api", "whatsapp", "instagram", "campaign"];

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return (contacts ?? []).filter((c: any) => {
      if (sourceFilter && c.source !== sourceFilter) return false;
      if (!s) return true;
      return (
        c.phone_e164.includes(search) ||
        c.name?.toLowerCase().includes(s) ||
        c.email?.toLowerCase().includes(s)
      );
    });
  }, [contacts, search, sourceFilter]);

  const total = filtered.length;
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const allPagePicked = pageRows.length > 0 && pageRows.every((c: any) => picked.has(c.id));

  const togglePage = (checked: boolean) => {
    const n = new Set(picked);
    pageRows.forEach((c: any) => (checked ? n.add(c.id) : n.delete(c.id)));
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
      description: (
        <>
          Tem certeza que deseja excluir <strong>{label}</strong>? Esta ação não pode ser desfeita.
        </>
      ),
      destructive: true,
      confirmText: "Excluir",
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
      destructive: true,
      confirmText: "Excluir",
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

  const goPage = (p: number) => {
    setPage(p);
    setPicked(new Set());
  };

  usePageHeader({
    title: "Contatos",
    subtitle: `${contacts?.length ?? 0} contato${(contacts?.length ?? 0) === 1 ? "" : "s"} cadastrado${(contacts?.length ?? 0) === 1 ? "" : "s"}.`,
    action: (
      <div className="grid grid-cols-2 gap-2 w-full lg:w-auto">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          hidden
          onChange={handleFile}
        />
        <Button
          variant="outline"
          onClick={() => fileRef.current?.click()}
          className="w-full justify-center"
        >
          <Upload className="mr-2 h-4 w-4 shrink-0" />
          <span className="truncate">Importar CSV/XLSX</span>
        </Button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button className="w-full justify-center">
              <Plus className="mr-2 h-4 w-4 shrink-0" />
              <span className="truncate">Novo contato</span>
            </Button>
          </SheetTrigger>
          <SheetContent className="bg-card border-l border-muted-foreground/15 p-6 flex flex-col h-full gap-0 overflow-y-auto">
            <SheetHeader className="mb-4">
              <SheetTitle>Novo contato</SheetTitle>
            </SheetHeader>
            <div className="space-y-3 flex-1">
              <div className="flex flex-col items-center gap-2 pb-2">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={newContactAvatar || undefined} />
                  <AvatarFallback className="text-xl">
                    {form.name ? getInitials(form.name) : "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex gap-2">
                  <input
                    type="file"
                    id="new-contact-avatar-file"
                    className="hidden"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 20 * 1024 * 1024) {
                        toast.error("Imagem muito grande (máx 20MB)");
                        return;
                      }
                      if (!file.type.startsWith("image/")) {
                        toast.error("O arquivo precisa ser uma imagem");
                        return;
                      }
                      setNewContactAvatarUploading(true);
                      try {
                        const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
                        const path = `contacts/temp/avatar-${Date.now()}.${ext}`;
                        const { error: upErr } = await db.storage.from("avatars").upload(path, file);
                        if (upErr) throw upErr;
                        const { data: pub } = db.storage.from("avatars").getPublicUrl(path);
                        setNewContactAvatar(pub.publicUrl);
                        toast.success("Foto carregada");
                      } catch (err: any) {
                        toast.error(err.message ?? "Falha ao enviar imagem");
                      } finally {
                        setNewContactAvatarUploading(false);
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={newContactAvatarUploading}
                    onClick={() => document.getElementById("new-contact-avatar-file")?.click()}
                  >
                    {newContactAvatarUploading ? (
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Camera className="mr-1 h-3.5 w-3.5" />
                    )}
                    Carregar Foto
                  </Button>
                  {newContactAvatar && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setNewContactAvatar(null)}
                    >
                      Remover
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+55 11 99999-0000"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Empresa</Label>
                <Input
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Cargo</Label>
                <Input
                  value={form.position}
                  onChange={(e) => setForm({ ...form, position: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Input
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Responsável</Label>
                <Select
                  value={form.responsible_user_id || "_none"}
                  onValueChange={(v) => setForm({ ...form, responsible_user_id: v === "_none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Nenhum</SelectItem>
                    {(agents.data as any[] ?? []).map((ag: any) => (
                      <SelectItem key={ag.id} value={ag.id}>
                        {ag.full_name || ag.display_name || ag.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {(customFields.data as any[] ?? []).filter((f: any) => f.show_on_form && f.is_active).length > 0 && (
                <div className="pt-3 border-t">
                  <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Campos personalizados</p>
                  <div className="space-y-3">
                    {(customFields.data as any[] ?? []).filter((f: any) => f.show_on_form && f.is_active).map((f: any) => (
                      <CustomFieldInput
                        key={f.id}
                        field={f}
                        value={customFieldValues[f.id] ?? null}
                        onChange={(val: any) => setCustomFieldValues({ ...customFieldValues, [f.id]: val })}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="pt-4 border-t mt-auto">
              <Button
                onClick={() => {
                  const payload = {
                    ...form,
                    custom_fields: newContactAvatar ? { avatar_url: newContactAvatar } : undefined,
                  };
                  createMut.mutate(payload as any, {
                    onSuccess: (result: any) => {
                      if (result?.id && Object.keys(customFieldValues).length > 0) {
                        saveContactCustomFieldValues({
                          data: {
                            contact_id: result.id,
                            values: Object.entries(customFieldValues).map(([custom_field_id, value]) => ({ custom_field_id, value })),
                          },
                        });
                      }
                      setCustomFieldValues({});
                    },
                  });
                }}
                disabled={createMut.isPending}
                className="w-full"
              >
                Adicionar
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    ),
  });

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6">
        <Card>
          <div className="flex flex-wrap items-center gap-2 border-b p-3">
            <Input
              className="max-w-sm"
              placeholder="Buscar por nome, telefone ou e-mail…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            <div className="flex items-center gap-1" role="group" aria-label="Filtrar por origem">
              <button
                className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${!sourceFilter ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                onClick={() => { setSourceFilter(null); setPage(1); }}
              >
                Todos
              </button>
              {ALL_SOURCES.map((s) => (
                <button
                  key={s}
                  className={`rounded px-2 py-1 text-[11px] font-medium capitalize transition-colors ${sourceFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                  onClick={() => { setSourceFilter(s); setPage(1); }}
                >
                  {s === "webhook" ? "Webhook" : s === "import" ? "Importação" : s === "manual" ? "Manual" : s === "api" ? "API" : s}
                </button>
              ))}
            </div>
            {picked.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {picked.size} selecionado{picked.size === 1 ? "" : "s"}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline">
                      <MoreHorizontal className="mr-1 h-4 w-4" /> Ações em lote
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuLabel>Aplicar a {picked.size} contatos</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <ListPlus className="mr-2 h-4 w-4" /> Adicionar a lista
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="max-h-72 overflow-auto">
                        {(lists.data ?? []).length === 0 && (
                          <DropdownMenuItem disabled>Nenhuma lista</DropdownMenuItem>
                        )}
                        {(lists.data ?? []).map((l: any) => (
                          <DropdownMenuItem
                            key={l.id}
                            onClick={() => handleAddToList(l.id, l.name)}
                          >
                            {l.name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <TagIcon className="mr-2 h-4 w-4" /> Aplicar tag
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="max-h-72 overflow-auto">
                        {(tags.data ?? []).length === 0 && (
                          <DropdownMenuItem disabled>Nenhuma tag</DropdownMenuItem>
                        )}
                        {(tags.data ?? []).map((t: any) => (
                          <DropdownMenuItem key={t.id} onClick={() => handleAddTag(t.id, t.name)}>
                            <span
                              className="mr-2 inline-block h-3 w-3 rounded-full"
                              style={{ background: t.color }}
                            />
                            {t.name}
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
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={handleBulkDelete}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Excluir selecionados
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button size="sm" variant="ghost" onClick={() => setPicked(new Set())}>
                  Limpar
                </Button>
              </div>
            )}
          </div>
          <div className="overflow-auto">
            {isLoading ? (
              <TableSkeleton rows={8} cols={5} />
            ) : total === 0 ? (
              <EmptyState
                icon={Users}
                title={search ? "Nenhum contato encontrado" : "Nenhum contato ainda"}
                description={
                  search
                    ? "Tente uma busca diferente."
                    : "Importe um CSV/XLSX ou adicione manualmente seu primeiro contato."
                }
                action={
                  !search && (
                    <Button onClick={() => fileRef.current?.click()}>
                      <Upload className="mr-2 h-4 w-4" /> Importar contatos
                    </Button>
                  )
                }
              />
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 border-b bg-muted text-left text-xs uppercase text-foreground">
                  <tr>
                    <th className="w-10 p-3">
                      <Checkbox
                        checked={allPagePicked}
                        onCheckedChange={(c) => togglePage(!!c)}
                        aria-label="Selecionar página"
                      />
                    </th>
                    {columnDefs.filter((col) => visibleColumns.includes(col.id)).map((col) => (
                      <th key={col.id} className="p-3">{col.label}</th>
                    ))}
                    <th className="p-3 w-18">
                      <ColumnSelector columns={columnDefs} visible={visibleColumns} onChange={persistVisibleColumns} />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((c: any) => (
                    <tr
                      key={c.id}
                      className={`border-b last:border-0 hover:bg-muted/30 cursor-pointer ${picked.has(c.id) ? "bg-muted/40" : ""}`}
                      onClick={() => navigate({ to: "/contacts/$id", params: { id: c.id } })}
                    >
                      <td className="p-3">
                        <Checkbox
                          checked={picked.has(c.id)}
                          onCheckedChange={(v) => toggleOne(c.id, !!v)}
                          aria-label={`Selecionar ${c.phone_e164}`}
                        />
                      </td>
                      {columnDefs.filter((col) => visibleColumns.includes(col.id)).map((col) => {
                        if (col.id === "avatar_url") {
                          return (
                            <td key={col.id} className="p-3">
                              <ContactAvatarCell contact={c} />
                            </td>
                          );
                        }
                        if (col.id === "phone") {
                          return (
                            <td key={col.id} className="p-3 font-mono">
                              +{c.phone_e164}
                              {(c.opted_out === 1 || c.opted_out === true) && (
                                <span className="ml-2 rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] text-destructive">opt-out</span>
                              )}
                            </td>
                          );
                        }
                        if (col.id === "name") {
                          return <td key={col.id} className="p-3">{c.name ?? "—"}</td>;
                        }
                        if (col.id === "email") {
                          return <td key={col.id} className="p-3 text-muted-foreground">{c.email ?? "—"}</td>;
                        }
                        if (col.id === "company") {
                          return <td key={col.id} className="p-3">{c.company ?? "—"}</td>;
                        }
                        if (col.id === "position") {
                          return <td key={col.id} className="p-3">{c.position ?? "—"}</td>;
                        }
                        if (col.id === "status") {
                          return <td key={col.id} className="p-3">{c.status ?? "—"}</td>;
                        }
                        if (col.id === "created_at") {
                          return <td key={col.id} className="p-3 text-muted-foreground">{c.created_at ? new Date(c.created_at).toLocaleDateString("pt-BR") : "—"}</td>;
                        }
                        if (col.id === "last_contacted_at") {
                          return <td key={col.id} className="p-3 text-muted-foreground">{c.last_contacted_at ? new Date(c.last_contacted_at).toLocaleDateString("pt-BR") : "—"}</td>;
                        }
                        if (col.id === "responsible_user_id") {
                          const agent = (agents.data as any[] ?? []).find((a: any) => a.id === c.responsible_user_id);
                          const display = agent ? (agent.full_name || agent.display_name || agent.email) : "—";
                          return <td key={col.id} className="p-3">{display}</td>;
                        }
                        if (col.group === "custom") {
                          const fieldId = col.id.replace("cf_", "");
                          const fieldDef = (customFields.data as any[] ?? []).find((f: any) => f.id === fieldId);
                          let val = "—";
                          if (fieldDef) {
                            let customFieldsObj: any = {};
                            if (c.custom_fields) {
                              if (typeof c.custom_fields === "string") {
                                try {
                                  customFieldsObj = JSON.parse(c.custom_fields);
                                } catch {}
                              } else {
                                customFieldsObj = c.custom_fields;
                              }
                            }
                            const rawVal = customFieldsObj[fieldDef.key];
                            if (rawVal !== undefined && rawVal !== null && rawVal !== "") {
                              val = String(rawVal);
                            }
                          }
                          return <td key={col.id} className="p-3">{val}</td>;
                        }
                        return <td key={col.id} className="p-3">—</td>;
                      })}
                      <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" aria-label="Ações">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingContact(c);
                                setCustomFieldValues({});
                                getCustomFieldValuesBatch({ data: { contact_ids: [c.id] } }).then((vals: any) => {
                                  const map: Record<string, any> = {};
                                  (vals ?? []).forEach((v: any) => { map[v.custom_field_id] = v.value_json ?? v.value; });
                                  setCustomFieldValues(map);
                                });
                                setEditForm({
                                  phone: c.phone_e164 || "",
                                  name: c.name || "",
                                  email: c.email || "",
                                  company: c.company || "",
                                  position: c.position || "",
                                  status: c.status || "",
                                  responsible_user_id: c.responsible_user_id || "",
                                  source: c.source || "",
                                  source_type: c.source_type || "",
                                  source_name: c.source_name || "",
                                  source_id: c.source_id || "",
                                  external_id: c.external_id || "",
                                  external_contact_id: c.external_contact_id || "",
                                  metadata: c.metadata ? JSON.stringify(c.metadata, null, 2) : "",
                                  channel: c.channel || "whatsapp",
                                  custom_fields: JSON.stringify(c.custom_fields || {}, null, 2),
                                  opted_out: !!c.opted_out,
                                  is_pinned: !!c.is_pinned,
                                  is_archived: !!c.is_archived,
                                  chat_status: c.chat_status || "aberto",
                                  is_unread: !!c.is_unread,
                                  kanban_stage_id: c.kanban_stage_id || "",
                                });
                                setLoadingKanban(true);
                                getContactKanbanStages({ data: { contact_id: c.id } })
                                  .then((res: any) => {
                                    setKanbanStages(res.stages ?? []);
                                    setCurrentKanbanStage(res.current_stage ?? null);
                                  })
                                  .catch(() => {
                                    setKanbanStages([]);
                                    setCurrentKanbanStage(null);
                                  })
                                  .finally(() => setLoadingKanban(false));
                              }}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar contato
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate({ to: "/contacts/$id", params: { id: c.id } });
                              }}
                            >
                              <UserIcon className="mr-2 h-4 w-4" />
                              Abrir detalhes
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate({
                                  to: "/chat",
                                  search: { phone: c.phone_e164 } as any,
                                });
                              }}
                            >
                              <MessageSquare className="mr-2 h-4 w-4" />
                              Mandar mensagem
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteOne(c.id, c.name ?? `+${c.phone_e164}`);
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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

      <CsvMappingModal
        open={isMappingOpen}
        onOpenChange={setIsMappingOpen}
        fileName={csvFileName || "Arquivo de Contatos"}
        headers={importHeaders}
        rows={importRows}
        customFields={(customFields.data as any[] ?? [])}
        onConfirm={handleConfirmImport}
        isSubmitting={isImporting}
      />

      <Sheet
        open={editingContact !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setEditingContact(null);
        }}
      >
        <SheetContent className="w-full sm:max-w-md bg-card border-l border-muted-foreground/15 p-6 flex flex-col h-full gap-0 overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle>Editar contato</SheetTitle>
          </SheetHeader>
          <div className="space-y-3 flex-1">
            {editingContact && (() => {
              const customFields = typeof editingContact.custom_fields === "string"
                ? (() => { try { return JSON.parse(editingContact.custom_fields); } catch { return {}; } })()
                : (editingContact.custom_fields || {});
              const currentAvatar = customFields.avatar_url || customFields.photo_url || null;

              return (
                <div className="flex flex-col items-center gap-2 pb-2">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={currentAvatar || undefined} />
                    <AvatarFallback className="text-xl">
                      {editForm.name ? getInitials(editForm.name) : "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex gap-2">
                    <input
                      type="file"
                      id="edit-contact-avatar-file"
                      className="hidden"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 20 * 1024 * 1024) {
                          toast.error("Imagem muito grande (máx 20MB)");
                          return;
                        }
                        if (!file.type.startsWith("image/")) {
                          toast.error("O arquivo precisa ser uma imagem");
                          return;
                        }
                        setEditingAvatarUploading(true);
                        try {
                          const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
                          const path = `contacts/${editingContact.id}/avatar-${Date.now()}.${ext}`;
                          const { error: upErr } = await db.storage.from("avatars").upload(path, file);
                          if (upErr) throw upErr;
                          const { data: pub } = db.storage.from("avatars").getPublicUrl(path);

                          await updateContactProfilePhoto({ data: { id: editingContact.id, avatar_url: pub.publicUrl } });

                          const updatedCustomFields = { ...customFields, avatar_url: pub.publicUrl };
                          setEditingContact({
                            ...editingContact,
                            custom_fields: updatedCustomFields
                          });
                          setEditForm({
                            ...editForm,
                            custom_fields: JSON.stringify(updatedCustomFields, null, 2)
                          });

                          qc.invalidateQueries({ queryKey: ["contacts"] });
                          toast.success("Foto atualizada");
                        } catch (err: any) {
                          toast.error(err.message ?? "Falha ao enviar imagem");
                        } finally {
                          setEditingAvatarUploading(false);
                        }
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={editingAvatarUploading}
                      onClick={() => document.getElementById("edit-contact-avatar-file")?.click()}
                    >
                      {editingAvatarUploading ? (
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Camera className="mr-1 h-3.5 w-3.5" />
                      )}
                      Alterar Foto
                    </Button>
                    {currentAvatar && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={async () => {
                          try {
                            await updateContactProfilePhoto({ data: { id: editingContact.id, avatar_url: null } });

                            const updatedCustomFields = { ...customFields };
                            delete updatedCustomFields.avatar_url;
                            delete updatedCustomFields.photo_url;

                            setEditingContact({
                              ...editingContact,
                              custom_fields: updatedCustomFields
                            });
                            setEditForm({
                              ...editForm,
                              custom_fields: JSON.stringify(updatedCustomFields, null, 2)
                            });

                            qc.invalidateQueries({ queryKey: ["contacts"] });
                            toast.success("Foto removida");
                          } catch (err: any) {
                            toast.error(err.message);
                          }
                        }}
                      >
                        Remover
                      </Button>
                    )}
                  </div>
                </div>
              );
            })()}
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                placeholder="+55 11 99999-0000"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Empresa</Label>
              <Input
                value={editForm.company}
                onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cargo</Label>
              <Input
                value={editForm.position}
                onChange={(e) => setEditForm({ ...editForm, position: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Input
                value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Responsável</Label>
              <Select
                value={editForm.responsible_user_id || "_none"}
                onValueChange={(v) => setEditForm({ ...editForm, responsible_user_id: v === "_none" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um responsável" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Nenhum</SelectItem>
                  {(agents.data as any[] ?? []).map((ag: any) => (
                    <SelectItem key={ag.id} value={ag.id}>
                      {ag.full_name || ag.display_name || ag.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Origem</Label>
              <Input
                value={editForm.source}
                onChange={(e) => setEditForm({ ...editForm, source: e.target.value })}
                placeholder="import, api, manual..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de origem</Label>
              <Input
                value={editForm.source_type}
                onChange={(e) => setEditForm({ ...editForm, source_type: e.target.value })}
                placeholder="incoming_webhook, manual..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Nome da origem</Label>
              <Input
                value={editForm.source_name}
                onChange={(e) => setEditForm({ ...editForm, source_name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>ID da origem</Label>
              <Input
                value={editForm.source_id}
                onChange={(e) => setEditForm({ ...editForm, source_id: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>External ID</Label>
              <Input
                value={editForm.external_id}
                onChange={(e) => setEditForm({ ...editForm, external_id: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Canal</Label>
              <Select
                value={editForm.channel}
                onValueChange={(v) => setEditForm({ ...editForm, channel: v as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>External Contact ID</Label>
              <Input
                value={editForm.external_contact_id}
                onChange={(e) => setEditForm({ ...editForm, external_contact_id: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Metadata (JSON)</Label>
              <textarea
                className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                value={editForm.metadata}
                onChange={(e) => setEditForm({ ...editForm, metadata: e.target.value })}
                rows={3}
              />
            </div>
            <div className="flex items-center gap-4 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={editForm.opted_out}
                  onCheckedChange={(v) => setEditForm({ ...editForm, opted_out: !!v })}
                />
                <span className="text-sm">Opted out</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={editForm.is_pinned}
                  onCheckedChange={(v) => setEditForm({ ...editForm, is_pinned: !!v })}
                />
                <span className="text-sm">Fixado</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={editForm.is_archived}
                  onCheckedChange={(v) => setEditForm({ ...editForm, is_archived: !!v })}
                />
                <span className="text-sm">Arquivado</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={editForm.is_unread}
                  onCheckedChange={(v) => setEditForm({ ...editForm, is_unread: !!v })}
                />
                <span className="text-sm">Não lida</span>
              </label>
            </div>
            <div className="space-y-1.5">
              <Label>Status do chat</Label>
              <Input
                value={editForm.chat_status}
                onChange={(e) => setEditForm({ ...editForm, chat_status: e.target.value })}
                placeholder="aberto"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Etapa do funil</Label>
              <Select
                value={editForm.kanban_stage_id}
                onValueChange={(v) => setEditForm({ ...editForm, kanban_stage_id: v })}
                disabled={loadingKanban}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={loadingKanban ? "Carregando..." : "Selecione uma etapa"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {kanbanStages.map((st: any) => (
                    <SelectItem key={st.id} value={st.id}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        {st.color && (
                          <span
                            style={{
                              display: "inline-block",
                              width: 10,
                              height: 10,
                              borderRadius: "50%",
                              backgroundColor: st.color,
                            }}
                          />
                        )}
                        {st.name}
                      </span>
                    </SelectItem>
                  ))}
                  {!loadingKanban && kanbanStages.length === 0 && (
                    <SelectItem value="_none" disabled>
                      Nenhuma etapa disponível
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>


            {(customFields.data as any[] ?? []).filter((f: any) => f.show_on_form && f.is_active).length > 0 && (
              <div className="pt-3 border-t">
                <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Campos personalizados</p>
                <div className="space-y-3">
                  {(customFields.data as any[] ?? []).filter((f: any) => f.show_on_form && f.is_active).map((f: any) => (
                    <CustomFieldInput
                      key={f.id}
                      field={f}
                      value={customFieldValues[f.id] ?? null}
                      onChange={(val: any) => setCustomFieldValues({ ...customFieldValues, [f.id]: val })}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="pt-4 border-t mt-auto">
            <Button
              onClick={() => {
                  if (editingContact) {
                    let custom_fields_json: Record<string, any> = {};
                    try {
                      if (editForm.custom_fields) {
                        custom_fields_json = typeof editForm.custom_fields === 'string'
                          ? JSON.parse(editForm.custom_fields)
                          : editForm.custom_fields;
                      }
                    } catch {}
                    
                    (customFields.data as any[] ?? []).forEach((f: any) => {
                      const val = customFieldValues[f.id];
                      if (val !== undefined && val !== null && val !== "") {
                        custom_fields_json[f.key] = val;
                      } else {
                        delete custom_fields_json[f.key];
                      }
                    });

                    let metadata: any = null;
                    try {
                      if (editForm.metadata?.trim()) {
                        metadata = JSON.parse(editForm.metadata);
                      }
                    } catch {
                      metadata = null;
                    }
                    const payload: any = {
                      id: editingContact.id,
                      ...editForm,
                      custom_fields: custom_fields_json,
                      metadata,
                    };
                    if (!payload.kanban_stage_id) payload.kanban_stage_id = null;
                    updateMut.mutate(payload, {
                      onSuccess: () => {
                        const vals = Object.entries(customFieldValues).filter(([, v]) => v !== null && v !== undefined && v !== "");
                        if (vals.length > 0) {
                          saveContactCustomFieldValues({
                            data: {
                              contact_id: editingContact.id,
                              values: vals.map(([custom_field_id, value]) => ({ custom_field_id, value })),
                            },
                          });
                        }
                      },
                    });
                  }
              }}
              disabled={updateMut.isPending}
              className="w-full"
            >
              Salvar alterações
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
