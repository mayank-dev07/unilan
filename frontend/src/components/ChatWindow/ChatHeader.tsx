import { ArrowLeft, Phone, Search, Video, MoreVertical } from "lucide-react";
import type { Contact } from "../../types";
import UserAvatar from "../UserAvatar";

type Props = {
  contact: Contact;
  onBack?: () => void;
};

export default function ChatHeader({ contact, onBack }: Props) {
  return (
    <div className="flex items-center justify-between px-5 h-16 bg-card border-b border-line">
      <div className="flex items-center gap-3 min-w-0">
        <UserAvatar
          name={contact.name}
          url={contact.avatar}
          size="w-10 h-10"
          textSize="text-[15px]"
        />
        <div className="min-w-0">
          <div className="font-serif text-[19px] leading-tight text-ink font-medium truncate">
            {contact.name}
          </div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-ink-dim truncate mt-1">
            {contact.lastSeen}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-0.5 text-ink-dim">
        <button className="hidden sm:inline-flex p-2 rounded-md hover:bg-card-2 hover:text-ink transition" title="Video call">
          <Video size={17} />
        </button>
        <button className="hidden sm:inline-flex p-2 rounded-md hover:bg-card-2 hover:text-ink transition" title="Voice call">
          <Phone size={17} />
        </button>
        <button className="hidden sm:inline-flex p-2 rounded-md hover:bg-card-2 hover:text-ink transition" title="Search">
          <Search size={17} />
        </button>
        <button className="p-2 rounded-md hover:bg-card-2 hover:text-ink transition" title="Menu">
          <MoreVertical size={17} />
        </button>
      </div>
    </div>
  );
}
