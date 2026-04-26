import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSubscription } from "urql";
import { api } from "../api/client";
import type { BackendMessage } from "../api/types";
import type { Contact, Message } from "../types";
import { useAuth } from "../auth/AuthContext";

const READ_STORAGE_KEY = "unilan_last_viewed_v1";

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
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

// Conversations subscription now also pulls the last 50 messages metadata
// (id, sender, timestamp — NO ciphertext) so the sidebar can compute unread
// counts without polling. 50 is far more than the typical unread backlog.
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
          picture
        }
      }
      messages(order_by: { created_at: desc }, limit: 50) {
        id
        sender_id
        created_at
      }
    }
  }
`;

type GqlMessageMeta = { id: string; sender_id: string; created_at: string };

type GqlConvRow = {
  id: string;
  title: string;
  created_by: string;
  created_at: string;
  members: {
    user_id: string;
    user: { id: string; username: string; picture: string | null } | null;
  }[];
  messages: GqlMessageMeta[];
};

function otherMembersOf(c: GqlConvRow, myUserId: string) {
  return c.members
    .filter((m) => m.user_id !== myUserId && m.user)
    .map((m) => m.user!);
}

function readLastViewed(): Record<string, string> {
  try {
    const raw = localStorage.getItem(READ_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
function writeLastViewed(m: Record<string, string>) {
  try {
    localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(m));
  } catch {
    // quota / private mode — silently ignore
  }
}

export function useChat() {
  const { user, token } = useAuth();
  const [messagesByConv, setMessagesByConv] = useState<Record<string, Message[]>>({});
  const [selectedId, setSelectedIdState] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Typing state: which usernames are currently typing in which conversation.
  const [typingByConv, setTypingByConv] = useState<Record<string, Set<string>>>({});

  // Unread tracking: ISO timestamp of last time *I* viewed each conversation.
  // Persisted to localStorage so refresh keeps badge state.
  const [lastViewed, setLastViewed] = useState<Record<string, string>>(() => readLastViewed());

  const [{ data: subData, error: subError }] = useSubscription<{
    conversations: GqlConvRow[];
  }>({ query: CONVERSATIONS_SUB, pause: !user || !token });

  useEffect(() => {
    if (subError) setError(subError.message);
  }, [subError]);

  const conversations = useMemo(() => subData?.conversations ?? [], [subData]);

  // Unread count per conversation: messages received from someone else, after
  // I last viewed this chat. Conversations I've never opened start at 0
  // viewed → every message from others counts.
  const unreadByConv = useMemo<Record<string, number>>(() => {
    if (!user) return {};
    const out: Record<string, number> = {};
    for (const c of conversations) {
      const since = lastViewed[c.id] ?? "1970-01-01T00:00:00Z";
      let n = 0;
      for (const m of c.messages) {
        if (m.sender_id !== user.id && m.created_at > since) n++;
      }
      if (n) out[c.id] = n;
    }
    return out;
  }, [conversations, lastViewed, user]);

  const contacts: Contact[] = useMemo(() => {
    if (!user) return [];
    return conversations.map((c) => {
      const others = otherMembersOf(c, user.id);
      const name =
        others.length === 1
          ? others[0].username
          : others.length > 1
          ? others.map((o) => o.username).join(", ")
          : c.title || "chat";
      // For 1-1 chats use the other person's avatar; for groups, no single
      // avatar makes sense → fall back to the letter chip rendered by UserAvatar.
      const avatar = others.length === 1 ? others[0].picture : null;
      return {
        id: c.id,
        name,
        avatar,
        lastSeen: "",
        unread: unreadByConv[c.id],
      };
    });
  }, [conversations, user, unreadByConv]);

  // Marking a chat as read: bump lastViewed[selected] to now.
  const markRead = useCallback((convID: string) => {
    setLastViewed((prev) => {
      const next = { ...prev, [convID]: new Date().toISOString() };
      writeLastViewed(next);
      return next;
    });
  }, []);

  const setSelectedId = useCallback((id: string | null) => {
    setSelectedIdState(id);
    if (id) markRead(id);
  }, [markRead]);


  // Mark read whenever a new message arrives in the currently-open chat.
  useEffect(() => {
    if (!selectedId || !user) return;
    const conv = conversations.find((c) => c.id === selectedId);
    if (!conv) return;
    const newest = conv.messages[0];
    if (newest && newest.sender_id !== user.id) markRead(selectedId);
  }, [conversations, selectedId, user, markRead]);

  // ---------- messages: REST history + WebSocket live ----------
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
      let data: any;
      try {
        data = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (data.type === "message" && data.message) {
        const m: BackendMessage = data.message;
        setMessagesByConv((prev) => {
          const arr = prev[m.conversation_id] ?? [];
          if (arr.some((x) => x.id === m.id)) return prev;
          return { ...prev, [m.conversation_id]: [...arr, toMessage(m, user.id)] };
        });
      } else if (data.type === "typing") {
        // Other user started/stopped typing in this conversation.
        const { conversation_id, username, typing } = data;
        if (!conversation_id || !username) return;
        setTypingByConv((prev) => {
          const set = new Set(prev[conversation_id] ?? []);
          if (typing) set.add(username);
          else set.delete(username);
          return { ...prev, [conversation_id]: set };
        });
        // Auto-clear after 6s in case the "stop" frame is dropped.
        if (typing) {
          window.setTimeout(() => {
            setTypingByConv((prev) => {
              const set = new Set(prev[conversation_id] ?? []);
              set.delete(username);
              return { ...prev, [conversation_id]: set };
            });
          }, 6000);
        }
      }
    };
    ws.onclose = () => {
      if (wsRef.current === ws) wsRef.current = null;
    };

    return () => {
      ws.close();
      if (wsRef.current === ws) wsRef.current = null;
      // Clear typing indicators for the conversation we're leaving so they
      // don't ghost-stay when we come back.
      setTypingByConv((prev) => {
        const next = { ...prev };
        delete next[selectedId];
        return next;
      });
    };
  }, [selectedId, token, user]);

  // sendTyping is called by MessageInput on keystroke.
  const sendTyping = useCallback((typing: boolean) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    try {
      ws.send(JSON.stringify({ type: "typing", typing }));
    } catch {
      /* socket closing — ignore */
    }
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!selectedId || !user) return;
    try {
      const m = await api.sendMessage(selectedId, text);
      setMessagesByConv((prev) => {
        const arr = prev[m.conversation_id] ?? [];
        if (arr.some((x) => x.id === m.id)) return prev;
        return { ...prev, [m.conversation_id]: [...arr, toMessage(m, user.id)] };
      });
      // Sending counts as "I'm here" — bump lastViewed.
      markRead(m.conversation_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "send failed");
    }
  }, [selectedId, user, markRead]);

  const startConversation = useCallback(async (otherUsername: string) => {
    setError(null);
    if (!user) return;

    const existing = conversations.find((c) => {
      const others = otherMembersOf(c, user.id);
      return others.length === 1 && others[0].username === otherUsername;
    });
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
  }, [user, conversations, setSelectedId]);

  const messages = selectedId ? messagesByConv[selectedId] ?? [] : [];
  const allMessages = Object.values(messagesByConv).flat();

  // Typing usernames for the currently selected conversation, excluding self
  // (defense-in-depth — backend already excludes the typist).
  const typingUsers = useMemo(() => {
    if (!selectedId) return [];
    const set = typingByConv[selectedId];
    if (!set) return [];
    return Array.from(set).filter((u) => u !== user?.username);
  }, [typingByConv, selectedId, user]);

  return {
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
    clearError: () => setError(null),
  };
}
