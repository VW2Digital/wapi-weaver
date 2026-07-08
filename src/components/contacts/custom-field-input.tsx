import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface CustomField {
  id: string;
  label: string;
  key: string;
  type: string;
  placeholder: string | null;
  options: string[] | null;
  required: boolean;
  is_active: boolean;
}

interface Props {
  field: CustomField;
  value: any;
  onChange: (value: any) => void;
}

export function CustomFieldInput({ field, value, onChange }: Props) {
  const id = `cf-${field.id}`;

  switch (field.type) {
    case "textarea":
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id}>{field.label}{field.required ? " *" : ""}</Label>
          <Textarea id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder ?? ""} rows={3} />
        </div>
      );

    case "number":
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id}>{field.label}{field.required ? " *" : ""}</Label>
          <Input id={id} type="number" value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder ?? ""} />
        </div>
      );

    case "currency":
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id}>{field.label}{field.required ? " *" : ""}</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
            <Input id={id} className="pl-8" value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder="0,00" />
          </div>
        </div>
      );

    case "date":
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id}>{field.label}{field.required ? " *" : ""}</Label>
          <Input id={id} type="date" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
        </div>
      );

    case "datetime":
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id}>{field.label}{field.required ? " *" : ""}</Label>
          <Input id={id} type="datetime-local" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
        </div>
      );

    case "select": {
      const opts: string[] = field.options ?? [];
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id}>{field.label}{field.required ? " *" : ""}</Label>
          <Select value={value ?? ""} onValueChange={onChange}>
            <SelectTrigger id={id}><SelectValue placeholder={field.placeholder ?? "Selecione..."} /></SelectTrigger>
            <SelectContent>
              {opts.map((o: string) => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    case "multi_select": {
      const opts: string[] = field.options ?? [];
      const selected: string[] = Array.isArray(value) ? value : [];
      const toggle = (opt: string) => {
        onChange(selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt]);
      };
      return (
        <div className="space-y-1.5">
          <Label>{field.label}{field.required ? " *" : ""}</Label>
          <div className="flex flex-wrap gap-2">
            {opts.map((o: string) => (
              <label key={o} className="flex items-center gap-1.5 cursor-pointer text-sm">
                <input type="checkbox" checked={selected.includes(o)} onChange={() => toggle(o)} className="rounded border-border" />
                {o}
              </label>
            ))}
          </div>
        </div>
      );
    }

    case "boolean":
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox checked={value === "true" || value === true} onCheckedChange={(v) => onChange(v ? "true" : "false")} />
          <span className="text-sm">{field.label}{field.required ? " *" : ""}</span>
        </label>
      );

    case "email":
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id}>{field.label}{field.required ? " *" : ""}</Label>
          <Input id={id} type="email" value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder ?? ""} />
        </div>
      );

    case "phone":
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id}>{field.label}{field.required ? " *" : ""}</Label>
          <Input id={id} type="tel" value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder ?? "+55 11 99999-0000"} />
        </div>
      );

    case "url":
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id}>{field.label}{field.required ? " *" : ""}</Label>
          <Input id={id} type="url" value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder ?? "https://"} />
        </div>
      );

    default:
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id}>{field.label}{field.required ? " *" : ""}</Label>
          <Input id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder ?? ""} />
        </div>
      );
  }
}
