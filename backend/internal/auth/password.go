package auth

import "golang.org/x/crypto/bcrypt"

func HashPassword(p string) (string, error) {
	h, err := bcrypt.GenerateFromPassword([]byte(p), 12)
	if err != nil {
		return "", err
	}
	return string(h), nil
}

func CheckPassword(hash, p string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(p)) == nil
}
