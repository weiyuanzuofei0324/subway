package main

import (
	"fmt"
	"log"
	"os"

	"server/internal/auth"
	"server/internal/config"
	"server/internal/database"
	"server/internal/subway"
)

func main() {
	if len(os.Args) != 2 {
		fmt.Fprintln(os.Stderr, "usage: go run ./cmd/seed <subway-json-path>")
		os.Exit(1)
	}

	cfg := config.Load()
	db, err := database.Open(cfg.MySQLDSN)
	if err != nil {
		log.Fatalf("connect mysql: %v", err)
	}

	if err := db.AutoMigrate(&auth.User{}, &subway.Route{}, &subway.Station{}, &subway.RouteStation{}); err != nil {
		log.Fatalf("migrate database: %v", err)
	}

	if err := subway.SeedSubwayData(db, os.Args[1]); err != nil {
		log.Fatalf("seed subway data: %v", err)
	}

	log.Println("seed subway data: ok")
}
