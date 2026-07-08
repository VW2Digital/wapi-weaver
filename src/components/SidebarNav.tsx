import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  SidebarContent,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarMenuBadge,
  useSidebar,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRight, PanelLeftClose, PanelLeftOpen, PanelRightOpen } from "lucide-react";

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
  const { toggleSidebar, state, isMobile } = useSidebar();
  
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const updates: Record<string, boolean> = {};
    for (const group of groups) {
      for (const item of group) {
        if (item.children?.some((child) => activePath === child.id || activePath.startsWith(child.id + "/"))) {
          updates[item.id] = true;
        }
      }
    }
    if (Object.keys(updates).length > 0) {
      setOpenMenus((prev) => ({ ...prev, ...updates }));
    }
  }, [activePath, groups]);

  return (
    <>
      <SidebarHeader className="py-5">
        <div className="flex items-center justify-between px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          
          {/* Logo area: static when expanded, hover-to-expand when collapsed */}
          <div 
            className={cn("flex items-center gap-3", state === "collapsed" && "cursor-pointer group/logo")} 
            onClick={state === "collapsed" ? toggleSidebar : undefined}
            title={state === "collapsed" ? "Expandir Menu" : undefined}
          >
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-transparent overflow-hidden">
              {/* Logo is always visible, but fades out on hover IF collapsed */}
              <div className="absolute inset-0 flex items-center justify-center transition-opacity duration-200 group-data-[collapsible=icon]:group-hover/logo:opacity-0">
                {logo}
              </div>
              {/* Expand icon only appears on hover IF collapsed */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-data-[collapsible=icon]:group-hover/logo:opacity-100 transition-opacity duration-200 text-white">
                <PanelLeftOpen size={24} />
              </div>
            </div>
            <span className="truncate font-display text-lg font-semibold text-sidebar-foreground group-data-[collapsible=icon]:hidden">
              {appName}
            </span>
          </div>

          {/* Close button on the far right (only visible when expanded) */}
          <button
            onClick={toggleSidebar}
            className="text-sidebar-foreground hover:opacity-70 transition-opacity group-data-[collapsible=icon]:hidden flex items-center justify-center"
            title="Recolher Menu"
            aria-label="Recolher Menu"
          >
            <PanelRightOpen size={24} />
          </button>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <div className="px-4 pb-2 text-[11px] font-medium uppercase tracking-wider text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
          Menu
        </div>

        {groups.map((group, gi) => {
          const showGroupBg = group.length > 1;
          return (
            <SidebarGroup key={gi} className={cn("p-0", showGroupBg && "bg-sidebar-accent/30 rounded-2xl p-1 mb-2")}>
              <SidebarMenu>
                {group.map((item) => {
                  const Icon = item.icon;
                  const hasChildren = item.children && item.children.length > 0;

                  if (hasChildren) {
                    const children = item.children!;
                    const isAnyChildActive = children.some((child) => activePath === child.id || activePath.startsWith(child.id + "/"));
                    const isOpen = openMenus[item.id] ?? isAnyChildActive;

                    return (
                      <Collapsible
                        key={item.id}
                        open={isOpen}
                        onOpenChange={(open) => setOpenMenus((prev) => ({ ...prev, [item.id]: open }))}
                        asChild
                      >
                        <SidebarMenuItem>
                          <CollapsibleTrigger asChild>
                            <SidebarMenuButton
                              tooltip={item.label}
                              isActive={isAnyChildActive}
                              className={cn("justify-between transition-all rounded-full h-10 group-data-[collapsible=icon]:!w-10 group-data-[collapsible=icon]:!h-10 group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:mx-auto")}
                            >
                              <div className="flex items-center gap-3 group-data-[collapsible=icon]:gap-0">
                                <span className={cn("flex h-7 w-7 items-center justify-center rounded-full shrink-0", isAnyChildActive && "bg-primary/20 text-primary")}>
                                  <Icon className="h-4 w-4" />
                                </span>
                                <span className="group-data-[collapsible=icon]:hidden whitespace-nowrap">{item.label}</span>
                              </div>
                              <ChevronRight className={cn("h-4 w-4 shrink-0 transition-transform duration-200 group-data-[collapsible=icon]:hidden", isOpen && "rotate-90")} />
                            </SidebarMenuButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <SidebarMenuSub className="border-sidebar-border ml-[22px] mt-2 pl-3 group-data-[collapsible=icon]:hidden">
                              {children.map((child) => {
                                const childActive = activePath === child.id || activePath.startsWith(child.id + "/");
                                const ChildIcon = child.icon;
                                return (
                                  <SidebarMenuSubItem key={child.id}>
                                    <SidebarMenuSubButton
                                      isActive={childActive}
                                      onClick={() => onNavigate(child.id)}
                                      className={cn("rounded-full h-9 cursor-pointer", childActive && "bg-brand-gradient text-primary-foreground hover:opacity-90 data-[active=true]:bg-brand-gradient data-[active=true]:text-primary-foreground font-semibold [&>svg]:text-primary-foreground")}
                                    >
                                      <ChildIcon className="h-4 w-4" />
                                      <span>{child.label}</span>
                                    </SidebarMenuSubButton>
                                  </SidebarMenuSubItem>
                                );
                              })}
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        </SidebarMenuItem>
                      </Collapsible>
                    );
                  }

                  const isActive = activePath === item.id || activePath.startsWith(item.id + "/");

                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        tooltip={item.label}
                        isActive={isActive}
                        onClick={() => onNavigate(item.id)}
                        className={cn("h-10 rounded-full transition-all group/nav cursor-pointer group-data-[collapsible=icon]:!w-10 group-data-[collapsible=icon]:!h-10 group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:mx-auto", isActive && "bg-brand-gradient text-primary-foreground hover:opacity-90 data-[active=true]:bg-brand-gradient data-[active=true]:text-primary-foreground font-semibold")}
                      >
                        <div className="flex items-center justify-center relative shrink-0">
                          <span className={cn("flex h-7 w-7 items-center justify-center rounded-full transition-transform duration-200 shrink-0", isActive && "text-primary-foreground", !isActive && "group-hover/nav:scale-110")}>
                            <Icon className="h-4 w-4 shrink-0" />
                          </span>
                          {state === "collapsed" && !isMobile && item.badge != null && Number(item.badge) > 0 && (
                            <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full border border-sidebar bg-destructive" />
                          )}
                        </div>
                        <span className="transition-transform duration-200 group-hover/nav:translate-x-0.5 whitespace-nowrap group-data-[collapsible=icon]:hidden">
                          {item.label}
                        </span>
                        {item.badge != null && Number(item.badge) > 0 && (
                          <SidebarMenuBadge className="bg-destructive text-destructive-foreground rounded-full ml-auto group-data-[collapsible=icon]:hidden right-2 h-5 w-5 flex items-center justify-center p-0 text-[10px]">
                            {item.badge}
                          </SidebarMenuBadge>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter>
        {footer}
      </SidebarFooter>
    </>
  );
}
