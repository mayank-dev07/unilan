import { Phone, Search, Video, MoreVertical } from "lucide-react";
import type { Contact } from "../../types";

type Props = { contact: Contact };

export default function ChatHeader({ contact }: Props) {
  return (
    <div className="flex items-center justify-between px-5 py-3 bg-card border-b border-line">
      <div className="flex items-center gap-3 min-w-0">
        <img
          src={contact.avatar}
          alt={contact.name}
          className="w-10 h-10 rounded-full object-cover ring-1 ring-line"
        />
        <div className="min-w-0">
          <div className="font-serif text-[19px] leading-tight text-ink font-medium">
            {contact.name}
          </div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-ink-dim truncate mt-1">
            {contact.lastSeen}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-0.5 text-ink-dim">
        <button className="p-2 rounded-md hover:bg-card-2 hover:text-ink transition" title="Video call">
          <Video size={17} />
        </button>
        <button className="p-2 rounded-md hover:bg-card-2 hover:text-ink transition" title="Voice call">
          <Phone size={17} />
        </button>
        <button className="p-2 rounded-md hover:bg-card-2 hover:text-ink transition" title="Search">
          <Search size={17} />
        </button>
        <button className="p-2 rounded-md hover:bg-card-2 hover:text-ink transition" title="Menu">
          <MoreVertical size={17} />
        </button>
      </div>
    </div>
  );
}
