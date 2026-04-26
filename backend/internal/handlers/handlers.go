package handlers

import (
	"context"
	"encoding/json"
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

// Broadcaster is implemented by the WebSocket hub. It supports two modes:
//   - Broadcast(conv, msg) → fan-out a single payload (legacy)
//   - BroadcastFunc(conv, fn) → per-viewer payload, fn receives each
//     subscribed client's user_id + language and returns its bytes.
type Broadcaster interface {
	Broadcast(conversationID string, msg models.Message)
	BroadcastFunc(conversationID string, makePayload func(viewerUserID, viewerLang string) ([]byte, error))
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
	Language string `json:"language" binding:"omitempty,max=8"`
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
	lang := req.Language
	if lang != "" && !orchestrator.IsSupported(lang) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported language code: " + lang})
		return
	}
	if lang == "" {
		lang = "en"
	}
	// Avatar comes in a second step via POST /me/avatar.
	user, err := h.DB.CreateUserFull(req.Username, hash, "", lang)
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

// ---------- language preference ----------

type languageReq struct {
	Language string `json:"language" binding:"required,min=2,max=8"`
}

// UpdateMyLanguage sets the authenticated user's preferred regional language.
// Future messages they SEND get tagged with this language; messages they
// VIEW get rendered into it.
func (h *Handler) UpdateMyLanguage(c *gin.Context) {
	uid := c.GetString(auth.CtxUserID)
	var req languageReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if !orchestrator.IsSupported(req.Language) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported language code"})
		return
	}
	user, err := h.DB.UpdateUserLanguage(uid, req.Language)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"user": user})
}

// Languages returns the list of supported regional languages so the
// frontend can render a dropdown without hardcoding the list.
func (h *Handler) Languages(c *gin.Context) {
	c.JSON(http.StatusOK, orchestrator.SupportedLanguages)
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
	uid := c.GetString(auth.CtxUserID)
	user, err := h.DB.GetUserByID(uid)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	// Preview as the user sees their own messages: src == dst == user's lang.
	out, err := h.Orch.ProcessForViewer(c.Request.Context(), req.Text, user.Language, user.Language)
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
	// Either text or media_url (or both — media + caption) must be present.
	// We can't enforce the OR via struct tags so we check inline.
	Text      string `json:"text" binding:"max=4000"`
	MediaURL  string `json:"media_url" binding:"max=512"`
	MediaType string `json:"media_type" binding:"max=16"`
}

func (h *Handler) ListMessages(c *gin.Context) {
	convID := c.Param("id")
	uid := c.GetString(auth.CtxUserID)
	if ok, err := h.DB.IsMember(convID, uid); err != nil || !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "not a member"})
		return
	}
	viewer, err := h.DB.GetUserByID(uid)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	rows, senders, err := h.DB.ListMessages(convID, 200)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	out := make([]models.Message, 0, len(rows))
	for i, r := range rows {
		m, err := h.renderMessageForViewer(c.Request.Context(), r, senders[i], viewer.Language)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "render failed: " + err.Error()})
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
	if strings.TrimSpace(req.Text) == "" && req.MediaURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "text or media_url required"})
		return
	}
	if req.MediaURL != "" && req.MediaType != "image" && req.MediaType != "video" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "media_type must be 'image' or 'video'"})
		return
	}
	sender, err := h.DB.GetUserByID(uid)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "load sender failed: " + err.Error()})
		return
	}
	senderLang := sender.Language
	if senderLang == "" {
		senderLang = "en"
	}

	// Pipeline produces the SENDER's own view (so we have something to encrypt
	// for the legacy display/unilan columns + for the response back to sender).
	res, err := h.Pipeline.Process(c.Request.Context(), req.Text, senderLang)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "pipeline failed: " + err.Error()})
		return
	}
	row, err := h.DB.InsertMessage(convID, uid, senderLang,
		res.OriginalCT, res.DisplayCT, res.UniLanCT,
		req.MediaURL, req.MediaType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	createdAt := time.Now().UTC()

	// Sender's response: rendered as they see it themselves (src == dst).
	senderOutcome, _ := h.Orch.ProcessForViewer(c.Request.Context(), req.Text, senderLang, senderLang)
	senderMsg := models.Message{
		ID:             row.ID,
		ConversationID: convID,
		SenderID:       uid,
		SenderUsername: username,
		SenderLang:     senderLang,
		ViewerLang:     senderLang,
		OriginalText:   senderOutcome.Original,
		DisplayText:    senderOutcome.Display,
		UniLanText:     senderOutcome.UniLan,
		MediaURL:       req.MediaURL,
		MediaType:      req.MediaType,
		CreatedAt:      createdAt,
	}

	// Broadcast: each subscribed viewer gets a payload rendered in THEIR
	// language. We render for the sender too — the WS dedupe in the frontend
	// keeps it from showing twice.
	if h.Hub != nil {
		h.Hub.BroadcastFunc(convID, func(viewerID, viewerLang string) ([]byte, error) {
			out, err := h.Orch.ProcessForViewer(c.Request.Context(), req.Text, senderLang, viewerLang)
			if err != nil {
				return nil, err
			}
			vmsg := models.Message{
				ID:             row.ID,
				ConversationID: convID,
				SenderID:       uid,
				SenderUsername: username,
				SenderLang:     senderLang,
				ViewerLang:     viewerLang,
				OriginalText:   out.Original,
				DisplayText:    out.Display,
				UniLanText:     out.UniLan,
				MediaURL:       req.MediaURL,
				MediaType:      req.MediaType,
				CreatedAt:      createdAt,
			}
			return json.Marshal(map[string]any{"type": "message", "message": vmsg})
		})
	}
	c.JSON(http.StatusCreated, senderMsg)
}

// renderMessageForViewer decrypts the ORIGINAL text and re-renders it for the
// given viewer language. The stored display/unilan ciphertexts are ignored —
// they were the sender's own view at send time and don't apply across users.
func (h *Handler) renderMessageForViewer(
	ctx context.Context,
	r db.EncryptedMessage,
	senderUsername string,
	viewerLang string,
) (models.Message, error) {
	origBytes, err := h.Cipher.Decrypt(r.OriginalCT)
	if err != nil {
		return models.Message{}, err
	}
	original := string(origBytes)
	senderLang := r.SenderLang
	if senderLang == "" {
		senderLang = "en"
	}
	if viewerLang == "" {
		viewerLang = "en"
	}

	out, err := h.Orch.ProcessForViewer(ctx, original, senderLang, viewerLang)
	if err != nil {
		return models.Message{}, err
	}
	return models.Message{
		ID:             r.ID,
		ConversationID: r.ConversationID,
		SenderID:       r.SenderID,
		SenderUsername: senderUsername,
		SenderLang:     senderLang,
		ViewerLang:     viewerLang,
		OriginalText:   out.Original,
		DisplayText:    out.Display,
		UniLanText:     out.UniLan,
		MediaURL:       r.MediaURL,
		MediaType:      r.MediaType,
		CreatedAt:      r.CreatedAt,
	}, nil
}
