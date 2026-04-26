package db

import (
	"database/sql"
	"errors"
	"strings"

	"github.com/google/uuid"
	"github.com/unilan/unilanbackend/internal/models"
)

var ErrNotFound = errors.New("not found")

const userCols = `id, username, COALESCE(password_hash, ''), COALESCE(google_sub, ''),
                  COALESCE(email, ''), COALESCE(name, ''), COALESCE(picture, ''),
                  COALESCE(language, 'en'), created_at`

// CreateUser registers a new username/password user with no avatar and the
// default language. Kept for back-compat; new callers should use
// CreateUserFull.
func (d *DB) CreateUser(username, passwordHash string) (*models.User, error) {
	return d.CreateUserFull(username, passwordHash, "", "en")
}

// CreateUserFull registers a new user with optional avatar and language.
func (d *DB) CreateUserFull(username, passwordHash, picture, language string) (*models.User, error) {
	if language == "" {
		language = "en"
	}
	id := uuid.NewString()
	_, err := d.Exec(
		`INSERT INTO users (id, username, password_hash, picture, language)
		 VALUES ($1, $2, $3, NULLIF($4, ''), $5)`,
		id, username, passwordHash, picture, language,
	)
	if err != nil {
		return nil, err
	}
	return d.GetUserByID(id)
}

// CreateUserWithPicture is the older 3-arg signature; kept so existing call
// sites compile. New code should use CreateUserFull.
func (d *DB) CreateUserWithPicture(username, passwordHash, picture string) (*models.User, error) {
	return d.CreateUserFull(username, passwordHash, picture, "en")
}

// UpdateUserPicture sets the avatar URL on an existing user. Empty string
// clears it (NULLs the column).
func (d *DB) UpdateUserPicture(userID, picture string) (*models.User, error) {
	if _, err := d.Exec(
		`UPDATE users SET picture = NULLIF($1, '') WHERE id = $2`,
		picture, userID,
	); err != nil {
		return nil, err
	}
	return d.GetUserByID(userID)
}

// UpdateUserLanguage sets the regional language preference. Falls back to
// "en" if the caller passes an empty string.
func (d *DB) UpdateUserLanguage(userID, language string) (*models.User, error) {
	if language == "" {
		language = "en"
	}
	if _, err := d.Exec(`UPDATE users SET language = $1 WHERE id = $2`, language, userID); err != nil {
		return nil, err
	}
	return d.GetUserByID(userID)
}

// UpsertGoogleUser finds-or-creates a user identified by their Google `sub`
// claim. The username is derived from the Google profile and made unique with
// a numeric suffix on collision.
func (d *DB) UpsertGoogleUser(sub, email, name, picture string) (*models.User, error) {
	row := d.QueryRow(
		`SELECT `+userCols+` FROM users WHERE google_sub = $1`,
		sub,
	)
	u, err := scanUser(row)
	if err == nil {
		_, _ = d.Exec(
			`UPDATE users SET email = $1, name = $2, picture = $3 WHERE id = $4`,
			email, name, picture, u.ID,
		)
		u.Email, u.Name, u.Picture = email, name, picture
		return u, nil
	}
	if !errors.Is(err, ErrNotFound) {
		return nil, err
	}

	id := uuid.NewString()
	username, err := d.uniqueUsername(deriveUsername(name, email))
	if err != nil {
		return nil, err
	}
	if _, err := d.Exec(
		`INSERT INTO users (id, username, google_sub, email, name, picture, language)
		 VALUES ($1, $2, $3, $4, $5, $6, 'en')`,
		id, username, sub, email, name, picture,
	); err != nil {
		return nil, err
	}
	return d.GetUserByID(id)
}

func deriveUsername(name, email string) string {
	candidate := sanitizeUsername(strings.ToLower(strings.ReplaceAll(name, " ", "")))
	if len(candidate) >= 3 {
		return candidate
	}
	if at := strings.Index(email, "@"); at > 0 {
		local := sanitizeUsername(strings.ToLower(email[:at]))
		if len(local) >= 3 {
			return local
		}
	}
	return "user"
}

func sanitizeUsername(s string) string {
	var b strings.Builder
	for _, r := range s {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9', r == '.', r == '_', r == '-':
			b.WriteRune(r)
		}
	}
	out := b.String()
	if len(out) > 32 {
		out = out[:32]
	}
	return out
}

func (d *DB) uniqueUsername(base string) (string, error) {
	candidate := base
	for i := 2; ; i++ {
		var n int
		if err := d.QueryRow(`SELECT COUNT(*) FROM users WHERE username = $1`, candidate).Scan(&n); err != nil {
			return "", err
		}
		if n == 0 {
			return candidate, nil
		}
		candidate = base + "-" + itoa(i)
		if i > 999 {
			return "", errors.New("could not allocate unique username")
		}
	}
}

func itoa(i int) string {
	if i == 0 {
		return "0"
	}
	var buf [20]byte
	pos := len(buf)
	for i > 0 {
		pos--
		buf[pos] = byte('0' + i%10)
		i /= 10
	}
	return string(buf[pos:])
}

func (d *DB) GetUserByID(id string) (*models.User, error) {
	row := d.QueryRow(`SELECT `+userCols+` FROM users WHERE id = $1`, id)
	return scanUser(row)
}

func (d *DB) GetUserByUsername(username string) (*models.User, error) {
	row := d.QueryRow(`SELECT `+userCols+` FROM users WHERE username = $1`, username)
	return scanUser(row)
}

// ListUsersExcept returns every user except the one with the given ID.
func (d *DB) ListUsersExcept(excludeID string) ([]models.User, error) {
	rows, err := d.Query(
		`SELECT `+userCols+` FROM users WHERE id != $1 ORDER BY username ASC`,
		excludeID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.User
	for rows.Next() {
		var u models.User
		if err := rows.Scan(&u.ID, &u.Username, &u.PasswordHash, &u.GoogleSub, &u.Email, &u.Name, &u.Picture, &u.Language, &u.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

func scanUser(row *sql.Row) (*models.User, error) {
	var u models.User
	err := row.Scan(&u.ID, &u.Username, &u.PasswordHash, &u.GoogleSub, &u.Email, &u.Name, &u.Picture, &u.Language, &u.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}
