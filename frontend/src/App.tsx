import { useMemo } from "react";
import { Provider as UrqlProvider } from "urql";
import Sidebar from "./components/Sidebar/Sidebar";
import ChatWindow from "./components/ChatWindow/ChatWindow";
import EmptyState from "./components/ChatWindow/EmptyState";
import { ThemeProvider } from "./theme/ThemeContext";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import AuthScreen from "./auth/AuthScreen";
import { useChat } from "./hooks/useChat";
import { useIsDesktop } from "./hooks/useIsDesktop";
import { gqlClient } from "./api/gql";

function ChatApp() {
  const {
    contacts,
    messages,
    allMessages,
    selectedId,
    setSelectedId,
    sendMessage,
    sendTyping,
    typingUsers,
    startConversation,
    error,
    clearError,
  } = useChat();

  const selectedContact = useMemo(
    () => contacts.find((c) => c.id === selectedId) ?? null,
    [contacts, selectedId],
  );

  const isDesktop = useIsDesktop();
  const showSidebar = isDesktop || !selectedContact;
  const showChat = isDesktop || !!selectedContact;

  return (
    <div className="flex h-screen w-screen bg-paper text-ink overflow-hidden relative">
      {showSidebar && (
        <Sidebar
          contacts={contacts}
          messages={allMessages}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onStartChat={async (u) => { await startConversation(u); }}
        />
      )}
      {showChat && (
        selectedContact ? (
          <ChatWindow
            contact={selectedContact}
            messages={messages}
            onSend={sendMessage}
            onTyping={sendTyping}
            typingUsers={typingUsers}
            onBack={isDesktop ? undefined : () => setSelectedId(null)}
          />
        ) : (
          <div className="flex flex-1 min-w-0">
            <EmptyState />
          </div>
        )
      )}
      {error && (
        <div className="absolute bottom-4 right-4 max-w-sm bg-red-500/10 border border-red-500/40 text-red-500 text-[12px] px-4 py-2 rounded-md flex items-center gap-3">
          <span className="flex-1">{error}</span>
          <button onClick={clearError} className="opacity-70 hover:opacity-100">×</button>
        </div>
      )}
    </div>
  );
}

function Gate() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen w-screen bg-paper text-ink-dim flex items-center justify-center text-[11px] uppercase tracking-[0.25em]">
        loading…
      </div>
    );
  }
  return user ? <ChatApp /> : <AuthScreen />;
}

export default function App() {
  return (
    <ThemeProvider>
      <UrqlProvider value={gqlClient}>
        <AuthProvider>
          <Gate />
        </AuthProvider>
      </UrqlProvider>
    </ThemeProvider>
  );
}
