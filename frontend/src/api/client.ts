import type {
  AuthResponse,
  BackendConversation,
  BackendMessage,
  BackendUser,
  TranslateResponse,
} from "./types";

const BASE = (import.meta.env.VITE_API_URL ?? "http://localhost:8080").replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let currentToken: string | null = null;

export function setToken(token: string | null) {
  currentToken = token;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init.headers as Record<string, string>) ?? {}),
  };
  if (currentToken) headers["Authorization"] = `Bearer ${currentToken}`;
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    if (data && typeof data === "object" && "error" in data) {
      const e = (data as { error: unknown }).error;
      if (typeof e === "string" && e) msg = e;
    }
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

export const api = {
  base: BASE,

  signup: (username: string, password: string) =>
    request<AuthResponse>("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  login: (username: string, password: string) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  googleAuth: (credential: string) =>
    request<AuthResponse>("/auth/google", {
      method: "POST",
      body: JSON.stringify({ credential }),
    }),

  me: () => request<BackendUser>("/me"),

  translatePreview: (text: string) =>
    request<TranslateResponse>("/translate", {
      method: "POST",
      body: JSON.stringify({ text }),
    }),

  listConversations: () => request<BackendConversation[]>("/conversations"),

  createConversation: (memberUsernames: string[], title = "") =>
    request<BackendConversation>("/conversations", {
      method: "POST",
      body: JSON.stringify({ title, member_usernames: memberUsernames }),
    }),

  listMessages: (conversationId: string) =>
    request<BackendMessage[] | null>(`/conversations/${conversationId}/messages`).then(
      (m) => m ?? [],
    ),

  sendMessage: (conversationId: string, text: string) =>
    request<BackendMessage>(`/conversations/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }),

  wsURL: (conversationId: string, token: string) => {
    const u = new URL(BASE);
    u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
    u.pathname = "/ws";
    u.searchParams.set("token", token);
    u.searchParams.set("conversation_id", conversationId);
    return u.toString();
  },
};
