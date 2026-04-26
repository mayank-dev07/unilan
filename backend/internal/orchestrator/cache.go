package orchestrator

import (
	"crypto/sha256"
	"encoding/hex"

	lru "github.com/hashicorp/golang-lru/v2"
)

// Cache is a bounded LRU keyed by sha256(srcLang + "|" + text).
type Cache struct {
	lru *lru.Cache[string, string]
}

func NewCache(size int) (*Cache, error) {
	if size <= 0 {
		size = 4096
	}
	l, err := lru.New[string, string](size)
	if err != nil {
		return nil, err
	}
	return &Cache{lru: l}, nil
}

func cacheKey(srcLang, text string) string {
	h := sha256.Sum256([]byte(srcLang + "|" + text))
	return hex.EncodeToString(h[:])
}

func (c *Cache) Get(srcLang, text string) (string, bool) {
	return c.lru.Get(cacheKey(srcLang, text))
}

func (c *Cache) Put(srcLang, text, english string) {
	c.lru.Add(cacheKey(srcLang, text), english)
}

func (c *Cache) Len() int { return c.lru.Len() }
