package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// HasuraClaims is the namespaced claim Hasura reads to derive the user role
// and user ID from a JWT. See:
// https://hasura.io/docs/latest/auth/authentication/jwt/
type HasuraClaims struct {
	AllowedRoles []string `json:"x-hasura-allowed-roles"`
	DefaultRole  string   `json:"x-hasura-default-role"`
	UserID       string   `json:"x-hasura-user-id"`
}

type Claims struct {
	UserID   string       `json:"uid"`
	Username string       `json:"usr"`
	Hasura   HasuraClaims `json:"https://hasura.io/jwt/claims"`
	jwt.RegisteredClaims
}

type Issuer struct {
	secret []byte
	ttl    time.Duration
}

func NewIssuer(secret string, ttlHours int) *Issuer {
	return &Issuer{
		secret: []byte(secret),
		ttl:    time.Duration(ttlHours) * time.Hour,
	}
}

func (i *Issuer) Issue(userID, username string) (string, error) {
	now := time.Now()
	claims := Claims{
		UserID:   userID,
		Username: username,
		Hasura: HasuraClaims{
			AllowedRoles: []string{"user"},
			DefaultRole:  "user",
			UserID:       userID,
		},
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(i.ttl)),
			Issuer:    "unilan",
		},
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return tok.SignedString(i.secret)
}

func (i *Issuer) Parse(tokenStr string) (*Claims, error) {
	tok, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return i.secret, nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := tok.Claims.(*Claims)
	if !ok || !tok.Valid {
		return nil, errors.New("invalid token")
	}
	return claims, nil
}
