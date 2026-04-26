import { Phone, Search, Video, MoreVertical } from "lucide-react";
import type { Contact } from "../../types";
import BlurText from "../reactbits/BlurText";

type Props = { contact: Contact };

export default function ChatHeader({ contact }: Props) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 bg-wa-panel-2/70 backdrop-blur-md border-b border-white/10">
      <div className="flex items-center gap-3 min-w-0">
        <img
          src={contact.avatar}
          alt={contact.name}
          className="w-10 h-10 rounded-full object-cover ring-1 ring-white/10"
        />
        <div className="min-w-0">
          <div className="text-wa-text font-medium leading-tight">
            <BlurText key={contact.id} text={contact.name} />
          </div>
          <div className="text-xs text-wa-text-dim truncate">{contact.lastSeen}</div>
        </div>
      </div>
      <div className="flex items-center gap-1 text-wa-text-dim">
        <button className="p-2 rounded-full hover:bg-white/10 transition" title="Video call">
          <Video size={20} />
        </button>
        <button className="p-2 rounded-full hover:bg-white/10 transition" title="Voice call">
          <Phone size={20} />
        </button>
        <button className="p-2 rounded-full hover:bg-white/10 transition" title="Search">
          <Search size={20} />
        </button>
        <button className="p-2 rounded-full hover:bg-white/10 transition" title="Menu">
          <MoreVertical size={20} />
        </button>
      </div>
    </div>
  );
}
