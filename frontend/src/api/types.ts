// Mirrors the Go models in backend/internal/models.

export type BackendUser = {
  id: string;
  username: string;
  picture?: string | null;
  name?: string | null;
  email?: string | null;
  created_at: string;
};

export type BackendConversation = {
  id: string;
  title: string;
  created_by: string;
  created_at: string;
};

export type BackendMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_username?: string;
  original_text: string;
  english_text: string;
  unilan_text: string;
  media_url?: string;
  media_type?: "image" | "video" | "";
  created_at: string;
};

export type AuthResponse = {
  user: BackendUser;
  token: string;
};

export type TranslateResponse = {
  original: string;
  english: string;
  unilan: string;
  detected_lang: string;
  confidence: number;
  provider_used: string;
  needed_translate: boolean;
  latency_ms: number;
};
