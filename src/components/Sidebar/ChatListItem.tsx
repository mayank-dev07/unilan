import { Check, CheckCheck } from "lucide-react";
import type { Contact, Message } from "../../types";

type Props = {
  contact: Contact;
  lastMessage?: Message;
  active: boolean;
  onClick: () => void;
};

export default function ChatListItem({ contact, lastMessage, active, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-3 text-left transition border-b border-white/5
        ${active ? "bg-wa-panel-3" : "hover:bg-white/5"}`}
    >
      <div className="relative shrink-0">
        <img
          src={contact.avatar}
          alt={contact.name}
          className="w-12 h-12 rounded-full object-cover"
        />
        {contact.online && (
          <span className="absolute bottom-0 right-0 w-3 h-3 bg-wa-accent rounded-full ring-2 ring-wa-panel" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-wa-text text-[15px] font-medium truncate">{contact.name}</span>
          <span className={`text-xs shrink-0 ml-2 ${contact.unread ? "text-wa-accent" : "text-wa-text-dim"}`}>
            {lastMessage?.time ?? ""}
          </span>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-sm text-wa-text-dim truncate flex items-center gap-1">
            {lastMessage?.fromMe && (
              lastMessage.status === "read"
                ? <CheckCheck size={14} className="text-white shrink-0" />
                : lastMessage.status === "delivered"
                ? <CheckCheck size={14} className="shrink-0" />
                : <Check size={14} className="shrink-0" />
            )}
            {lastMessage?.text ?? "Tap to start chatting"}
          </span>
          {contact.unread ? (
            <span className="ml-2 shrink-0 bg-white text-black text-[11px] font-semibold rounded-full px-2 py-0.5 min-w-[20px] text-center">
              {contact.unread}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}
