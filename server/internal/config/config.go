package config

import "os"

type Config struct {
	Addr      string
	MySQLDSN  string
	JWTSecret string
}

func Load() Config {
	return Config{
		Addr:      getEnv("SERVER_ADDR", ":8080"),
		MySQLDSN:  getEnv("MYSQL_DSN", "root:123456@tcp(127.0.0.1:3306)/subway?charset=utf8mb4&parseTime=True&loc=Local"),
		JWTSecret: getEnv("JWT_SECRET", "change-this-secret-in-production"),
	}
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
