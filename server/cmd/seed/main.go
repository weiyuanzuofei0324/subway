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
	if len(os.Args) < 3 {
		fmt.Fprintln(os.Stderr, "usage: go run ./cmd/seed <subway|timetable|all> <json-path> [timetable-json-path]")
		os.Exit(1)
	}

	cfg := config.Load()
	db, err := database.Open(cfg.MySQLDSN)
	if err != nil {
		log.Fatalf("connect mysql: %v", err)
	}

	if err := db.AutoMigrate(&auth.User{}, &subway.Route{}, &subway.Station{}, &subway.RouteStation{}, &subway.Timetable{}); err != nil {
		log.Fatalf("migrate database: %v", err)
	}

	seedType := os.Args[1]
	jsonPath := os.Args[2]

	switch seedType {
	case "subway":
		if err := subway.SeedSubwayData(db, jsonPath); err != nil {
			log.Fatalf("seed subway data: %v", err)
		}
	case "timetable":
		if err := subway.SeedTimetableData(db, jsonPath); err != nil {
			log.Fatalf("seed timetable data: %v", err)
		}
	case "all":
		if len(os.Args) != 4 {
			log.Fatal("usage: go run ./cmd/seed all <distance-json-path> <timetable-json-path>")
		}
		if err := subway.SeedAllSubwayData(db, jsonPath, os.Args[3]); err != nil {
			log.Fatalf("seed all subway data: %v", err)
		}
	default:
		log.Fatalf("unknown seed type %q, expected subway, timetable or all", seedType)
	}

	log.Printf("seed %s data: ok", seedType)
}
