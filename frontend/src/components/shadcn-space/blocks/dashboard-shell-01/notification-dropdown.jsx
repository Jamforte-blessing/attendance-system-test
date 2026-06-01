"use client";
import { useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { BellRing, Clock, AlertTriangle, LogIn, LogOut } from "lucide-react";
import { dashboard } from "@/api";

const TYPE_CONFIG = {
  late:      { icon: Clock,          color: "text-amber-500",  bg: "bg-amber-500/10" },
  overdue:   { icon: AlertTriangle,  color: "text-orange-500", bg: "bg-orange-500/10" },
  clock_in:  { icon: LogIn,          color: "text-green-500",  bg: "bg-green-500/10" },
  clock_out: { icon: LogOut,         color: "text-blue-500",   bg: "bg-blue-500/10" },
};

const FALLBACK = { icon: BellRing, color: "text-muted-foreground", bg: "bg-muted" };

const NotificationDropdown = ({ defaultOpen, align = "end" }) => {
  const [data, setData] = useState({ count: 0, items: [] });

  useEffect(() => {
    const load = () => dashboard.notifications().then(setData).catch(err => console.error('Notifications error:', err));
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center justify-center">
      <DropdownMenu defaultOpen={defaultOpen}>
        <DropdownMenuTrigger>
          <div className="rounded-full p-2 hover:bg-accent relative cursor-pointer">
            <BellRing className="size-4" />
            {data.count > 0 && (
              <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 bg-red-500 rounded-full flex items-center justify-center text-[9px] text-white font-bold px-0.5">
                {data.count > 9 ? "9+" : data.count}
              </span>
            )}
          </div>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align={align}
          className="p-0 w-sm rounded-2xl data-open:slide-in-from-top-20! data-closed:slide-out-to-top-20 data-open:fade-in-0 data-closed:fade-out-0 data-closed:zoom-out-100 duration-400">

          <DropdownMenuGroup>
            <DropdownMenuLabel className="flex items-center justify-between p-4">
              <p className="text-base font-medium text-popover-foreground">Notifications</p>
              {data.count > 0
                ? <Badge className="font-normal">{data.count} Alert{data.count !== 1 ? "s" : ""}</Badge>
                : <Badge variant="outline" className="font-normal text-muted-foreground">All clear</Badge>
              }
            </DropdownMenuLabel>
          </DropdownMenuGroup>

          <DropdownMenuGroup>
            {data.items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No recent activity
              </div>
            ) : (
              data.items.map(item => {
                const cfg = TYPE_CONFIG[item.type] || FALLBACK;
                const Icon = cfg.icon;
                return (
                  <DropdownMenuItem
                    key={item.id}
                    className="mx-1.5 my-1 p-2 flex items-center justify-between cursor-default">
                    <div className="flex items-center gap-3">
                      <div className={cn("p-2.5 rounded-xl flex-shrink-0", cfg.bg, cfg.color)}>
                        <Icon size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-popover-foreground">{item.title}</p>
                        <p className="max-w-52 truncate text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground ml-3 flex-shrink-0">{item.time}</p>
                  </DropdownMenuItem>
                );
              })
            )}
          </DropdownMenuGroup>

          <div className="mx-1.5 my-1 p-2 border-t mt-1">
            <p className="text-xs text-center text-muted-foreground">Updates every minute</p>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default NotificationDropdown;
