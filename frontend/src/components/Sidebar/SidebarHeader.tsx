import { MoreVertical, Sun, Moon, LogOut } from "lucide-react";
import { useTheme } from "../../theme/ThemeContext";
import { useAuth } from "../../auth/AuthContext";
import UserAvatar from "../UserAvatar";

export default function SidebarHeader() {
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuth();

  return (
    <div className="flex items-center justify-between px-5 h-16 bg-card border-b border-line">
      <div className="flex items-center gap-3 min-w-0">
        <UserAvatar
          name={user?.username ?? "?"}
          url={user?.picture}
          size="w-9 h-9"
          textSize="text-[15px]"
        />
        <div className="flex flex-col min-w-0">
          <span className="text-[13px] text-ink truncate font-medium leading-tight">
            {user?.username ?? "—"}
          </span>
          <span className="text-[9px] tracking-[0.25em] uppercase text-ink-dim leading-tight">
            unilan
          </span>
        </div>
      </div>
      <div className="flex items-center gap-0.5 text-ink-dim">
        <button
          onClick={toggle}
          className="p-2 rounded-md hover:bg-card-2 hover:text-ink transition"
          title={theme === "light" ? "Switch to dark" : "Switch to light"}
        >
          {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
        </button>
        <button
          onClick={logout}
          className="p-2 rounded-md hover:bg-card-2 hover:text-ink transition"
          title="Log out"
        >
          <LogOut size={17} />
        </button>
        <button className="p-2 rounded-md hover:bg-card-2 hover:text-ink transition" title="Menu">
          <MoreVertical size={17} />
        </button>
      </div>
    </div>
  );
}
