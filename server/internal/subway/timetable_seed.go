package subway

import (
	"encoding/json"
	"fmt"
	"log"
	"net/url"
	"os"
	"path"
	"strings"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type TimetableData struct {
	StationTitle string                   `json:"station_title"`
	URL          string                   `json:"url"`
	Directions   []TimetableDirectionData `json:"directions"`
}

type TimetableDirectionData struct {
	Direction string        `json:"direction"`
	Workday   TimetableTime `json:"workday"`
	Holiday   TimetableTime `json:"holiday"`
}

type TimetableTime struct {
	First string `json:"first"`
	Last  string `json:"last"`
}

func SeedTimetableData(db *gorm.DB, jsonPath string) error {
	return db.Transaction(func(tx *gorm.DB) error {
		return seedTimetableDataTx(tx, jsonPath)
	})
}

func seedTimetableDataTx(tx *gorm.DB, jsonPath string) error {
	data, err := os.ReadFile(jsonPath)
	if err != nil {
		return fmt.Errorf("read timetable json: %w", err)
	}

	var timetableData []TimetableData
	if err := json.Unmarshal(data, &timetableData); err != nil {
		return fmt.Errorf("parse timetable json: %w", err)
	}

	stationByName, err := loadStationsByName(tx)
	if err != nil {
		return err
	}
	stationByPinyinKey, err := loadStationsByPinyinKey(tx)
	if err != nil {
		return err
	}

	for _, item := range timetableData {
		station, ok := findStationForTimetable(item, stationByName, stationByPinyinKey)
		if !ok {
			continue
		}

		for _, direction := range item.Directions {
			timetable := Timetable{
				StationID:    station.ID,
				Direction:    strings.TrimSpace(direction.Direction),
				WorkdayFirst: strings.TrimSpace(direction.Workday.First),
				WorkdayLast:  strings.TrimSpace(direction.Workday.Last),
				HolidayFirst: strings.TrimSpace(direction.Holiday.First),
				HolidayLast:  strings.TrimSpace(direction.Holiday.Last),
			}
			if timetable.Direction == "" {
				continue
			}

			if err := tx.Clauses(clause.OnConflict{
				Columns: []clause.Column{{Name: "station_id"}, {Name: "direction"}},
				DoUpdates: clause.AssignmentColumns([]string{
					"workday_first",
					"workday_last",
					"holiday_first",
					"holiday_last",
				}),
			}).Create(&timetable).Error; err != nil {
				return fmt.Errorf("upsert timetable %s/%s: %w", station.Name, timetable.Direction, err)
			}
		}
	}

	return nil
}

func findStationForTimetable(item TimetableData, stationByName map[string]Station, stationByPinyinKey map[string]Station) (Station, bool) {
	// 优先使用清洗后的中文站名精确匹配，这是最可靠的方式。
	stationName := normalizeStationName(item.StationTitle)
	if stationName != "" && stationName != "首末班车时刻表" {
		if station, ok := stationByName[stationName]; ok {
			return station, true
		}
		log.Printf("warn: station not found by title %s for timetable url %s", stationName, item.URL)
	}

	// 如果没有中文站名，再退回到 URL slug 与 stations.pinyin 的格式化匹配。
	slugKey, err := stationSlugKey(item.URL)
	if err != nil {
		log.Printf("skip timetable with invalid url %q: %v", item.URL, err)
		return Station{}, false
	}

	station, ok := stationByPinyinKey[slugKey]
	if !ok {
		log.Printf("warn: station not found for timetable url %s, slug key %s", item.URL, slugKey)
		return Station{}, false
	}
	return station, true
}

func loadStationsByName(tx *gorm.DB) (map[string]Station, error) {
	var stations []Station
	if err := tx.Find(&stations).Error; err != nil {
		return nil, fmt.Errorf("load stations: %w", err)
	}

	result := make(map[string]Station, len(stations))
	for _, station := range stations {
		result[station.Name] = station
	}
	return result, nil
}

func loadStationsByPinyinKey(tx *gorm.DB) (map[string]Station, error) {
	var stations []Station
	if err := tx.Find(&stations).Error; err != nil {
		return nil, fmt.Errorf("load stations: %w", err)
	}

	result := make(map[string]Station, len(stations))
	for _, station := range stations {
		result[formatStationKey(station.Pinyin)] = station
	}
	return result, nil
}

func stationSlugKey(rawURL string) (string, error) {
	parsedURL, err := url.Parse(rawURL)
	if err != nil {
		return "", err
	}

	slug := path.Base(parsedURL.Path)
	if slug == "." || slug == "/" || slug == "" {
		return "", fmt.Errorf("missing station slug")
	}

	return formatStationKey(slug), nil
}

func formatStationKey(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	value = strings.ReplaceAll(value, "-", "")
	value = strings.ReplaceAll(value, " ", "")
	return value
}
