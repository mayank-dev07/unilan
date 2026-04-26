package handlers

import (
	"errors"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/cloudinary/cloudinary-go/v2"
	"github.com/cloudinary/cloudinary-go/v2/api/uploader"
	"github.com/gin-gonic/gin"
	"github.com/unilan/unilanbackend/internal/auth"
)

const (
	maxAvatarBytes = 5 << 20 // 5 MB
	avatarFolder   = "unilan/avatars"
)

var allowedAvatarExt = map[string]bool{
	".jpg": true, ".jpeg": true, ".png": true, ".webp": true, ".gif": true,
}

// AvatarUploader wraps a Cloudinary client. nil if not configured — handler
// returns 503 in that case.
type AvatarUploader struct {
	cld *cloudinary.Cloudinary
}

func NewAvatarUploader(cloudinaryURL string) *AvatarUploader {
	if cloudinaryURL == "" {
		return &AvatarUploader{}
	}
	cld, err := cloudinary.NewFromURL(cloudinaryURL)
	if err != nil {
		return &AvatarUploader{}
	}
	return &AvatarUploader{cld: cld}
}

// UpdateMyAvatar uploads a multipart "file" to Cloudinary and saves the
// resulting URL on the authenticated user. Authenticated — runs after signup
// in the two-step flow OR from a future settings screen. Returns the updated
// user record.
func (h *Handler) UpdateMyAvatar(c *gin.Context) {
	if h.Uploader == nil || h.Uploader.cld == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "avatar upload not configured"})
		return
	}
	uid := c.GetString(auth.CtxUserID)
	if uid == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxAvatarBytes+512)
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		if errors.Is(err, http.ErrMissingFile) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "missing 'file' field"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": "could not read file: " + err.Error()})
		return
	}
	defer file.Close()

	if header.Size > maxAvatarBytes {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "image too large (max 5MB)"})
		return
	}
	ext := strings.ToLower(filepath.Ext(header.Filename))
	if !allowedAvatarExt[ext] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported image type; use jpg/png/webp/gif"})
		return
	}

	overwrite := false
	uniqueFilename := true
	res, err := h.Uploader.cld.Upload.Upload(c.Request.Context(), file, uploader.UploadParams{
		Folder:         avatarFolder,
		ResourceType:   "image",
		Overwrite:      &overwrite,
		UniqueFilename: &uniqueFilename,
		Transformation: "c_fill,g_face,w_400,h_400,q_auto,f_auto",
	})
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "cloudinary upload failed: " + err.Error()})
		return
	}

	user, err := h.DB.UpdateUserPicture(uid, res.SecureURL)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "save picture failed: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"user": user, "url": res.SecureURL})
}
