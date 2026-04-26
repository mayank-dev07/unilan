import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { BackendConversation, BackendMessage } from "../api/types";
import type { Contact, Message } from "../types";
import { useAuth } from "../auth/AuthContext";

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function avatarFor(seed: string): string {
  // Deterministic placeholder avatar from username/title.
  const idx = Math.abs(hash(seed)) % 70 + 1;
  return `https://i.pravatar.cc/120?img=${idx}`;
}
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

function toContact(c: BackendConversation): Contact {
  const name = c.title || "chat";
  return {
    id: c.id,
    name,
    avatar: avatarFor(name),
    lastSeen: "",
  };
}

function toMessage(m: BackendMessage, myUserId: string): Message {
  return {
    id: m.id,
    contactId: m.conversation_id,
    text: m.unilan_text,
    time: fmtTime(m.created_at),
    fromMe: m.sender_id === myUserId,
    status: "delivered",
    unilan: m.unilan_text,
    english: m.english_text,
    original: m.original_text,
    senderUsername: m.sender_username,
  };
}

export function useChat() {
  const { user, token } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [messagesByConv, setMessagesByConv] = useState<Record<string, Message[]>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  // Load conversations on mount.
  const refreshConversations = useCallback(async () => {
    if (!user) return;
    try {
      const list = await api.listConversations();
      const cs = (list ?? []).map(toContact);
      setContacts(cs);
      if (cs.length && !selectedId) setSelectedId(cs[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "load failed");
    }
  }, [user, selectedId]);

  useEffect(() => {
    refreshConversations();
  }, [refreshConversations]);

  // Load message history when a conversation is selected (only if not loaded yet).
  useEffect(() => {
    if (!selectedId || !user) return;
    if (messagesByConv[selectedId]) return;
    api.listMessages(selectedId)
      .then((rows) => {
        setMessagesByConv((prev) => ({
          ...prev,
          [selectedId]: rows.map((r) => toMessage(r, user.id)),
        }));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "load failed"));
  }, [selectedId, user, messagesByConv]);

  // WebSocket: open/swap when selectedId changes.
  useEffect(() => {
    if (!selectedId || !token || !user) return;

    const ws = new WebSocket(api.wsURL(selectedId, token));
    wsRef.current = ws;

    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type !== "message" || !data.message) return;
        const m: BackendMessage = data.message;
        // dedupe: if we just POSTed it, the optimistic insert already added it.
        setMessagesByConv((prev) => {
          const arr = prev[m.conversation_id] ?? [];
          if (arr.some((x) => x.id === m.id)) return prev;
          return { ...prev, [m.conversation_id]: [...arr, toMessage(m, user.id)] };
        });
      } catch {
        // ignore malformed frames
      }
    };
    ws.onerror = () => {/* handled by close */};
    ws.onclose = () => {
      if (wsRef.current === ws) wsRef.current = null;
    };

    return () => {
      ws.close();
      if (wsRef.current === ws) wsRef.current = null;
    };
  }, [selectedId, token, user]);

  const sendMessage = useCallback(async (text: string) => {
    if (!selectedId || !user) return;
    try {
      const m = await api.sendMessage(selectedId, text);
      setMessagesByConv((prev) => {
        const arr = prev[m.conversation_id] ?? [];
        if (arr.some((x) => x.id === m.id)) return prev;
        return { ...prev, [m.conversation_id]: [...arr, toMessage(m, user.id)] };
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "send failed");
    }
  }, [selectedId, user]);

  const startConversation = useCallback(async (otherUsername: string) => {
    setError(null);
    try {
      const c = await api.createConversation([otherUsername], otherUsername);
      const ui = toContact(c);
      setContacts((prev) => (prev.some((x) => x.id === ui.id) ? prev : [ui, ...prev]));
      setSelectedId(c.id);
      return c;
    } catch (e) {
      setError(e instanceof Error ? e.message : "create failed");
      throw e;
    }
  }, []);

  const messages = selectedId ? (messagesByConv[selectedId] ?? []) : [];
  const allMessages = Object.values(messagesByConv).flat();

  return {
    contacts,
    messages,
    allMessages,
    selectedId,
    setSelectedId,
    sendMessage,
    startConversation,
    refreshConversations,
    error,
    clearError: () => setError(null),
  };
}
