package auth

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type Handler struct {
	db        *gorm.DB
	jwtSecret string
}

func NewHandler(db *gorm.DB, jwtSecret string) *Handler {
	return &Handler{db: db, jwtSecret: jwtSecret}
}

func (h *Handler) RegisterRoutes(router *gin.RouterGroup) {
	auth := router.Group("/auth")
	auth.POST("/register", h.register)
	auth.POST("/login", h.login)
	auth.GET("/me", h.requireAuth, h.me)
}

type registerRequest struct {
	Username string `json:"username" binding:"required,min=1,max=64"`
	Account  string `json:"account" binding:"required,min=3,max=64"`
	Password string `json:"password" binding:"required,min=6,max=72"`
}

type loginRequest struct {
	Account  string `json:"account" binding:"required"`
	Password string `json:"password" binding:"required"`
}

func (h *Handler) register(c *gin.Context) {
	var req registerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "invalid request"})
		return
	}

	account := strings.TrimSpace(req.Account)
	username := strings.TrimSpace(req.Username)
	if account == "" || username == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "account and username are required"})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to hash password"})
		return
	}

	user := User{
		Username:     username,
		Account:      account,
		PasswordHash: string(hash),
	}

	if err := h.db.Create(&user).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"message": "account already exists"})
		return
	}

	h.respondWithToken(c, user)
}

func (h *Handler) login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "invalid request"})
		return
	}

	var user User
	if err := h.db.Where("account = ?", strings.TrimSpace(req.Account)).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "invalid account or password"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "invalid account or password"})
		return
	}

	h.respondWithToken(c, user)
}

func (h *Handler) me(c *gin.Context) {
	user := c.MustGet("user").(User)
	c.JSON(http.StatusOK, gin.H{"user": ToUserDTO(user)})
}

func (h *Handler) respondWithToken(c *gin.Context, user User) {
	token, err := SignToken(user.ID, h.jwtSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to sign token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user":  ToUserDTO(user),
	})
}

func (h *Handler) requireAuth(c *gin.Context) {
	header := c.GetHeader("Authorization")
	if !strings.HasPrefix(header, "Bearer ") {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": "missing token"})
		return
	}

	claims, err := ParseToken(strings.TrimPrefix(header, "Bearer "), h.jwtSecret)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": "invalid token"})
		return
	}

	var user User
	if err := h.db.First(&user, claims.UserID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": "user not found"})
			return
		}
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"message": "failed to load user"})
		return
	}

	c.Set("user", user)
	c.Next()
}
