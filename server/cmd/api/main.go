package main

import (
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"server/internal/auth"
	"server/internal/config"
	"server/internal/database"
	"server/internal/subway"
)

func main() {
	cfg := config.Load()

	db, err := database.Open(cfg.MySQLDSN)
	if err != nil {
		log.Fatalf("connect mysql: %v", err)
	}
	if err := db.AutoMigrate(&auth.User{}, &subway.Route{}, &subway.Station{}, &subway.RouteStation{}); err != nil {
		log.Fatalf("migrate database: %v", err)
	}

	router := gin.Default()
	router.Use(corsMiddleware())

	api := router.Group("/api")
	api.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})
	auth.NewHandler(db, cfg.JWTSecret).RegisterRoutes(api)
	subway.NewHandler(db).RegisterRoutes(api)

	log.Printf("server listening on %s", cfg.Addr)
	if err := router.Run(cfg.Addr); err != nil {
		log.Fatalf("run server: %v", err)
	}
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin != "" {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Vary", "Origin")
		} else {
			c.Header("Access-Control-Allow-Origin", "*")
		}
		c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")

		if strings.EqualFold(c.Request.Method, http.MethodOptions) {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}
