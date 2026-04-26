import { useMemo, useState } from "react";
import type { Contact, Message } from "../../types";
import SidebarHeader from "./SidebarHeader";
import SearchBar from "./SearchBar";
import ChatListItem from "./ChatListItem";
import AnimatedList from "../reactbits/AnimatedList";
import PeopleList from "./PeopleList";

type Tab = "chats" | "people";

type Props = {
  contacts: Contact[];
  messages: Message[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onStartChat: (username: string) => Promise<void>;
};

export default function Sidebar({ contacts, messages, selectedId, onSelect, onStartChat }: Props) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("chats");

  const filtered = useMemo(
    () => contacts.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())),
    [contacts, query],
  );

  const lastMessageFor = (contactId: string) => {
    const thread = messages.filter((m) => m.contactId === contactId);
    return thread[thread.length - 1];
  };

  // After picking someone from the People tab, jump back to Chats so they see
  // the new conversation immediately.
  const startChatAndSwitch = async (username: string) => {
    await onStartChat(username);
    setTab("chats");
  };

  return (
    <aside
      className="w-full lg:w-[32%] lg:min-w-[340px] lg:max-w-[420px] flex flex-col bg-paper border-r border-line shrink-0"
    >
      <SidebarHeader />

      <div className="flex border-b border-line bg-card">
        {(["chats", "people"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-[11px] uppercase tracking-[0.25em] transition relative ${
              tab === t ? "text-ink" : "text-ink-dim hover:text-ink"
            }`}
          >
            {t}
            {tab === t && (
              <span className="absolute bottom-0 left-1/4 right-1/4 h-px bg-accent" />
            )}
          </button>
        ))}
      </div>

      {tab === "chats" && <SearchBar value={query} onChange={setQuery} />}

      <div className="flex-1 overflow-y-auto thin-scroll">
        {tab === "chats" ? (
          <>
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
                onClick={() => setTab("people")}
                className="block w-full text-center text-ink-dim hover:text-ink text-[11px] tracking-[0.2em] uppercase py-12 transition"
              >
                no chats — browse people
              </button>
            )}
          </>
        ) : (
          <PeopleList onStartChat={startChatAndSwitch} />
        )}
      </div>
    </aside>
  );
}
