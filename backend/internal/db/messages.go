package db

import (
	"time"

	"github.com/google/uuid"
)

// EncryptedMessage holds the three ciphertexts written to the messages table.
type EncryptedMessage struct {
	ID             string
	ConversationID string
	SenderID       string
	OriginalCT     string
	EnglishCT      string
	UniLanCT       string
	CreatedAt      time.Time
}

func (d *DB) InsertMessage(conversationID, senderID, originalCT, englishCT, unilanCT string) (*EncryptedMessage, error) {
	id := uuid.NewString()
	_, err := d.Exec(`
		INSERT INTO messages (id, conversation_id, sender_id, original_ct, english_ct, unilan_ct)
		VALUES ($1, $2, $3, $4, $5, $6)`,
		id, conversationID, senderID, originalCT, englishCT, unilanCT)
	if err != nil {
		return nil, err
	}
	return d.GetMessage(id)
}

func (d *DB) GetMessage(id string) (*EncryptedMessage, error) {
	row := d.QueryRow(`
		SELECT id, conversation_id, sender_id, original_ct, english_ct, unilan_ct, created_at
		FROM messages WHERE id = $1`, id)
	var m EncryptedMessage
	if err := row.Scan(&m.ID, &m.ConversationID, &m.SenderID, &m.OriginalCT, &m.EnglishCT, &m.UniLanCT, &m.CreatedAt); err != nil {
		return nil, err
	}
	return &m, nil
}

// ListMessages returns up to `limit` most-recent messages oldest-first.
func (d *DB) ListMessages(conversationID string, limit int) ([]EncryptedMessage, []string, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	rows, err := d.Query(`
		SELECT m.id, m.conversation_id, m.sender_id, m.original_ct, m.english_ct, m.unilan_ct, m.created_at, u.username
		FROM messages m
		JOIN users u ON u.id = m.sender_id
		WHERE m.conversation_id = $1
		ORDER BY m.created_at DESC
		LIMIT $2`, conversationID, limit)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()
	var msgs []EncryptedMessage
	var senders []string
	for rows.Next() {
		var m EncryptedMessage
		var sender string
		if err := rows.Scan(&m.ID, &m.ConversationID, &m.SenderID, &m.OriginalCT, &m.EnglishCT, &m.UniLanCT, &m.CreatedAt, &sender); err != nil {
			return nil, nil, err
		}
		msgs = append(msgs, m)
		senders = append(senders, sender)
	}
	for i, j := 0, len(msgs)-1; i < j; i, j = i+1, j-1 {
		msgs[i], msgs[j] = msgs[j], msgs[i]
		senders[i], senders[j] = senders[j], senders[i]
	}
	return msgs, senders, rows.Err()
}
