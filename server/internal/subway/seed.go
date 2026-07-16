package subway

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type SubwayData struct {
	City       string     `json:"city"`
	TotalLines int        `json:"total_lines"`
	Lines      []LineData `json:"lines"`
}

type LineData struct {
	LineName string        `json:"line_name"`
	Color    string        `json:"color"`
	Stations []StationData `json:"stations"`
}

type StationData struct {
	Sequence              int      `json:"sequence"`
	Name                  string   `json:"name"`
	NameEn                string   `json:"name_en"`
	Pinyin                string   `json:"pinyin"`
	Coords                string   `json:"coords"`
	InterDistanceKM       float64  `json:"inter_distance_km"`
	AccumulatedDistanceKM float64  `json:"accumulated_distance_km"`
	District              string   `json:"district"`
	Transfers             []string `json:"transfers"`
}

func SeedSubwayData(db *gorm.DB, jsonPath string, timetableJsonPath ...string) error {
	if len(timetableJsonPath) > 0 {
		return SeedAllSubwayData(db, jsonPath, timetableJsonPath[0])
	}
	return SeedLineData(db, jsonPath)
}

func SeedAllSubwayData(db *gorm.DB, distanceJsonPath, timetableJsonPath string) error {
	return db.Transaction(func(tx *gorm.DB) error {
		if err := seedLineDataTx(tx, distanceJsonPath); err != nil {
			return err
		}
		if err := seedTimetableDataTx(tx, timetableJsonPath); err != nil {
			return err
		}
		return nil
	})
}

func SeedLineData(db *gorm.DB, jsonPath string) error {
	return db.Transaction(func(tx *gorm.DB) error {
		return seedLineDataTx(tx, jsonPath)
	})
}

func seedLineDataTx(tx *gorm.DB, jsonPath string) error {
	data, err := os.ReadFile(jsonPath)
	if err != nil {
		return fmt.Errorf("read subway json: %w", err)
	}

	lines, err := parseLineData(data)
	if err != nil {
		return fmt.Errorf("parse subway json: %w", err)
	}

	stationCache := make(map[string]Station)

	for _, line := range lines {
		line.LineName = normalizeLineName(line.LineName)
		if line.LineName == "" {
			continue
		}

		route, err := findOrCreateRoute(tx, line)
		if err != nil {
			return err
		}

		for _, stationData := range line.Stations {
			stationData.Name = normalizeStationName(stationData.Name)
			if shouldSkipStation(stationData) {
				continue
			}

			station, ok := stationCache[stationData.Name]
			if !ok {
				station, err = findOrCreateStation(tx, stationData)
				if err != nil {
					return err
				}
				stationCache[stationData.Name] = station
			}

			link := RouteStation{
				RouteID:   route.ID,
				StationID: station.ID,
				Sequence:  stationData.Sequence,
				Distance:  stationData.InterDistanceKM,
			}
			if err := tx.Clauses(clause.OnConflict{
				Columns:   []clause.Column{{Name: "route_id"}, {Name: "station_id"}},
				DoUpdates: clause.AssignmentColumns([]string{"sequence", "distance"}),
			}).Create(&link).Error; err != nil {
				return fmt.Errorf("upsert route station %s/%s: %w", line.LineName, stationData.Name, err)
			}
		}
	}

	return nil
}

func parseLineData(data []byte) ([]LineData, error) {
	var subwayData SubwayData
	if err := json.Unmarshal(data, &subwayData); err == nil && len(subwayData.Lines) > 0 {
		return subwayData.Lines, nil
	}

	var lines []LineData
	if err := json.Unmarshal(data, &lines); err != nil {
		return nil, err
	}
	return lines, nil
}

func findOrCreateRoute(tx *gorm.DB, line LineData) (Route, error) {
	route := Route{LineName: line.LineName}
	if err := tx.Where(Route{LineName: line.LineName}).
		Attrs(Route{Color: line.Color}).
		FirstOrCreate(&route).Error; err != nil {
		return Route{}, fmt.Errorf("find or create route %s: %w", line.LineName, err)
	}

	if route.Color != line.Color {
		route.Color = line.Color
		if err := tx.Save(&route).Error; err != nil {
			return Route{}, fmt.Errorf("update route color %s: %w", line.LineName, err)
		}
	}

	return route, nil
}

func findOrCreateStation(tx *gorm.DB, stationData StationData) (Station, error) {
	station := Station{Name: stationData.Name}
	if err := tx.Where(Station{Name: stationData.Name}).
		Attrs(Station{
			NameEn: stationData.NameEn,
			Pinyin: stationPinyinOrFallback(stationData),
			Coords: stationCoordsOrFallback(stationData),
		}).
		FirstOrCreate(&station).Error; err != nil {
		return Station{}, fmt.Errorf("find or create station %s: %w", stationData.Name, err)
	}

	nextPinyin := stationPinyinOrFallback(stationData)
	nextCoords := stationCoordsOrFallback(stationData)
	changed := false
	if stationData.NameEn != "" && station.NameEn != stationData.NameEn {
		station.NameEn = stationData.NameEn
		changed = true
	}
	if nextPinyin != "" && station.Pinyin != nextPinyin {
		station.Pinyin = nextPinyin
		changed = true
	}
	if nextCoords != "" && station.Coords != nextCoords {
		station.Coords = nextCoords
		changed = true
	}
	if changed {
		if err := tx.Save(&station).Error; err != nil {
			return Station{}, fmt.Errorf("update station %s: %w", stationData.Name, err)
		}
	}

	return station, nil
}

func normalizeLineName(lineName string) string {
	lineName = strings.TrimSpace(lineName)
	lineName = strings.ReplaceAll(lineName, "号线号线", "号线")
	if lineName == "Yangluo号线" {
		return "阳逻线"
	}
	return lineName
}

func normalizeStationName(stationName string) string {
	stationName = strings.TrimSpace(stationName)
	stationName = strings.ReplaceAll(stationName, "門", "门")
	return stationName
}

func shouldSkipStation(station StationData) bool {
	name := strings.TrimSpace(station.Name)
	return name == "" || name == "Station name(Chinese)"
}

func stationPinyinOrFallback(station StationData) string {
	if strings.TrimSpace(station.Pinyin) != "" {
		return strings.TrimSpace(station.Pinyin)
	}
	return strings.TrimSpace(station.NameEn)
}

func stationCoordsOrFallback(station StationData) string {
	if strings.TrimSpace(station.Coords) != "" {
		return strings.TrimSpace(station.Coords)
	}
	return "0,0"
}
