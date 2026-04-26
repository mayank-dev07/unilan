package handlers

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/unilan/unilanbackend/internal/auth"
	"golang.org/x/time/rate"
)

// PerUserLimiter holds a token bucket per user ID. Buckets are GC'd lazily.
type PerUserLimiter struct {
	mu       sync.Mutex
	buckets  map[string]*entry
	r        rate.Limit
	burst    int
	idleEvict time.Duration
}

type entry struct {
	lim  *rate.Limiter
	last time.Time
}

// NewPerUserLimiter: rps tokens/sec, allow short bursts of `burst`.
func NewPerUserLimiter(rps float64, burst int) *PerUserLimiter {
	l := &PerUserLimiter{
		buckets:   make(map[string]*entry),
		r:         rate.Limit(rps),
		burst:     burst,
		idleEvict: 10 * time.Minute,
	}
	go l.gcLoop()
	return l
}

func (l *PerUserLimiter) gcLoop() {
	t := time.NewTicker(5 * time.Minute)
	defer t.Stop()
	for range t.C {
		cutoff := time.Now().Add(-l.idleEvict)
		l.mu.Lock()
		for k, e := range l.buckets {
			if e.last.Before(cutoff) {
				delete(l.buckets, k)
			}
		}
		l.mu.Unlock()
	}
}

func (l *PerUserLimiter) allow(userID string) bool {
	l.mu.Lock()
	e, ok := l.buckets[userID]
	if !ok {
		e = &entry{lim: rate.NewLimiter(l.r, l.burst)}
		l.buckets[userID] = e
	}
	e.last = time.Now()
	l.mu.Unlock()
	return e.lim.Allow()
}

// Middleware enforces the limit. Must run after auth.Middleware so userID is set.
func (l *PerUserLimiter) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		uid := c.GetString(auth.CtxUserID)
		if uid == "" {
			c.Next()
			return
		}
		if !l.allow(uid) {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "rate limit exceeded"})
			return
		}
		c.Next()
	}
}
