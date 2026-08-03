import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCustomFields, createCustomField, updateCustomField, deleteCustomField } from "@/lib/custom-fields.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, GripVertical, ArrowLeft } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { toast } from "sonner";

const FIELD_TYPES = [
  { value: "text", label: "Texto curto" },
  { value: "textarea", label: "Texto longo" },
  { value: "number", label: "Número" },
  { value: "currency", label: "Valor monetário" },
  { value: "date", label: "Data" },
  { value: "datetime", label: "Data e hora" },
  { value: "select", label: "Seleção única" },
  { value: "multi_select", label: "Múltipla seleção" },
  { value: "boolean", label: "Sim/Não" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefone" },
  { value: "url", label: "URL" },
];

const defaultForm = {
  label: "",
  type: "text" as string,
  placeholder: "",
  options: [] as string[],
  default_value: "",
  required: false,
  show_on_form: true,
  show_on_table: false,
  show_on_details: true,
  is_active: true,
};

function CustomFieldsSettingsPage() {
  const qc = useQueryClient();
  const listFields = useServerFn(listCustomFields);
  const createField = useServerFn(createCustomField);
  const updateField = useServerFn(updateCustomField);
  const deleteField = useServerFn(deleteCustomField);
  const { data: fields, isLoading } = useQuery({
    queryKey: ["custom-fields"],
    queryFn: () => listFields(),
  });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [newOption, setNewOption] = useState("");

  const createMut = useMutation({
    mutationFn: (d: typeof form) => createField({ data: d as any }),
    onSuccess: () => { toast.success("Campo criado"); setOpen(false); setForm(defaultForm); qc.invalidateQueries({ queryKey: ["custom-fields"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: (d: any) => updateField({ data: d }),
    onSuccess: () => { toast.success("Campo atualizado"); setOpen(false); setEditing(null); setForm(defaultForm); qc.invalidateQueries({ queryKey: ["custom-fields"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteField({ data: { id } }),
    onSuccess: () => { toast.success("Campo removido"); qc.invalidateQueries({ queryKey: ["custom-fields"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(defaultForm);
    setOpen(true);
  };

  const openEdit = (f: any) => {
    setEditing(f);
    setForm({
      label: f.label,
      type: f.type,
      placeholder: f.placeholder || "",
      options: f.options ? (typeof f.options === "string" ? JSON.parse(f.options) : f.options) : [],
      default_value: f.default_value || "",
      required: !!f.required,
      show_on_form: !!f.show_on_form,
      show_on_table: !!f.show_on_table,
      show_on_details: !!f.show_on_details,
      is_active: !!f.is_active,
    });
    setOpen(true);
  };

  const save = () => {
    if (!form.label.trim()) { toast.error("Nome do campo é obrigatório"); return; }
    if (editing) {
      updateMut.mutate({ id: editing.id, ...form });
    } else {
      createMut.mutate(form);
    }
  };

  const addOption = () => {
    if (!newOption.trim()) return;
    setForm({ ...form, options: [...form.options, newOption.trim()] });
    setNewOption("");
  };

  const removeOption = (idx: number) => {
    setForm({ ...form, options: form.options.filter((_: any, i: number) => i !== idx) });
  };

  const needsOptions = form.type === "select" || form.type === "multi_select";

  if (isLoading) return <div className="p-6 text-muted-foreground">Carregando...</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Button variant="ghost" size="sm" asChild className="-ml-2">
              <Link to="/settings" search={{ s: undefined }}><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <h1 className="text-xl font-semibold">Campos personalizados dos contatos</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-9">Gerencie os campos personalizados que aparecem no formulário, lista e detalhe dos contatos.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Novo campo
        </Button>
      </div>

      <Card>
        <div className="divide-y">
          {(fields as any[] ?? []).map((f: any) => (
            <div key={f.id} className="flex items-center justify-between p-3">
              <div className="flex items-center gap-3 min-w-0">
                <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 cursor-grab" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{f.label}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">({f.key})</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{FIELD_TYPES.find(t => t.value === f.type)?.label || f.type}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={f.is_active ? "default" : "secondary"} className="text-[10px]">
                  {f.is_active ? "Ativo" : "Inativo"}
                </Badge>
                <Button size="icon" variant="ghost" onClick={() => openEdit(f)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remover este campo?")) deleteMut.mutate(f.id); }}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
          {(fields as any[] ?? []).length === 0 && (
            <p className="p-6 text-sm text-muted-foreground text-center">Nenhum campo personalizado criado ainda.</p>
          )}
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar campo" : "Novo campo personalizado"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome do campo *</Label>
              <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Ex: Profissão" />
              {editing && <p className="text-[10px] text-muted-foreground font-mono">Chave interna: {editing.key}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de campo *</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Placeholder</Label>
              <Input value={form.placeholder} onChange={(e) => setForm({ ...form, placeholder: e.target.value })} />
            </div>
            {needsOptions && (
              <div className="space-y-1.5">
                <Label>Opções</Label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {form.options.map((opt: string, idx: number) => (
                    <Badge key={idx} variant="outline" className="gap-1 pr-1">
                      {opt}
                      <button className="text-muted-foreground hover:text-foreground text-xs ml-1" onClick={() => removeOption(idx)}>✕</button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input value={newOption} onChange={(e) => setNewOption(e.target.value)} placeholder="Nova opção..." onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOption(); } }} />
                  <Button size="sm" variant="outline" onClick={addOption}>Adicionar</Button>
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Valor padrão</Label>
              <Input value={form.default_value} onChange={(e) => setForm({ ...form, default_value: e.target.value })} />
            </div>
            <div className="flex flex-wrap gap-4 pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={form.required} onCheckedChange={(v) => setForm({ ...form, required: !!v })} />
                <span className="text-sm">Obrigatório</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={form.show_on_form} onCheckedChange={(v) => setForm({ ...form, show_on_form: !!v })} />
                <span className="text-sm">Mostrar no formulário</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={form.show_on_table} onCheckedChange={(v) => setForm({ ...form, show_on_table: !!v })} />
                <span className="text-sm">Mostrar na lista</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={form.show_on_details} onCheckedChange={(v) => setForm({ ...form, show_on_details: !!v })} />
                <span className="text-sm">Mostrar no detalhe</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: !!v })} />
                <span className="text-sm">Ativo</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={save} disabled={createMut.isPending || updateMut.isPending}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const Route = createFileRoute("/_app/settings/custom-fields")({ component: CustomFieldsSettingsPage });
