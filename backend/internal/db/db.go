package db

import (
	"database/sql"
	"fmt"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
)

type DB struct {
	*sql.DB
}

// Open connects to a Postgres-compatible database (Postgres, CockroachDB,
// Neon, etc.) using the connection string from DATABASE_URL.
func Open(databaseURL string) (*DB, error) {
	conn, err := sql.Open("pgx", databaseURL)
	if err != nil {
		return nil, err
	}
	conn.SetMaxOpenConns(20)
	conn.SetMaxIdleConns(5)
	conn.SetConnMaxLifetime(30 * time.Minute)
	if err := conn.Ping(); err != nil {
		return nil, fmt.Errorf("ping: %w", err)
	}
	d := &DB{conn}
	if err := d.migrate(); err != nil {
		return nil, fmt.Errorf("migrate: %w", err)
	}
	return d, nil
}

const schema = `
CREATE TABLE IF NOT EXISTS users (
	id            TEXT PRIMARY KEY,
	username      TEXT NOT NULL UNIQUE,
	password_hash TEXT NOT NULL,
	created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversations (
	id         TEXT PRIMARY KEY,
	title      TEXT NOT NULL DEFAULT '',
	created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversation_members (
	conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
	user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
	PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_members_user ON conversation_members(user_id);

CREATE TABLE IF NOT EXISTS messages (
	id              TEXT PRIMARY KEY,
	conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
	sender_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	original_ct     TEXT NOT NULL,
	english_ct      TEXT NOT NULL,
	unilan_ct       TEXT NOT NULL,
	created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at);
`

func (d *DB) migrate() error {
	_, err := d.Exec(schema)
	return err
}
