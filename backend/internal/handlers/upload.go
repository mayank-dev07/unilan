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
	maxAvatarBytes = 5 << 20  // 5 MB
	avatarFolder   = "unilan/avatars"
	maxMediaBytes  = 50 << 20 // 50 MB
	mediaFolder    = "unilan/media"
)

var allowedAvatarExt = map[string]bool{
	".jpg": true, ".jpeg": true, ".png": true, ".webp": true, ".gif": true,
}

// Images Cloudinary will happily ingest plus the common phone/web video formats.
var allowedMediaExt = map[string]string{
	".jpg":  "image",
	".jpeg": "image",
	".png":  "image",
	".webp": "image",
	".gif":  "image",
	".heic": "image",
	".mp4":  "video",
	".mov":  "video",
	".webm": "video",
	".m4v":  "video",
	".mkv":  "video",
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

// UploadMedia accepts a multipart "file" (image or video) and pushes it to
// Cloudinary with auto resource detection. Authenticated. Returns
// {url, type: "image"|"video"} so the frontend can include it on the next
// SendMessage call. Does NOT update any DB row by itself — the message
// record is created via POST /conversations/:id/messages.
func (h *Handler) UploadMedia(c *gin.Context) {
	if h.Uploader == nil || h.Uploader.cld == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "media upload not configured"})
		return
	}
	if c.GetString(auth.CtxUserID) == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxMediaBytes+1024)
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

	if header.Size > maxMediaBytes {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "file too large (max 50MB)"})
		return
	}
	ext := strings.ToLower(filepath.Ext(header.Filename))
	mediaType, ok := allowedMediaExt[ext]
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported file type"})
		return
	}

	uniqueFilename := true
	overwrite := false
	res, err := h.Uploader.cld.Upload.Upload(c.Request.Context(), file, uploader.UploadParams{
		Folder:         mediaFolder,
		ResourceType:   "auto", // Cloudinary detects image vs video
		Overwrite:      &overwrite,
		UniqueFilename: &uniqueFilename,
	})
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "cloudinary upload failed: " + err.Error()})
		return
	}
	// If Cloudinary disagrees with our extension guess, trust Cloudinary.
	if res.ResourceType == "video" {
		mediaType = "video"
	} else if res.ResourceType == "image" {
		mediaType = "image"
	}
	c.JSON(http.StatusOK, gin.H{
		"url":  res.SecureURL,
		"type": mediaType,
	})
}
