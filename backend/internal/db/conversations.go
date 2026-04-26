package db

import (
	"database/sql"
	"errors"

	"github.com/google/uuid"
	"github.com/unilan/unilanbackend/internal/models"
)

func (d *DB) CreateConversation(title, createdBy string, memberIDs []string) (*models.Conversation, error) {
	id := uuid.NewString()
	tx, err := d.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`INSERT INTO conversations (id, title, created_by) VALUES ($1, $2, $3)`, id, title, createdBy); err != nil {
		return nil, err
	}
	seen := map[string]bool{createdBy: true}
	if _, err := tx.Exec(`INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2)`, id, createdBy); err != nil {
		return nil, err
	}
	for _, uid := range memberIDs {
		if seen[uid] {
			continue
		}
		seen[uid] = true
		if _, err := tx.Exec(`INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2)`, id, uid); err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return d.GetConversation(id)
}

func (d *DB) GetConversation(id string) (*models.Conversation, error) {
	row := d.QueryRow(`SELECT id, title, created_by, created_at FROM conversations WHERE id = $1`, id)
	var c models.Conversation
	err := row.Scan(&c.ID, &c.Title, &c.CreatedBy, &c.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (d *DB) ListConversationsForUser(userID string) ([]models.Conversation, error) {
	rows, err := d.Query(`
		SELECT c.id, c.title, c.created_by, c.created_at
		FROM conversations c
		JOIN conversation_members m ON m.conversation_id = c.id
		WHERE m.user_id = $1
		ORDER BY c.created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.Conversation
	for rows.Next() {
		var c models.Conversation
		if err := rows.Scan(&c.ID, &c.Title, &c.CreatedBy, &c.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (d *DB) IsMember(conversationID, userID string) (bool, error) {
	var n int
	err := d.QueryRow(`SELECT COUNT(*) FROM conversation_members WHERE conversation_id = $1 AND user_id = $2`,
		conversationID, userID).Scan(&n)
	return n > 0, err
}

func (d *DB) ConversationMemberIDs(conversationID string) ([]string, error) {
	rows, err := d.Query(`SELECT user_id FROM conversation_members WHERE conversation_id = $1`, conversationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}
