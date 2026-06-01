import React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { NavMain } from "@/components/shadcn-space/blocks/dashboard-shell-01/nav-main";
import { SiteHeader } from "@/components/shadcn-space/blocks/dashboard-shell-01/site-header";
import {
  LayoutDashboard,
  Building2,
  Users,
  Clock,
  FileBarChart,
  BarChart2,
  Settings,
} from "lucide-react";
import SimpleBar from "simplebar-react";
import "simplebar-react/dist/simplebar.min.css";

export const navData = [
  { title: "Dashboard",  icon: LayoutDashboard, href: "/dashboard" },
  { title: "Companies",  icon: Building2,        href: "/companies" },
  { title: "Employees",  icon: Users,            href: "/employees" },
  { title: "Attendance", icon: Clock,            href: "/attendance" },
  { title: "Reports",    icon: FileBarChart,     href: "/reports" },
  { title: "Analytics",  icon: BarChart2,        href: "/analytics" },
  { title: "Settings",   icon: Settings,         href: "/settings" },
];

const AppSidebar = ({ children }) => {
  return (
    <SidebarProvider>
      <Sidebar className="px-0">
        <div className="flex flex-col gap-6">
          <SidebarHeader className="py-0 px-4 pt-3">
            <SidebarMenu>
              <SidebarMenuItem>
                <a href="/dashboard" className="flex items-center">
                  <img src="/logo.png" alt="Logo" className="h-10 w-auto" />
                </a>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>

          <SidebarContent className="overflow-hidden gap-0 px-0">
            <SimpleBar autoHide className="h-[calc(100vh-100px)]">
              <div className="px-4">
                <NavMain items={navData} />
              </div>
            </SimpleBar>
          </SidebarContent>
        </div>
      </Sidebar>

      <div className="flex flex-1 flex-col min-w-0">
        <header className="sticky top-0 z-50 flex items-center border-b px-6 py-3 bg-background">
          <SiteHeader />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </SidebarProvider>
  );
};

export default AppSidebar;
