import { useMemo, useState } from "react";
import Sidebar from "./components/Sidebar/Sidebar";
import ChatWindow from "./components/ChatWindow/ChatWindow";
import { contacts, messages as seedMessages } from "./data/contacts";
import type { Message } from "./types";
import { ThemeProvider } from "./theme/ThemeContext";

export default function App() {
  const [selectedId, setSelectedId] = useState<string>(contacts[0].id);
  const [messages, setMessages] = useState<Message[]>(seedMessages);

  const selectedContact = useMemo(
    () => contacts.find((c) => c.id === selectedId)!,
    [selectedId],
  );

  const threadMessages = useMemo(
    () => messages.filter((m) => m.contactId === selectedId),
    [messages, selectedId],
  );

  const handleSend = (text: string) => {
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    setMessages((prev) => [
      ...prev,
      {
        id: `m-${Date.now()}`,
        contactId: selectedId,
        text,
        time,
        fromMe: true,
        status: "sent",
      },
    ]);
  };

  return (
    <ThemeProvider>
      <div className="flex h-screen w-screen bg-paper text-ink overflow-hidden">
        <Sidebar
          contacts={contacts}
          messages={messages}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <ChatWindow
          contact={selectedContact}
          messages={threadMessages}
          onSend={handleSend}
        />
      </div>
    </ThemeProvider>
  );
}
