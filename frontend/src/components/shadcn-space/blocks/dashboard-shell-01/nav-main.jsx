import { ChevronRight } from "lucide-react";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

export function NavMain({ items }) {
  const { pathname } = useLocation();

  const renderItem = (item) => {
    if (item.isSection && item.label) {
      return (
        <SidebarGroup key={item.label} className="p-0 pt-5 first:pt-0">
          <SidebarGroupLabel className="p-0 text-xs font-medium uppercase text-sidebar-foreground/60">
            {item.label}
          </SidebarGroupLabel>
        </SidebarGroup>
      );
    }

    const hasChildren = !!item.children?.length;

    if (hasChildren && item.title) {
      return (
        <SidebarGroup key={item.title} className="p-0">
          <SidebarMenu>
            <Collapsible>
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton
                    className="rounded-xl text-sm px-3 py-2 h-9 cursor-pointer"
                  >
                    {item.icon && <item.icon size={16} />}
                    <span>{item.title}</span>
                    <ChevronRight className="ml-auto transition-transform duration-200 data-[state=open]:rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub className="me-0 pe-0">
                    {item.children.map(renderItemSub)}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          </SidebarMenu>
        </SidebarGroup>
      );
    }

    if (item.title) {
      const isActive = item.isActive ?? pathname === item.href;
      return (
        <SidebarGroup key={item.title} className="p-0">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={isActive}
                className={cn("rounded-lg text-sm px-3 py-2 h-9")}
              >
                <NavLink to={item.href}>
                  {item.icon && <item.icon size={16} />}
                  <span>{item.title}</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      );
    }

    return null;
  };

  const renderItemSub = (item) => {
    const hasChildren = !!item.children?.length;

    if (hasChildren && item.title) {
      return (
        <SidebarMenuSubItem key={item.title}>
          <Collapsible>
            <CollapsibleTrigger asChild>
              <SidebarMenuSubButton className="rounded-xl text-sm px-3 py-2 h-9 cursor-pointer">
                {item.icon && <item.icon size={16} />}
                <span>{item.title}</span>
                <ChevronRight className="ml-auto transition-transform duration-200 data-[state=open]:rotate-90" />
              </SidebarMenuSubButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub className="me-0 pe-0">
                {item.children.map(renderItemSub)}
              </SidebarMenuSub>
            </CollapsibleContent>
          </Collapsible>
        </SidebarMenuSubItem>
      );
    }

    if (item.title) {
      return (
        <SidebarMenuSubItem key={item.title} className="w-full">
          <SidebarMenuSubButton asChild className="w-full">
            <NavLink to={item.href}>{item.title}</NavLink>
          </SidebarMenuSubButton>
        </SidebarMenuSubItem>
      );
    }

    return null;
  };

  return <>{items.map(renderItem)}</>;
}
