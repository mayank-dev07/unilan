package models

import "time"

type User struct {
	ID           string    `json:"id"`
	Username     string    `json:"username"`
	PasswordHash string    `json:"-"`
	GoogleSub    string    `json:"-"`
	Email        string    `json:"email,omitempty"`
	Name         string    `json:"name,omitempty"`
	Picture      string    `json:"picture,omitempty"`
	Language     string    `json:"language"` // ISO 639-1 (en, ru, zh, hi, ...)
	CreatedAt    time.Time `json:"created_at"`
}

type Conversation struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	CreatedBy string    `json:"created_by"`
	CreatedAt time.Time `json:"created_at"`
}

// Message is the per-viewer payload returned by the API. The sender writes
// once; the server renders a customized version for each viewer:
//   - OriginalText is always the sender's raw input.
//   - DisplayText is that text rendered in the VIEWER's language (translated
//     across languages, untouched if sender_lang == viewer_lang).
//   - UniLanText is the UNI LAN encoding of DisplayText (romanized first if
//     the viewer's language uses a non-Latin script).
type Message struct {
	ID             string    `json:"id"`
	ConversationID string    `json:"conversation_id"`
	SenderID       string    `json:"sender_id"`
	SenderUsername string    `json:"sender_username,omitempty"`
	SenderLang     string    `json:"sender_lang,omitempty"`
	ViewerLang     string    `json:"viewer_lang,omitempty"`
	OriginalText   string    `json:"original_text"`
	DisplayText    string    `json:"display_text"`
	UniLanText     string    `json:"unilan_text"`
	MediaURL       string    `json:"media_url,omitempty"`
	MediaType      string    `json:"media_type,omitempty"` // "image" | "video"
	CreatedAt      time.Time `json:"created_at"`
}
