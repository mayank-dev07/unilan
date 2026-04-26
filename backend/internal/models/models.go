package models

import "time"

type User struct {
	ID           string    `json:"id"`
	Username     string    `json:"username"`
	PasswordHash string    `json:"-"`
	CreatedAt    time.Time `json:"created_at"`
}

type Conversation struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	CreatedBy string    `json:"created_by"`
	CreatedAt time.Time `json:"created_at"`
}

type Message struct {
	ID             string    `json:"id"`
	ConversationID string    `json:"conversation_id"`
	SenderID       string    `json:"sender_id"`
	SenderUsername string    `json:"sender_username,omitempty"`
	OriginalText   string    `json:"original_text"`  // what the user typed
	EnglishText    string    `json:"english_text"`   // post-LLM translation
	UniLanText     string    `json:"unilan_text"`    // mapped UNI LAN
	CreatedAt      time.Time `json:"created_at"`
}
