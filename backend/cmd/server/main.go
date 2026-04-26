package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/unilan/unilanbackend/internal/auth"
	"github.com/unilan/unilanbackend/internal/config"
	"github.com/unilan/unilanbackend/internal/crypto"
	"github.com/unilan/unilanbackend/internal/db"
	"github.com/unilan/unilanbackend/internal/handlers"
	"github.com/unilan/unilanbackend/internal/orchestrator"
	"github.com/unilan/unilanbackend/internal/ws"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.Error("config", "err", err)
		os.Exit(1)
	}

	logger := newLogger(cfg.LogJSON)
	slog.SetDefault(logger)

	gin.SetMode(cfg.GinMode)

	store, err := db.Open(cfg.DatabaseURL)
	if err != nil {
		logger.Error("db open failed", "err", err)
		os.Exit(1)
	}
	defer store.Close()

	cipher, err := crypto.NewFromHexKey(cfg.MessageEncKeyHex)
	if err != nil {
		logger.Error("crypto init failed", "err", err)
		os.Exit(1)
	}

	issuer := auth.NewIssuer(cfg.JWTSecret, cfg.JWTTTLHours)

	orch, err := buildOrchestrator(cfg, logger)
	if err != nil {
		logger.Error("orchestrator init failed", "err", err)
		os.Exit(1)
	}

	hub := ws.NewHub()
	uploader := handlers.NewAvatarUploader(cfg.CloudinaryURL)
	if cfg.CloudinaryURL == "" {
		logger.Warn("CLOUDINARY_URL not set; avatar upload endpoint will return 503")
	}
	h := handlers.New(store, issuer, cipher, orch, hub, cfg.GoogleClientID, uploader)

	limiter := handlers.NewPerUserLimiter(cfg.RateLimitRPS, cfg.RateLimitBurst)

	r := gin.New()
	r.Use(handlers.RequestID())
	r.Use(handlers.SlogLogger(logger))
	r.Use(handlers.Recovery(logger))
	r.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.CORSOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "X-Request-ID"},
		ExposeHeaders:    []string{"X-Request-ID"},
		AllowCredentials: true,
	}))

	r.GET("/healthz", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"ok": true}) })
	r.GET("/readyz", func(c *gin.Context) {
		if err := store.Ping(); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"ok": false, "err": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"ok":             true,
			"providers":      providerNames(orch),
			"cache_entries":  orch.Cache.Len(),
		})
	})

	r.POST("/auth/signup", h.Signup)
	r.POST("/auth/login", h.Login)
	r.POST("/auth/google", h.GoogleAuth)

	r.GET("/ws", ws.Serve(hub, issuer, store))

	api := r.Group("/", auth.Middleware(issuer), limiter.Middleware())
	{
		api.GET("/me", h.Me)
		api.PATCH("/me/language", h.UpdateMyLanguage)
		api.POST("/me/avatar", h.UpdateMyAvatar)
		api.POST("/me/media", h.UploadMedia)
		api.GET("/languages", h.Languages)
		api.POST("/translate", h.Translate)
		api.POST("/conversations", h.CreateConversation)
		api.GET("/conversations", h.ListConversations)
		api.GET("/conversations/:id/messages", h.ListMessages)
		api.POST("/conversations/:id/messages", h.SendMessage)
	}

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           r,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	// Run server, handle graceful shutdown.
	serverErr := make(chan error, 1)
	go func() {
		logger.Info("server listening", "addr", srv.Addr, "providers", providerNames(orch))
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErr <- err
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	select {
	case err := <-serverErr:
		logger.Error("server error", "err", err)
		os.Exit(1)
	case sig := <-stop:
		logger.Info("shutdown signal received", "signal", sig.String())
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Error("graceful shutdown failed", "err", err)
		os.Exit(1)
	}
	logger.Info("server stopped cleanly")
}

func newLogger(jsonOut bool) *slog.Logger {
	opts := &slog.HandlerOptions{Level: slog.LevelInfo}
	if jsonOut {
		return slog.New(slog.NewJSONHandler(os.Stdout, opts))
	}
	return slog.New(slog.NewTextHandler(os.Stdout, opts))
}

func buildOrchestrator(cfg *config.Config, log *slog.Logger) (*orchestrator.Orchestrator, error) {
	det := orchestrator.NewDetector()
	cooldown := time.Duration(cfg.BreakerCooldownSec) * time.Second

	var providers []*orchestrator.ManagedProvider
	if cfg.OpenRouterKey != "" {
		providers = append(providers, &orchestrator.ManagedProvider{
			T:       orchestrator.NewLLMProvider("openrouter", "https://openrouter.ai/api/v1", cfg.OpenRouterKey, cfg.OpenRouterModel),
			Breaker: orchestrator.NewBreaker(cfg.BreakerThreshold, cooldown),
		})
	}
	if cfg.GroqKey != "" {
		providers = append(providers, &orchestrator.ManagedProvider{
			T:       orchestrator.NewLLMProvider("groq", "https://api.groq.com/openai/v1", cfg.GroqKey, cfg.GroqModel),
			Breaker: orchestrator.NewBreaker(cfg.BreakerThreshold, cooldown),
		})
	}
	if len(providers) == 0 {
		log.Warn("no LLM providers configured; non-English input will be mapped verbatim")
	}

	cache, err := orchestrator.NewCache(cfg.CacheSize)
	if err != nil {
		return nil, err
	}
	return orchestrator.New(det, providers, cache, log), nil
}

func providerNames(orch *orchestrator.Orchestrator) []string {
	names := make([]string, 0, len(orch.Providers))
	for _, p := range orch.Providers {
		names = append(names, p.T.Name())
	}
	return names
}
