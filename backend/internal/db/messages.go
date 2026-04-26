package db

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
)

// EncryptedMessage holds what's stored in the messages table. Only OriginalCT
// is strictly load-bearing for per-viewer rendering; the other ciphertexts
// are the sender's own snapshot and are kept for legacy / debugging.
type EncryptedMessage struct {
	ID             string
	ConversationID string
	SenderID       string
	SenderLang     string
	OriginalCT     string
	DisplayCT      string // sender's-view display ciphertext (legacy: english_ct column)
	UniLanCT       string // sender's-view UNI LAN ciphertext
	MediaURL       string
	MediaType      string
	CreatedAt      time.Time
}

func (d *DB) InsertMessage(conversationID, senderID, senderLang,
	originalCT, displayCT, unilanCT, mediaURL, mediaType string,
) (*EncryptedMessage, error) {
	if senderLang == "" {
		senderLang = "en"
	}
	id := uuid.NewString()
	_, err := d.Exec(`
		INSERT INTO messages
		    (id, conversation_id, sender_id, sender_lang,
		     original_ct, english_ct, unilan_ct, media_url, media_type)
		VALUES ($1, $2, $3, $4, $5, $6, $7, NULLIF($8, ''), NULLIF($9, ''))`,
		id, conversationID, senderID, senderLang,
		originalCT, displayCT, unilanCT, mediaURL, mediaType)
	if err != nil {
		return nil, err
	}
	return d.GetMessage(id)
}

const msgCols = `id, conversation_id, sender_id, COALESCE(sender_lang, 'en'),
                 original_ct, english_ct, unilan_ct,
                 COALESCE(media_url, ''), COALESCE(media_type, ''), created_at`

func (d *DB) GetMessage(id string) (*EncryptedMessage, error) {
	row := d.QueryRow(`SELECT `+msgCols+` FROM messages WHERE id = $1`, id)
	var m EncryptedMessage
	if err := row.Scan(&m.ID, &m.ConversationID, &m.SenderID, &m.SenderLang,
		&m.OriginalCT, &m.DisplayCT, &m.UniLanCT,
		&m.MediaURL, &m.MediaType, &m.CreatedAt); err != nil {
		return nil, err
	}
	return &m, nil
}

// ListMessages returns up to `limit` most-recent messages oldest-first along
// with each sender's username.
func (d *DB) ListMessages(conversationID string, limit int) ([]EncryptedMessage, []string, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	rows, err := d.Query(`
		SELECT m.id, m.conversation_id, m.sender_id, COALESCE(m.sender_lang, 'en'),
		       m.original_ct, m.english_ct, m.unilan_ct,
		       COALESCE(m.media_url, ''), COALESCE(m.media_type, ''), m.created_at, u.username
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
		if err := rows.Scan(&m.ID, &m.ConversationID, &m.SenderID, &m.SenderLang,
			&m.OriginalCT, &m.DisplayCT, &m.UniLanCT,
			&m.MediaURL, &m.MediaType, &m.CreatedAt, &sender); err != nil {
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

var _ sql.Result
