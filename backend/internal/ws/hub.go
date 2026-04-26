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

// Broadcast implements handlers.Broadcaster — fans a new message out to every
// client subscribed to this conversation, including the sender (frontend
// dedupes by message id).
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

// BroadcastFunc lets the caller render a per-viewer payload. `makePayload`
// is invoked for each subscribed client with that client's user_id and
// regional language; whatever bytes it returns are sent as a single text
// frame. Errors are logged and skipped — one bad client doesn't poison the
// fan-out.
func (h *Hub) BroadcastFunc(conversationID string, makePayload func(viewerUserID, viewerLang string) ([]byte, error)) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.clients[conversationID] {
		payload, err := makePayload(c.UserID, c.Language)
		if err != nil {
			log.Printf("ws: per-viewer payload failed for user=%s lang=%s: %v", c.UserID, c.Language, err)
			continue
		}
		select {
		case c.send <- payload:
		default:
			// slow consumer; drop this frame
		}
	}
}

// BroadcastTyping fans a typing-state change out to every client in this
// conversation EXCEPT the sender (the typist doesn't need to see their own
// indicator).
func (h *Hub) BroadcastTyping(conversationID string, fromClient *Client, typing bool) {
	payload, err := json.Marshal(map[string]any{
		"type":            "typing",
		"conversation_id": conversationID,
		"user_id":         fromClient.UserID,
		"username":        fromClient.Username,
		"typing":          typing,
	})
	if err != nil {
		log.Printf("ws: typing marshal: %v", err)
		return
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.clients[conversationID] {
		if c == fromClient {
			continue
		}
		select {
		case c.send <- payload:
		default:
		}
	}
}
