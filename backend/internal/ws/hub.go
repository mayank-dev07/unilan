package ws

import (
	"encoding/json"
	"log"
	"sync"

	"github.com/unilan/unilanbackend/internal/models"
)

// Hub keeps a set of active clients per conversation and fans out broadcasts.
type Hub struct {
	mu      sync.RWMutex
	clients map[string]map[*Client]struct{} // conversationID -> set of clients
}

func NewHub() *Hub {
	return &Hub{clients: make(map[string]map[*Client]struct{})}
}

func (h *Hub) Register(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	set, ok := h.clients[c.ConversationID]
	if !ok {
		set = make(map[*Client]struct{})
		h.clients[c.ConversationID] = set
	}
	set[c] = struct{}{}
}

func (h *Hub) Unregister(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if set, ok := h.clients[c.ConversationID]; ok {
		delete(set, c)
		if len(set) == 0 {
			delete(h.clients, c.ConversationID)
		}
	}
}

// Broadcast implements handlers.Broadcaster.
func (h *Hub) Broadcast(conversationID string, msg models.Message) {
	payload, err := json.Marshal(map[string]any{
		"type":    "message",
		"message": msg,
	})
	if err != nil {
		log.Printf("ws: marshal: %v", err)
		return
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.clients[conversationID] {
		select {
		case c.send <- payload:
		default:
			// slow consumer; drop
		}
	}
}
