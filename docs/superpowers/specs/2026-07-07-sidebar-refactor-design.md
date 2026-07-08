# Sidebar Refactor Design

## Problema
A sidebar principal em `src/routes/_app.tsx`:
- Usa `any` em toda manipulação de NAV, perdendo type safety
- Accordion manual (state `openMenus`) em vez de `Collapsible` do shadcn
- Admin permission hardcoded em 2 lugares (`["/users","/audit","/webhook-events","/billing"]`)
- Indicador ativo com borda manual (`absolute left-0...`) em vez de `data-active` do shadcn
- Badge de notificação com `animate-pulse` (distrativo)
- Focus states ausentes nos Links (só o botão accordion tem)
- Spacing inconsistente (`px-6` logo vs `px-3` nav)
- Sheet mobile sem `SheetClose` nos links

## Escopo
Apenas `src/routes/_app.tsx` — cirurgia pontual, sem criar novos componentes.

## Mudanças

### 1. Tipagem forte
```typescript
interface NavChildItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}
interface NavParentItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children: NavChildItem[];
}
type NavItem = NavParentItem | { to: string; label: string; icon: ... };
```

### 2. Collapsible no submenu
Substituir `div>button+div` manual por `<Collapsible>`, `<CollapsibleTrigger>`, `<CollapsibleContent>`.

### 3. Admin paths deduplicado
`const ADMIN_ONLY_PATHS = ["/users","/audit","/webhook-events","/billing"]` usado no filtro pai e filho.

### 4. data-active + aria-current
Trocar `absolute left-0...` por `data-active={active}` + `aria-current={active ? "page" : undefined}`.

### 5. Focus visível
Adicionar `focus-visible:ring-2 focus-visible:ring-sidebar-ring` aos Links.

### 6. Sem pulse
Remover `animate-pulse` do badge e do dot.

### 7. Spacing
Logo: `px-4` (em vez de `px-6`). Nav mantém `px-3`.

### 8. SheetClose
Envolver links do Sheet mobile em `SheetClose` do shadcn.
