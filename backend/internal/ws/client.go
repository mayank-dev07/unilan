package ws

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/unilan/unilanbackend/internal/auth"
	"github.com/unilan/unilanbackend/internal/db"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = 50 * time.Second
	maxMessageSize = 8192
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     func(r *http.Request) bool { return true }, // CORS handled at HTTP layer
}

// Client is a single websocket connection scoped to one conversation.
type Client struct {
	Hub            *Hub
	Conn           *websocket.Conn
	UserID         string
	ConversationID string
	send           chan []byte
}

// Serve upgrades the request and starts the read/write pumps.
// Auth: ?token=<jwt>&conversation_id=<id>
func Serve(hub *Hub, issuer *auth.Issuer, d *db.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenStr := c.Query("token")
		convID := c.Query("conversation_id")
		if tokenStr == "" || convID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "token and conversation_id required"})
			return
		}
		claims, err := issuer.Parse(tokenStr)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}
		if ok, err := d.IsMember(convID, claims.UserID); err != nil || !ok {
			c.JSON(http.StatusForbidden, gin.H{"error": "not a member"})
			return
		}
		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			return
		}
		client := &Client{
			Hub:            hub,
			Conn:           conn,
			UserID:         claims.UserID,
			ConversationID: convID,
			send:           make(chan []byte, 32),
		}
		hub.Register(client)
		go client.writePump()
		go client.readPump()
	}
}

func (c *Client) readPump() {
	defer func() {
		c.Hub.Unregister(c)
		c.Conn.Close()
	}()
	c.Conn.SetReadLimit(maxMessageSize)
	c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})
	for {
		// We don't accept inbound messages over WS for now — clients send via REST.
		// Drain to detect disconnects and to honor pings.
		if _, _, err := c.Conn.ReadMessage(); err != nil {
			return
		}
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()
	for {
		select {
		case msg, ok := <-c.send:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.Conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}
		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
