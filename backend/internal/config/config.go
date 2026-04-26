package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	Port             string
	GinMode          string
	DatabaseURL      string
	JWTSecret        string
	JWTTTLHours      int
	MessageEncKeyHex string

	OpenRouterKey   string
	OpenRouterModel string
	GroqKey         string
	GroqModel       string

	CORSOrigins []string

	CacheSize       int
	RateLimitRPS    float64
	RateLimitBurst  int
	BreakerThreshold int
	BreakerCooldownSec int

	LogJSON bool
}

func Load() (*Config, error) {
	_ = godotenv.Load()

	c := &Config{
		Port:               getEnv("PORT", "8080"),
		GinMode:            getEnv("GIN_MODE", "debug"),
		DatabaseURL:        os.Getenv("DATABASE_URL"),
		JWTSecret:          os.Getenv("JWT_SECRET"),
		JWTTTLHours:        getEnvInt("JWT_TTL_HOURS", 72),
		MessageEncKeyHex:   os.Getenv("MESSAGE_ENC_KEY"),
		OpenRouterKey:      os.Getenv("OPENROUTER_API_KEY"),
		OpenRouterModel:    getEnv("OPENROUTER_MODEL", "meta-llama/llama-3.3-70b-instruct"),
		GroqKey:            os.Getenv("GROQ_API_KEY"),
		GroqModel:          getEnv("GROQ_MODEL", "llama-3.3-70b-versatile"),
		CORSOrigins:        splitCSV(getEnv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173")),
		CacheSize:          getEnvInt("TRANSLATION_CACHE_SIZE", 4096),
		RateLimitRPS:       getEnvFloat("RATE_LIMIT_RPS", 5.0),
		RateLimitBurst:     getEnvInt("RATE_LIMIT_BURST", 20),
		BreakerThreshold:   getEnvInt("BREAKER_THRESHOLD", 3),
		BreakerCooldownSec: getEnvInt("BREAKER_COOLDOWN_SEC", 60),
		LogJSON:            getEnvBool("LOG_JSON", false),
	}

	if c.JWTSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET is required")
	}
	if c.MessageEncKeyHex == "" {
		return nil, fmt.Errorf("MESSAGE_ENC_KEY is required (64 hex chars)")
	}
	if c.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required (Postgres connection string)")
	}
	return c, nil
}

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func getEnvInt(key string, def int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}

func getEnvFloat(key string, def float64) float64 {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.ParseFloat(v, 64); err == nil {
			return n
		}
	}
	return def
}

func getEnvBool(key string, def bool) bool {
	if v := os.Getenv(key); v != "" {
		return v == "1" || strings.EqualFold(v, "true") || strings.EqualFold(v, "yes")
	}
	return def
}

func splitCSV(s string) []string {
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if t := strings.TrimSpace(p); t != "" {
			out = append(out, t)
		}
	}
	return out
}
