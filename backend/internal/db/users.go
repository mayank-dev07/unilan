package db

import (
	"database/sql"
	"errors"

	"github.com/google/uuid"
	"github.com/unilan/unilanbackend/internal/models"
)

var ErrNotFound = errors.New("not found")

func (d *DB) CreateUser(username, passwordHash string) (*models.User, error) {
	id := uuid.NewString()
	_, err := d.Exec(`INSERT INTO users (id, username, password_hash) VALUES ($1, $2, $3)`,
		id, username, passwordHash)
	if err != nil {
		return nil, err
	}
	return d.GetUserByID(id)
}

func (d *DB) GetUserByID(id string) (*models.User, error) {
	row := d.QueryRow(`SELECT id, username, password_hash, created_at FROM users WHERE id = $1`, id)
	return scanUser(row)
}

func (d *DB) GetUserByUsername(username string) (*models.User, error) {
	row := d.QueryRow(`SELECT id, username, password_hash, created_at FROM users WHERE username = $1`, username)
	return scanUser(row)
}

func scanUser(row *sql.Row) (*models.User, error) {
	var u models.User
	err := row.Scan(&u.ID, &u.Username, &u.PasswordHash, &u.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}
