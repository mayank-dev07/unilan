import { useMemo, useState } from "react";
import type { Contact, Message } from "../../types";
import SidebarHeader from "./SidebarHeader";
import SearchBar from "./SearchBar";
import ChatListItem from "./ChatListItem";
import AnimatedList from "../reactbits/AnimatedList";
import NewChatDialog from "./NewChatDialog";

type Props = {
  contacts: Contact[];
  messages: Message[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onStartChat: (username: string) => Promise<void>;
};

export default function Sidebar({ contacts, messages, selectedId, onSelect, onStartChat }: Props) {
  const [query, setQuery] = useState("");
  const [newChatOpen, setNewChatOpen] = useState(false);

  const filtered = useMemo(
    () => contacts.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())),
    [contacts, query],
  );

  const lastMessageFor = (contactId: string) => {
    const thread = messages.filter((m) => m.contactId === contactId);
    return thread[thread.length - 1];
  };

  return (
    <aside className="w-full md:w-[32%] md:min-w-[340px] md:max-w-[420px] flex flex-col bg-paper border-r border-line">
      <SidebarHeader onNewChat={() => setNewChatOpen(true)} />
      <SearchBar value={query} onChange={setQuery} />

      <div className="flex-1 overflow-y-auto thin-scroll">
        <AnimatedList>
          {filtered.map((c) => (
            <ChatListItem
              key={c.id}
              contact={c}
              lastMessage={lastMessageFor(c.id)}
              active={c.id === selectedId}
              onClick={() => onSelect(c.id)}
            />
          ))}
        </AnimatedList>
        {filtered.length === 0 && (
          <button
            onClick={() => setNewChatOpen(true)}
            className="block w-full text-center text-ink-dim hover:text-ink text-[11px] tracking-[0.2em] uppercase py-12 transition"
          >
            no chats — start one
          </button>
        )}
      </div>

      <NewChatDialog
        open={newChatOpen}
        onClose={() => setNewChatOpen(false)}
        onSubmit={onStartChat}
      />
    </aside>
  );
}
