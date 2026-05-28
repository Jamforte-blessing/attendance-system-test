import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Settings, LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";

const itemClass = "p-2 text-sm font-medium text-popover-foreground cursor-pointer gap-2";

const UserDropdown = ({ trigger, defaultOpen, align = "end" }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex items-center justify-center">
      <DropdownMenu defaultOpen={defaultOpen}>
        <DropdownMenuTrigger>{trigger}</DropdownMenuTrigger>
        <DropdownMenuContent align={align} className="w-48 rounded-xl">
          <DropdownMenuItem className={itemClass}>
            <Settings size={16} />
            <span>Settings</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" className={itemClass} onClick={handleLogout}>
            <LogOut size={16} />
            <span>Sign Out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default UserDropdown;
