import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSubscription } from "urql";
import { api } from "../api/client";
import type { BackendMessage } from "../api/types";
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

// Now includes members so we can pick the OTHER member's username as the
// display name. Title is no longer trusted — it's one-sided and misleading
// (it's whatever the creator typed at creation time).
const CONVERSATIONS_SUB = /* GraphQL */ `
  subscription Conversations {
    conversations(order_by: { created_at: desc }) {
      id
      title
      created_by
      created_at
      members {
        user_id
        user {
          id
          username
        }
      }
    }
  }
`;

type GqlConvRow = {
  id: string;
  title: string;
  created_by: string;
  created_at: string;
  members: { user_id: string; user: { id: string; username: string } | null }[];
};

function toContact(c: GqlConvRow, myUserId: string): Contact {
  // Pick the OTHER member as the display name. For self-chats or group chats
  // we fall back to the title. Anonymizes nicely if user record disappears.
  const others = c.members
    .filter((m) => m.user_id !== myUserId && m.user)
    .map((m) => m.user!.username);

  const name = others.length === 1 ? others[0] : others.length > 1 ? others.join(", ") : c.title || "chat";
  return {
    id: c.id,
    name,
    avatar: avatarFor(name),
    lastSeen: "",
  };
}

export function useChat() {
  const { user, token } = useAuth();
  const [messagesByConv, setMessagesByConv] = useState<Record<string, Message[]>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [{ data: subData, error: subError }] = useSubscription<{
    conversations: GqlConvRow[];
  }>({ query: CONVERSATIONS_SUB, pause: !user || !token });

  useEffect(() => {
    if (subError) setError(subError.message);
  }, [subError]);

  const conversations = useMemo(() => subData?.conversations ?? [], [subData]);

  const contacts: Contact[] = useMemo(
    () => (user ? conversations.map((c) => toContact(c, user.id)) : []),
    [conversations, user],
  );

  // Auto-select the first conversation once they arrive.
  useEffect(() => {
    if (contacts.length && !selectedId) setSelectedId(contacts[0].id);
  }, [contacts, selectedId]);

  // ---------- messages: REST + WebSocket (server holds the cipher key) ----------
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
    if (!user) return;

    // Client-side dedupe: if any existing conversation is a 1-1 with this
    // username as the other member, just open it. The backend now also
    // dedupes server-side as the source of truth — this is the fast path.
    const existing = conversations.find((c) => {
      const otherMembers = c.members.filter((m) => m.user_id !== user.id);
      return otherMembers.length === 1 && otherMembers[0].user?.username === otherUsername;
    });
    if (existing) {
      setSelectedId(existing.id);
      return;
    }
    try {
      // Title is still sent for back-compat / group-chat fallback, but the UI
      // ignores it for 1-1 chats and uses the other member's username instead.
      const c = await api.createConversation([otherUsername], otherUsername);
      setSelectedId(c.id);
      return c;
    } catch (e) {
      setError(e instanceof Error ? e.message : "create failed");
      throw e;
    }
  }, [user, conversations]);

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
