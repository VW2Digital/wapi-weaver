import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronUp, PanelLeftClose, PanelRightOpen } from "lucide-react";

export type SidebarNavItem = {
  id: string;
  label: string;
  icon: React.ElementType<{ className?: string }>;
  badge?: string | number;
  children?: SidebarNavItem[];
};

export type SidebarNavGroup = SidebarNavItem[];

export interface SidebarNavProps {
  appName: string;
  logo: React.ReactNode;
  groups: SidebarNavGroup[];
  activePath: string;
  onNavigate: (id: string) => void;
  footer?: React.ReactNode;
}

export function SidebarNav({ appName, logo, groups, activePath, onNavigate, footer }: SidebarNavProps) {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const updates: Record<string, boolean> = {};
    for (const group of groups) {
      for (const item of group) {
        if (item.children?.some((child) => activePath.startsWith(child.id))) {
          updates[item.id] = true;
        }
      }
    }
    if (Object.keys(updates).length > 0) {
      setOpenMenus((prev) => ({ ...prev, ...updates }));
    }
  }, [activePath, groups]);

  return (
    <div className="flex h-full flex-col overflow-x-hidden">
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-5",
          collapsed && "justify-center px-2",
        )}
      >
        <div className="flex w-9 h-9 shrink-0 items-center justify-center rounded-full bg-sidebar-accent">
          {logo}
        </div>
        {!collapsed && (
          <span className="whitespace-nowrap font-display text-base font-semibold text-sidebar-foreground">
            {appName}
          </span>
        )}
      </div>

      {!collapsed && (
        <div className="px-4 pb-2 text-[11px] font-medium uppercase tracking-wider text-sidebar-foreground/60">
          Menu
        </div>
      )}

      <nav className="flex-1 flex flex-col gap-3 overflow-y-auto overflow-x-hidden px-3 group-data-[collapsible=icon]:px-1.5">
        {groups.map((group, gi) => {
          const showGroupBg = group.length > 1;
          return (
            <div
              key={gi}
              className={cn(
                "flex flex-col gap-0.5",
                showGroupBg && "rounded-2xl bg-sidebar-accent/10 p-1",
              )}
            >
              {group.map((item) => {
                const Icon = item.icon;
                const hasChildren = item.children && item.children.length > 0;

                  if (hasChildren) {
                  const children = item.children!;
                  const isAnyChildActive = children.some((child) =>
                    activePath.startsWith(child.id),
                  );
                  const isOpen = openMenus[item.id] ?? isAnyChildActive;

                  return (
                    <Collapsible
                      key={item.id}
                      open={isOpen}
                      onOpenChange={(open) =>
                        setOpenMenus((prev) => ({ ...prev, [item.id]: open }))
                      }
                    >
                      <div className="relative">
                        <CollapsibleTrigger asChild>
                          <button
                            type="button"
                            className={cn(
                              "flex w-full items-center justify-between rounded-full px-3 py-2.5 text-sm transition-all duration-200 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                              collapsed && "justify-center",
                              isOpen
                                ? "bg-sidebar-accent/10 text-sidebar-foreground font-semibold"
                                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
                            )}
                          >
                            <div
                              className={cn(
                                "flex items-center gap-3",
                                collapsed && "justify-center",
                              )}
                            >
                              <span
                                className={cn(
                                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                                  isOpen && "bg-primary/70",
                                )}
                              >
                                <Icon
                                  className={cn(
                                    "h-4 w-4",
                                    isOpen
                                      ? "text-primary-foreground"
                                      : "text-sidebar-foreground/70",
                                  )}
                                />
                              </span>
                              {!collapsed && (
                                <span className="whitespace-nowrap transition-transform duration-200">
                                  {item.label}
                                </span>
                              )}
                            </div>
                            {!collapsed && (
                              <ChevronUp
                                className={cn(
                                  "h-4 w-4 shrink-0 text-sidebar-foreground/60 transition-transform duration-200",
                                  !isOpen && "rotate-180",
                                )}
                              />
                            )}
                          </button>
                        </CollapsibleTrigger>
                        {collapsed && (
                          <div className="invisible absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-popover px-3 py-2 text-sm text-popover-foreground opacity-0 shadow-md transition-all duration-200 group-hover:visible group-hover:opacity-100 pointer-events-none">
                            {item.label}
                          </div>
                        )}
                      </div>
                      <CollapsibleContent>
                          <div className={cn("mt-1 space-y-0.5 pl-6", collapsed && "hidden")}>
                          {children.map((child) => {
                            const childActive = activePath.startsWith(child.id);
                            const ChildIcon = child.icon;
                            return (
                              <button
                                key={child.id}
                                type="button"
                                onClick={() => onNavigate(child.id)}
                                className={cn(
                                  "flex w-full items-center gap-3 rounded-full px-3 py-2.5 text-sm transition-all duration-200 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                                  collapsed && "justify-center px-0",
                                  childActive
                                    ? "bg-primary text-primary-foreground font-semibold"
                                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent/30 hover:text-sidebar-foreground",
                                )}
                              >
                                <span
                                  className={cn(
                                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                                    childActive && "bg-primary/70",
                                  )}
                                >
                                  <ChildIcon className="h-4 w-4" />
                                </span>
                                {!collapsed && <span>{child.label}</span>}
                              </button>
                            );
                          })}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                }

                const isActive =
                  activePath === item.id || activePath.startsWith(item.id);

                return (
                  <div key={item.id} className="relative group/nav">
                    <button
                      type="button"
                      onClick={() => onNavigate(item.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-full px-3 py-2.5 text-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                        collapsed && "justify-center px-0",
                        isActive
                          ? "bg-primary text-primary-foreground font-semibold"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
                      )}
                    >
                      <div className="relative flex shrink-0 items-center justify-center">
                        <span
                          className={cn(
                            "flex h-7 w-7 items-center justify-center rounded-full transition-transform duration-200",
                            isActive && "bg-primary/70",
                            !isActive && "group-hover/nav:scale-110",
                          )}
                        >
                          <Icon
                            className={cn(
                              "h-4 w-4",
                              isActive
                                ? "text-primary-foreground"
                                : "text-sidebar-foreground/70",
                            )}
                          />
                        </span>
                        {collapsed && item.badge != null && Number(item.badge) > 0 && (
                          <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full border border-sidebar bg-[#FF424E]" />
                        )}
                      </div>
                      {!collapsed && (
                        <>
                          <span className="whitespace-nowrap transition-transform duration-200 group-hover/nav:translate-x-0.5">
                            {item.label}
                          </span>
                          {item.badge != null && Number(item.badge) > 0 && (
                            <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#FF424E] px-1.5 text-[10px] font-bold text-white">
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                    </button>

                    {collapsed && (
                      <div className="invisible absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-popover px-3 py-2 text-sm text-popover-foreground opacity-0 shadow-md transition-all duration-200 group-hover/nav:visible group-hover/nav:opacity-100 pointer-events-none">
                        {item.label}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </nav>

      {footer && <div>{footer}</div>}

      <button
        type="button"
        onClick={toggleSidebar}
        className={cn(
          "mx-3 my-2 flex items-center gap-3 rounded-full px-3 py-2.5 text-sm transition-all duration-200",
          collapsed && "mx-2 justify-center",
          "text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        )}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center">
          {collapsed ? <PanelRightOpen size={16} /> : <PanelLeftClose size={16} />}
        </span>
        {!collapsed && <span className="whitespace-nowrap">Recolher menu</span>}
      </button>
    </div>
  );
}
