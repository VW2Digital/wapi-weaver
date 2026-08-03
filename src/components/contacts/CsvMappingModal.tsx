import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileSpreadsheet,
  Phone,
  User,
  Mail,
  Tag,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Briefcase,
  Building,
  FileText,
  Plus,
} from "lucide-react";

export type MappingTargetType =
  | "phone"
  | "name"
  | "email"
  | "company"
  | "position"
  | "notes"
  | "custom"
  | "skip";

export interface ColumnMappingConfig {
  targetType: MappingTargetType;
  customKey: string;
}

export interface CustomFieldDefinition {
  id?: string;
  label: string;
  key: string;
}

export interface CsvMappingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  headers: string[];
  rows: Record<string, any>[];
  customFields?: CustomFieldDefinition[];
  onConfirm: (
    mappedContacts: {
      phone: string;
      name?: string | null;
      email?: string | null;
      custom_fields?: Record<string, any>;
    }[],
  ) => Promise<void>;
  isSubmitting?: boolean;
}

export const CsvMappingModal: React.FC<CsvMappingModalProps> = ({
  open,
  onOpenChange,
  fileName,
  headers,
  rows,
  customFields = [],
  onConfirm,
  isSubmitting = false,
}) => {
  const [mappings, setMappings] = useState<Record<string, ColumnMappingConfig>>({});

  // Auto-detection logic when headers change
  useEffect(() => {
    if (!headers || headers.length === 0) return;

    const initialMappings: Record<string, ColumnMappingConfig> = {};
    let phoneAssigned = false;
    let nameAssigned = false;
    let emailAssigned = false;
    let companyAssigned = false;
    let positionAssigned = false;

    headers.forEach((h) => {
      const lower = h.toLowerCase().trim();

      if (!phoneAssigned && /phone|telefone|celular|whatsapp|fone|num|contato/i.test(lower)) {
        initialMappings[h] = { targetType: "phone", customKey: "" };
        phoneAssigned = true;
      } else if (!nameAssigned && /name|nome|cliente|razao/i.test(lower)) {
        initialMappings[h] = { targetType: "name", customKey: "" };
        nameAssigned = true;
      } else if (!emailAssigned && /email|e-mail|mail/i.test(lower)) {
        initialMappings[h] = { targetType: "email", customKey: "" };
        emailAssigned = true;
      } else if (!companyAssigned && /empresa|company|organizacao/i.test(lower)) {
        initialMappings[h] = { targetType: "company", customKey: "empresa" };
        companyAssigned = true;
      } else if (!positionAssigned && /cargo|funcao|position|job/i.test(lower)) {
        initialMappings[h] = { targetType: "position", customKey: "cargo" };
        positionAssigned = true;
      } else {
        // Match against registered custom fields if available
        const matchedCf = customFields.find(
          (cf) => cf.label.toLowerCase().trim() === lower || cf.key.toLowerCase().trim() === lower,
        );

        if (matchedCf) {
          initialMappings[h] = { targetType: "custom", customKey: matchedCf.key };
        } else {
          // Default to custom field with column name
          initialMappings[h] = { targetType: "custom", customKey: h.trim() };
        }
      }
    });

    // Fallback if no phone header matched
    if (!phoneAssigned && headers.length > 0) {
      initialMappings[headers[0]] = { targetType: "phone", customKey: "" };
    }

    setMappings(initialMappings);
  }, [headers, customFields]);

  const handleSelectionChange = (header: string, val: string) => {
    setMappings((prev) => {
      const updated = { ...prev };

      if (val.startsWith("custom:")) {
        const customKey = val.replace("custom:", "");
        updated[header] = { targetType: "custom", customKey };
      } else if (val === "custom_new") {
        updated[header] = { targetType: "custom", customKey: header.trim() };
      } else {
        const targetType = val as MappingTargetType;
        // Unassign unique single fields if reassigned
        if (["phone", "name", "email", "company", "position", "notes"].includes(targetType)) {
          Object.keys(updated).forEach((h) => {
            if (updated[h]?.targetType === targetType) {
              updated[h] = { targetType: "skip", customKey: h };
            }
          });
        }
        updated[header] = { targetType, customKey: header.trim() };
      }

      return updated;
    });
  };

  const handleCustomKeyChange = (header: string, customKey: string) => {
    setMappings((prev) => ({
      ...prev,
      [header]: {
        ...prev[header],
        customKey,
      },
    }));
  };

  // Compute mapped rows and validation
  const { validContacts, phoneHeaderName } = useMemo(() => {
    const phoneHeader = Object.keys(mappings).find(
      (h) => mappings[h]?.targetType === "phone",
    );

    if (!phoneHeader) {
      return { validContacts: [], phoneHeaderName: null };
    }

    const nameHeader = Object.keys(mappings).find((h) => mappings[h]?.targetType === "name");
    const emailHeader = Object.keys(mappings).find((h) => mappings[h]?.targetType === "email");
    const companyHeader = Object.keys(mappings).find((h) => mappings[h]?.targetType === "company");
    const positionHeader = Object.keys(mappings).find((h) => mappings[h]?.targetType === "position");
    const notesHeader = Object.keys(mappings).find((h) => mappings[h]?.targetType === "notes");

    const customHeaders = Object.keys(mappings).filter(
      (h) => mappings[h]?.targetType === "custom",
    );

    const result = rows
      .map((r) => {
        const rawPhone = String(r[phoneHeader] ?? "").trim();
        const cleanPhone = rawPhone.replace(/\D+/g, "");

        if (cleanPhone.length < 8) return null;

        const name = nameHeader ? String(r[nameHeader] ?? "").trim() || null : null;
        const email = emailHeader ? String(r[emailHeader] ?? "").trim() || null : null;

        const custom_fields: Record<string, any> = {};

        if (companyHeader && r[companyHeader]) custom_fields["empresa"] = String(r[companyHeader]).trim();
        if (positionHeader && r[positionHeader]) custom_fields["cargo"] = String(r[positionHeader]).trim();
        if (notesHeader && r[notesHeader]) custom_fields["observacoes"] = String(r[notesHeader]).trim();

        customHeaders.forEach((ch) => {
          const keyName = mappings[ch]?.customKey || ch;
          const val = r[ch];
          if (val !== undefined && val !== null && val !== "") {
            custom_fields[keyName] = val;
          }
        });

        return {
          phone: rawPhone,
          name,
          email,
          custom_fields: Object.keys(custom_fields).length > 0 ? custom_fields : undefined,
        };
      })
      .filter(Boolean) as {
        phone: string;
        name?: string | null;
        email?: string | null;
        custom_fields?: Record<string, any>;
      }[];

    return { validContacts: result, phoneHeaderName: phoneHeader };
  }, [mappings, rows]);

  const handleSubmit = async () => {
    if (!phoneHeaderName) return;
    await onConfirm(validContacts);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card border border-muted-foreground/15 rounded-xl p-6">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
            <span>Mapeamento Profissional de Contatos e Células (CSV)</span>
          </DialogTitle>
        </DialogHeader>

        {/* File summary banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-lg border border-border bg-muted/40 gap-3 my-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-500">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold text-sm text-foreground">{fileName}</p>
              <p className="text-xs text-muted-foreground">
                {rows.length} linhas de contatos · {headers.length} colunas no arquivo
              </p>
            </div>
          </div>

          <div>
            {phoneHeaderName ? (
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-300 dark:border-emerald-800 gap-1.5 text-xs py-1 px-3">
                <CheckCircle2 className="h-4 w-4" /> <strong>{validContacts.length}</strong> contatos prontos para importar
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1.5 text-xs py-1 px-3">
                <AlertCircle className="h-4 w-4" /> Selecione a coluna de Telefone
              </Badge>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          Mapeie as colunas do seu CSV para os <strong>Campos Padrão do Contato</strong> (Telefone, Nome, Email, Empresa...) ou para os <strong>Campos Personalizados</strong> cadastrados. As amostras das células do seu arquivo são exibidas abaixo de cada coluna para facilitar o mapeamento.
        </p>

        {/* Column Mapping Table */}
        <div className="border rounded-xl divide-y divide-border/60 overflow-hidden my-2">
          <div className="grid grid-cols-12 gap-3 p-3 bg-muted/70 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <div className="col-span-5">Coluna no CSV & Células de Amostra</div>
            <div className="col-span-7">Campo de Destino no Contato</div>
          </div>

          <div className="divide-y divide-border/40 max-h-[360px] overflow-y-auto">
            {headers.map((header) => {
              const currentMapping = mappings[header] || { targetType: "skip", customKey: header };

              // Sample values from the first 3 non-empty rows
              const samples = rows
                .map((r) => r[header])
                .filter((v) => v !== undefined && v !== null && String(v).trim() !== "")
                .slice(0, 3);

              const selectedValue =
                currentMapping.targetType === "custom"
                  ? `custom:${currentMapping.customKey}`
                  : currentMapping.targetType;

              return (
                <div key={header} className="grid grid-cols-12 gap-3 p-3 items-center text-sm hover:bg-muted/20 transition-colors">
                  {/* Column Header & Sample Cells */}
                  <div className="col-span-5 space-y-1">
                    <div className="font-semibold text-sm text-foreground flex items-center gap-1.5" title={header}>
                      <span className="truncate">{header}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {samples.length > 0 ? (
                        samples.map((sv, idx) => (
                          <span
                            key={idx}
                            className="inline-block max-w-[160px] text-[11px] text-muted-foreground bg-muted/60 dark:bg-muted/30 px-1.5 py-0.5 rounded border border-border/40 truncate font-mono"
                            title={String(sv)}
                          >
                            {String(sv)}
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] text-muted-foreground/60 italic">(Célula vazia)</span>
                      )}
                    </div>
                  </div>

                  {/* Target Field Selector */}
                  <div className="col-span-7 space-y-2">
                    <Select
                      value={selectedValue}
                      onValueChange={(val) => handleSelectionChange(header, val)}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        <SelectGroup>
                          <SelectLabel className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-1">
                            Campos Padrão do Contato
                          </SelectLabel>
                          <SelectItem value="phone">
                            <span className="flex items-center gap-2 text-emerald-600 font-medium">
                              <Phone className="h-3.5 w-3.5" /> Telefone / WhatsApp (Obrigatório)
                            </span>
                          </SelectItem>
                          <SelectItem value="name">
                            <span className="flex items-center gap-2 text-blue-600 font-medium">
                              <User className="h-3.5 w-3.5" /> Nome Completo
                            </span>
                          </SelectItem>
                          <SelectItem value="email">
                            <span className="flex items-center gap-2 text-purple-600 font-medium">
                              <Mail className="h-3.5 w-3.5" /> E-mail
                            </span>
                          </SelectItem>
                          <SelectItem value="company">
                            <span className="flex items-center gap-2 text-cyan-600">
                              <Building className="h-3.5 w-3.5" /> Empresa
                            </span>
                          </SelectItem>
                          <SelectItem value="position">
                            <span className="flex items-center gap-2 text-indigo-600">
                              <Briefcase className="h-3.5 w-3.5" /> Cargo / Função
                            </span>
                          </SelectItem>
                          <SelectItem value="notes">
                            <span className="flex items-center gap-2 text-slate-600">
                              <FileText className="h-3.5 w-3.5" /> Observações
                            </span>
                          </SelectItem>
                        </SelectGroup>

                        {customFields.length > 0 && (
                          <SelectGroup>
                            <SelectLabel className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider px-2 py-1">
                              Campos Personalizados Cadastrados
                            </SelectLabel>
                            {customFields.map((cf) => (
                              <SelectItem key={cf.key} value={`custom:${cf.key}`}>
                                <span className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-medium">
                                  <Tag className="h-3.5 w-3.5" /> {cf.label} ({cf.key})
                                </span>
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        )}

                        <SelectGroup>
                          <SelectLabel className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-1">
                            Outras Opções
                          </SelectLabel>
                          <SelectItem value="custom_new">
                            <span className="flex items-center gap-2 text-amber-600">
                              <Plus className="h-3.5 w-3.5" /> Criar Novo Campo Customizado...
                            </span>
                          </SelectItem>
                          <SelectItem value="skip">
                            <span className="flex items-center gap-2 text-muted-foreground">
                              <EyeOff className="h-3.5 w-3.5" /> 🚫 Ignorar esta coluna
                            </span>
                          </SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>

                    {currentMapping.targetType === "custom" &&
                      !customFields.some((cf) => cf.key === currentMapping.customKey) && (
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-[11px] text-muted-foreground whitespace-nowrap">Chave Personalizada:</span>
                          <Input
                            size={1}
                            className="h-7 text-xs font-mono"
                            value={currentMapping.customKey}
                            onChange={(e) => handleCustomKeyChange(header, e.target.value)}
                            placeholder="Ex: endereco, profissao..."
                          />
                        </div>
                      )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Preview section */}
        {validContacts.length > 0 && (
          <div className="space-y-2 mt-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Pré-visualização da Importação (Primeiras 3 linhas):
            </span>
            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2 max-h-[140px] overflow-y-auto">
              {validContacts.slice(0, 3).map((item, idx) => (
                <div key={idx} className="flex flex-wrap items-center gap-2 text-xs border-b border-border/40 pb-2 last:border-0 last:pb-0">
                  <span className="font-mono text-emerald-600 font-semibold flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {item.phone}
                  </span>
                  {item.name && (
                    <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 font-medium">
                      {item.name}
                    </span>
                  )}
                  {item.email && (
                    <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-600 font-medium">
                      {item.email}
                    </span>
                  )}
                  {item.custom_fields &&
                    Object.entries(item.custom_fields).map(([k, v]) => (
                      <span key={k} className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400">
                        <strong>{k}:</strong> {String(v)}
                      </span>
                    ))}
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="mt-4 pt-3 border-t border-border flex items-center justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!phoneHeaderName || validContacts.length === 0 || isSubmitting}
            className="bg-emerald-600 text-white hover:bg-emerald-700 font-medium"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importando...
              </>
            ) : (
              <>
                Confirmar e Importar {validContacts.length} Contatos <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
