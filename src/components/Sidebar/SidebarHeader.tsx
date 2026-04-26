import { MessageSquarePlus, MoreVertical, Users, CircleDashed } from "lucide-react";

export default function SidebarHeader() {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-wa-panel-2">
      <img
        src="https://i.pravatar.cc/120?img=8"
        alt="me"
        className="w-10 h-10 rounded-full object-cover"
      />
      <div className="flex items-center gap-1 text-wa-text-dim">
        <button className="p-2 rounded-full hover:bg-white/5 transition" title="Communities">
          <Users size={20} />
        </button>
        <button className="p-2 rounded-full hover:bg-white/5 transition" title="Status">
          <CircleDashed size={20} />
        </button>
        <button className="p-2 rounded-full hover:bg-white/5 transition" title="New chat">
          <MessageSquarePlus size={20} />
        </button>
        <button className="p-2 rounded-full hover:bg-white/5 transition" title="Menu">
          <MoreVertical size={20} />
        </button>
      </div>
    </div>
  );
}
