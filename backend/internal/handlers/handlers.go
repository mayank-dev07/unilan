package handlers

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/unilan/unilanbackend/internal/auth"
	"github.com/unilan/unilanbackend/internal/crypto"
	"github.com/unilan/unilanbackend/internal/db"
	"github.com/unilan/unilanbackend/internal/models"
	"github.com/unilan/unilanbackend/internal/orchestrator"
	"google.golang.org/api/idtoken"
)

type Handler struct {
	DB             *db.DB
	Issuer         *auth.Issuer
	Cipher         *crypto.Cipher
	Orch           *orchestrator.Orchestrator
	Pipeline       *Pipeline
	Hub            Broadcaster
	GoogleClientID string
	Uploader       *AvatarUploader
}

// Broadcaster is implemented by the WebSocket hub.
type Broadcaster interface {
	Broadcast(conversationID string, msg models.Message)
}

func New(d *db.DB, issuer *auth.Issuer, c *crypto.Cipher, orch *orchestrator.Orchestrator, hub Broadcaster, googleClientID string, uploader *AvatarUploader) *Handler {
	return &Handler{
		DB:             d,
		Issuer:         issuer,
		Cipher:         c,
		Orch:           orch,
		Pipeline:       &Pipeline{Orch: orch, Cipher: c},
		Hub:            hub,
		GoogleClientID: googleClientID,
		Uploader:       uploader,
	}
}

// ---------- auth ----------

type signupReq struct {
	Username string `json:"username" binding:"required,min=3,max=32"`
	Password string `json:"password" binding:"required,min=8,max=128"`
}

func (h *Handler) Signup(c *gin.Context) {
	var req signupReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "hash failed"})
		return
	}
	// Avatar comes in a second step via POST /me/avatar.
	user, err := h.DB.CreateUser(req.Username, hash)
	if err != nil {
		if strings.Contains(err.Error(), "23505") || strings.Contains(err.Error(), "duplicate key") {
			c.JSON(http.StatusConflict, gin.H{"error": "username taken"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "create user failed: " + err.Error()})
		return
	}
	tok, err := h.Issuer.Issue(user.ID, user.Username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "token failed"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"user": user, "token": tok})
}

func (h *Handler) Login(c *gin.Context) {
	var req signupReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	user, err := h.DB.GetUserByUsername(req.Username)
	if err != nil || user.PasswordHash == "" || !auth.CheckPassword(user.PasswordHash, req.Password) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}
	tok, err := h.Issuer.Issue(user.ID, user.Username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "token failed"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"user": user, "token": tok})
}

type googleAuthReq struct {
	Credential string `json:"credential" binding:"required"`
}

func (h *Handler) GoogleAuth(c *gin.Context) {
	var req googleAuthReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	payload, err := idtoken.Validate(c.Request.Context(), req.Credential, h.GoogleClientID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid google token"})
		return
	}
	if v, ok := payload.Claims["email_verified"].(bool); !ok || !v {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "email not verified"})
		return
	}
	sub := payload.Subject
	email, _ := payload.Claims["email"].(string)
	name, _ := payload.Claims["name"].(string)
	picture, _ := payload.Claims["picture"].(string)

	user, err := h.DB.UpsertGoogleUser(sub, email, name, picture)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	tok, err := h.Issuer.Issue(user.ID, user.Username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "token failed"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"user": user, "token": tok})
}

func (h *Handler) Me(c *gin.Context) {
	uid := c.GetString(auth.CtxUserID)
	user, err := h.DB.GetUserByID(uid)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	c.JSON(http.StatusOK, user)
}

// ---------- translate (preview, no storage) ----------

type translateReq struct {
	Text string `json:"text" binding:"required,max=4000"`
}

func (h *Handler) Translate(c *gin.Context) {
	var req translateReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	out, err := h.Orch.Process(c.Request.Context(), req.Text)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, out)
}

// ---------- conversations ----------

type createConvReq struct {
	Title           string   `json:"title"`
	MemberIDs       []string `json:"member_ids"`
	MemberUsernames []string `json:"member_usernames"`
}

func (h *Handler) CreateConversation(c *gin.Context) {
	var req createConvReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	uid := c.GetString(auth.CtxUserID)

	members := append([]string{}, req.MemberIDs...)
	for _, uname := range req.MemberUsernames {
		u, err := h.DB.GetUserByUsername(uname)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "unknown user: " + uname})
			return
		}
		members = append(members, u.ID)
	}

	// 1-1 chat dedupe: if there's already a conversation between exactly these
	// two users, return it instead of creating a duplicate. This makes the
	// endpoint idempotent and prevents the "two conversations between the same
	// pair, messages split across them" bug regardless of which side clicks first.
	if len(members) == 1 && members[0] != uid {
		if existing, err := h.DB.FindOneOnOneConversation(uid, members[0]); err == nil {
			c.JSON(http.StatusOK, existing)
			return
		}
	}

	conv, err := h.DB.CreateConversation(req.Title, uid, members)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, conv)
}

func (h *Handler) ListConversations(c *gin.Context) {
	uid := c.GetString(auth.CtxUserID)
	convs, err := h.DB.ListConversationsForUser(uid)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, convs)
}

// ---------- messages ----------

type sendMsgReq struct {
	Text string `json:"text" binding:"required,max=4000"`
}

func (h *Handler) ListMessages(c *gin.Context) {
	convID := c.Param("id")
	uid := c.GetString(auth.CtxUserID)
	if ok, err := h.DB.IsMember(convID, uid); err != nil || !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "not a member"})
		return
	}
	rows, senders, err := h.DB.ListMessages(convID, 200)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	out := make([]models.Message, 0, len(rows))
	for i, r := range rows {
		m, err := h.decryptMessage(r, senders[i])
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "decrypt failed"})
			return
		}
		out = append(out, m)
	}
	c.JSON(http.StatusOK, out)
}

func (h *Handler) SendMessage(c *gin.Context) {
	convID := c.Param("id")
	uid := c.GetString(auth.CtxUserID)
	username := c.GetString(auth.CtxUsername)

	if ok, err := h.DB.IsMember(convID, uid); err != nil || !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "not a member"})
		return
	}
	var req sendMsgReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	res, err := h.Pipeline.Process(c.Request.Context(), req.Text)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "pipeline failed: " + err.Error()})
		return
	}
	row, err := h.DB.InsertMessage(convID, uid, res.OriginalCT, res.EnglishCT, res.UniLanCT)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	msg := models.Message{
		ID:             row.ID,
		ConversationID: convID,
		SenderID:       uid,
		SenderUsername: username,
		OriginalText:   res.Original,
		EnglishText:    res.English,
		UniLanText:     res.UniLan,
		CreatedAt:      time.Now().UTC(),
	}
	if h.Hub != nil {
		h.Hub.Broadcast(convID, msg)
	}
	c.JSON(http.StatusCreated, msg)
}

func (h *Handler) decryptMessage(r db.EncryptedMessage, senderUsername string) (models.Message, error) {
	orig, err := h.Cipher.Decrypt(r.OriginalCT)
	if err != nil {
		return models.Message{}, err
	}
	eng, err := h.Cipher.Decrypt(r.EnglishCT)
	if err != nil {
		return models.Message{}, err
	}
	uni, err := h.Cipher.Decrypt(r.UniLanCT)
	if err != nil {
		return models.Message{}, err
	}
	return models.Message{
		ID:             r.ID,
		ConversationID: r.ConversationID,
		SenderID:       r.SenderID,
		SenderUsername: senderUsername,
		OriginalText:   string(orig),
		EnglishText:    string(eng),
		UniLanText:     string(uni),
		CreatedAt:      r.CreatedAt,
	}, nil
}

// DecryptForWS exposes decryption for the ws package.
func (h *Handler) DecryptForWS(r db.EncryptedMessage, senderUsername string) (models.Message, error) {
	return h.decryptMessage(r, senderUsername)
}
