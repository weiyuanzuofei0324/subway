package subway

import (
	"encoding/json"
	"fmt"
	"os"

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
	Sequence int    `json:"sequence"`
	Name     string `json:"name"`
	Pinyin   string `json:"pinyin"`
	Coords   string `json:"coords"`
}

func SeedSubwayData(db *gorm.DB, jsonPath string) error {
	data, err := os.ReadFile(jsonPath)
	if err != nil {
		return fmt.Errorf("read subway json: %w", err)
	}

	var subwayData SubwayData
	if err := json.Unmarshal(data, &subwayData); err != nil {
		return fmt.Errorf("parse subway json: %w", err)
	}

	return db.Transaction(func(tx *gorm.DB) error {
		stationCache := make(map[string]Station)

		for _, line := range subwayData.Lines {
			route, err := findOrCreateRoute(tx, line)
			if err != nil {
				return err
			}

			for _, stationData := range line.Stations {
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
				}
				if err := tx.Clauses(clause.OnConflict{
					Columns:   []clause.Column{{Name: "route_id"}, {Name: "station_id"}},
					DoUpdates: clause.AssignmentColumns([]string{"sequence"}),
				}).Create(&link).Error; err != nil {
					return fmt.Errorf("upsert route station %s/%s: %w", line.LineName, stationData.Name, err)
				}
			}
		}

		return nil
	})
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
			Pinyin: stationData.Pinyin,
			Coords: stationData.Coords,
		}).
		FirstOrCreate(&station).Error; err != nil {
		return Station{}, fmt.Errorf("find or create station %s: %w", stationData.Name, err)
	}

	if station.Pinyin != stationData.Pinyin || station.Coords != stationData.Coords {
		station.Pinyin = stationData.Pinyin
		station.Coords = stationData.Coords
		if err := tx.Save(&station).Error; err != nil {
			return Station{}, fmt.Errorf("update station %s: %w", stationData.Name, err)
		}
	}

	return station, nil
}
