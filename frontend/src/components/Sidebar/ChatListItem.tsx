import { Check, CheckCheck } from "lucide-react";
import type { Contact, Message } from "../../types";
import UserAvatar from "../UserAvatar";

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
      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition border-b border-line
        ${active ? "bg-card" : "hover:bg-card/60"}`}
    >
      <UserAvatar
        name={contact.name}
        url={contact.avatar}
        size="w-11 h-11"
        textSize="text-[16px]"
        online={contact.online}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="font-serif text-[16px] text-ink truncate font-medium leading-tight">
            {contact.name}
          </span>
          <span className="text-[10px] uppercase tracking-[0.15em] shrink-0 ml-2 text-ink-dim">
            {lastMessage?.time ?? ""}
          </span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[12px] text-ink-dim truncate flex items-center gap-1.5 lowercase tracking-wide">
            {lastMessage?.fromMe && (
              lastMessage.status === "read"
                ? <CheckCheck size={12} className="text-accent shrink-0" />
                : lastMessage.status === "delivered"
                ? <CheckCheck size={12} className="shrink-0" />
                : <Check size={12} className="shrink-0" />
            )}
            {lastMessage?.text ?? "—"}
          </span>
          {contact.unread ? (
            <span className="ml-2 shrink-0 bg-accent text-accent-fg text-[10px] font-semibold rounded-full min-w-[18px] h-[18px] px-1.5 inline-flex items-center justify-center leading-none">
              {contact.unread > 99 ? "99+" : contact.unread}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}
