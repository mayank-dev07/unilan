import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSubscription } from "urql";
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
  const idx = (Math.abs(hash(seed)) % 70) + 1;
  return `https://i.pravatar.cc/120?img=${idx}`;
}
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

function toContact(c: BackendConversation): Contact {
  const name = c.title || "chat";
  return { id: c.id, name, avatar: avatarFor(name), lastSeen: "" };
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

// Live conversations subscription via Hasura. Hasura's row-level permission
// (set in hasura/setup.sh) ensures we only get conversations where the
// authenticated user is a member.
const CONVERSATIONS_SUB = /* GraphQL */ `
  subscription Conversations {
    conversations(order_by: { created_at: desc }) {
      id
      title
      created_by
      created_at
    }
  }
`;

type GqlConvRow = {
  id: string;
  title: string;
  created_by: string;
  created_at: string;
};

export function useChat() {
  const { user, token } = useAuth();
  const [messagesByConv, setMessagesByConv] = useState<Record<string, Message[]>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Hasura live subscription — replaces REST polling for the conversation list.
  // pause: true while not authed avoids a useless connect that 401s.
  const [{ data: subData, error: subError }] = useSubscription<{
    conversations: GqlConvRow[];
  }>({ query: CONVERSATIONS_SUB, pause: !user || !token });

  useEffect(() => {
    if (subError) setError(subError.message);
  }, [subError]);

  const contacts: Contact[] = useMemo(
    () => (subData?.conversations ?? []).map((c) => toContact(c)),
    [subData],
  );

  // Auto-select the first conversation once they arrive.
  useEffect(() => {
    if (contacts.length && !selectedId) setSelectedId(contacts[0].id);
  }, [contacts, selectedId]);

  // ---------- messages: still REST + WebSocket (server holds the cipher key) ----------
  const wsRef = useRef<WebSocket | null>(null);

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

  useEffect(() => {
    if (!selectedId || !token || !user) return;

    const ws = new WebSocket(api.wsURL(selectedId, token));
    wsRef.current = ws;

    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type !== "message" || !data.message) return;
        const m: BackendMessage = data.message;
        setMessagesByConv((prev) => {
          const arr = prev[m.conversation_id] ?? [];
          if (arr.some((x) => x.id === m.id)) return prev;
          return { ...prev, [m.conversation_id]: [...arr, toMessage(m, user.id)] };
        });
      } catch {
        /* malformed frame */
      }
    };
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
    // If we already have a 1-1 chat titled with this username, just open it.
    // Avoids spawning a new row on every click in the People tab.
    const existing = contacts.find((c) => c.name === otherUsername);
    if (existing) {
      setSelectedId(existing.id);
      return;
    }
    try {
      const c = await api.createConversation([otherUsername], otherUsername);
      setSelectedId(c.id);
      return c;
    } catch (e) {
      setError(e instanceof Error ? e.message : "create failed");
      throw e;
    }
  }, [contacts]);

  const messages = selectedId ? messagesByConv[selectedId] ?? [] : [];
  const allMessages = Object.values(messagesByConv).flat();

  return {
    contacts,
    messages,
    allMessages,
    selectedId,
    setSelectedId,
    sendMessage,
    startConversation,
    error,
    clearError: () => setError(null),
  };
}
