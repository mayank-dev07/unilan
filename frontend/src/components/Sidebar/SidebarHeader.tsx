import { MessageSquarePlus, MoreVertical, Sun, Moon } from "lucide-react";
import { useTheme } from "../../theme/ThemeContext";

export default function SidebarHeader() {
  const { theme, toggle } = useTheme();
  return (
    <div className="flex items-center justify-between px-5 py-4 bg-card border-b border-line">
      <div className="flex items-center gap-3 min-w-0">
        <img
          src="https://i.pravatar.cc/120?img=8"
          alt="me"
          className="w-9 h-9 rounded-full object-cover ring-1 ring-line"
        />
        <span className="text-[10px] tracking-[0.25em] uppercase text-ink-dim">unilan</span>
      </div>
      <div className="flex items-center gap-0.5 text-ink-dim">
        <button
          onClick={toggle}
          className="p-2 rounded-md hover:bg-card-2 hover:text-ink transition"
          title={theme === "light" ? "Switch to dark" : "Switch to light"}
        >
          {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
        </button>
        <button className="p-2 rounded-md hover:bg-card-2 hover:text-ink transition" title="New chat">
          <MessageSquarePlus size={17} />
        </button>
        <button className="p-2 rounded-md hover:bg-card-2 hover:text-ink transition" title="Menu">
          <MoreVertical size={17} />
        </button>
      </div>
    </div>
  );
}
