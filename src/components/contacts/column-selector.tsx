import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Columns3 } from "lucide-react";

interface ColumnDef {
  id: string;
  label: string;
  group: "standard" | "custom";
}

interface Props {
  columns: ColumnDef[];
  visible: string[];
  onChange: (visible: string[]) => void;
}

export function ColumnSelector({ columns, visible, onChange }: Props) {
  const standard = columns.filter((c) => c.group === "standard");
  const custom = columns.filter((c) => c.group === "custom");

  const toggle = (id: string) => {
    onChange(visible.includes(id) ? visible.filter((v) => v !== id) : [...visible, id]);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Columns3 className="h-4 w-4" />
          Colunas
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3 max-h-80 overflow-y-auto">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Padrão</p>
          {standard.map((col) => (
            <label key={col.id} className="flex items-center gap-2 py-1 cursor-pointer text-sm hover:bg-muted/40 rounded px-1">
              <Checkbox checked={visible.includes(col.id)} onCheckedChange={() => toggle(col.id)} />
              {col.label}
            </label>
          ))}
        </div>
        {custom.length > 0 && (
          <div className="space-y-1 mt-3 pt-3 border-t">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Personalizados</p>
            {custom.map((col) => (
              <label key={col.id} className="flex items-center gap-2 py-1 cursor-pointer text-sm hover:bg-muted/40 rounded px-1">
                <Checkbox checked={visible.includes(col.id)} onCheckedChange={() => toggle(col.id)} />
                {col.label}
              </label>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
