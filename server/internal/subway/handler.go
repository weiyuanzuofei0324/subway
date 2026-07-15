package subway

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type Handler struct {
	db *gorm.DB
}

func NewHandler(db *gorm.DB) *Handler {
	return &Handler{db: db}
}

func (h *Handler) RegisterRoutes(router *gin.RouterGroup) {
	routes := router.Group("/routes")
	routes.GET("", h.listRoutes)
	routes.GET("/:lineName", h.getRoute)

	stations := router.Group("/stations")
	stations.GET("/:id", h.getStation)
}

type RouteDTO struct {
	ID       uint   `json:"id"`
	LineName string `json:"lineName"`
	Color    string `json:"color"`
}

type RouteDetailDTO struct {
	ID       uint         `json:"id"`
	LineName string       `json:"lineName"`
	Color    string       `json:"color"`
	Stations []StationDTO `json:"stations"`
}

type StationDTO struct {
	ID             uint       `json:"id"`
	Sequence       int        `json:"sequence"`
	Name           string     `json:"name"`
	Pinyin         string     `json:"pinyin"`
	Coords         string     `json:"coords"`
	TransferRoutes []RouteDTO `json:"transferRoutes"`
}

type StationDetailDTO struct {
	ID         uint           `json:"id"`
	Name       string         `json:"name"`
	Pinyin     string         `json:"pinyin"`
	Coords     string         `json:"coords"`
	Routes     []RouteDTO     `json:"routes"`
	Timetables []TimetableDTO `json:"timetables"`
}

type TimetableDTO struct {
	ID           uint   `json:"id"`
	Direction    string `json:"direction"`
	WorkdayFirst string `json:"workdayFirst"`
	WorkdayLast  string `json:"workdayLast"`
	HolidayFirst string `json:"holidayFirst"`
	HolidayLast  string `json:"holidayLast"`
}

func (h *Handler) listRoutes(c *gin.Context) {
	var routes []Route
	if err := h.db.Order("id ASC").Find(&routes).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to load routes"})
		return
	}

	items := make([]RouteDTO, 0, len(routes))
	for _, route := range routes {
		items = append(items, RouteDTO{
			ID:       route.ID,
			LineName: route.LineName,
			Color:    route.Color,
		})
	}

	c.JSON(http.StatusOK, gin.H{"routes": items})
}

func (h *Handler) getRoute(c *gin.Context) {
	var route Route
	err := h.db.
		Preload("Stations", func(db *gorm.DB) *gorm.DB {
			return db.Order("route_stations.sequence ASC")
		}).
		Preload("Stations.Station").
		Where("line_name = ?", c.Param("lineName")).
		First(&route).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"message": "route not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to load route"})
		return
	}

	stationIDs := make([]uint, 0, len(route.Stations))
	for _, link := range route.Stations {
		stationIDs = append(stationIDs, link.StationID)
	}

	transferRoutes, err := h.findTransferRoutes(route.ID, stationIDs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to load transfer routes"})
		return
	}

	stations := make([]StationDTO, 0, len(route.Stations))
	for _, link := range route.Stations {
		routes := transferRoutes[link.StationID]
		if routes == nil {
			routes = []RouteDTO{}
		}

		stations = append(stations, StationDTO{
			ID:             link.Station.ID,
			Sequence:       link.Sequence,
			Name:           link.Station.Name,
			Pinyin:         link.Station.Pinyin,
			Coords:         link.Station.Coords,
			TransferRoutes: routes,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"route": RouteDetailDTO{
			ID:       route.ID,
			LineName: route.LineName,
			Color:    route.Color,
			Stations: stations,
		},
	})
}

func (h *Handler) findTransferRoutes(routeID uint, stationIDs []uint) (map[uint][]RouteDTO, error) {
	result := make(map[uint][]RouteDTO)
	if len(stationIDs) == 0 {
		return result, nil
	}

	var links []RouteStation
	if err := h.db.
		Preload("Route").
		Where("station_id IN ? AND route_id <> ?", stationIDs, routeID).
		Order("route_id ASC").
		Find(&links).Error; err != nil {
		return nil, err
	}

	for _, link := range links {
		result[link.StationID] = append(result[link.StationID], RouteDTO{
			ID:       link.Route.ID,
			LineName: link.Route.LineName,
			Color:    link.Route.Color,
		})
	}

	return result, nil
}

func (h *Handler) getStation(c *gin.Context) {
	var station Station
	err := h.db.
		Preload("RouteLinks.Route").
		Preload("Timetables", func(db *gorm.DB) *gorm.DB {
			return db.Order("id ASC")
		}).
		First(&station, c.Param("id")).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"message": "station not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to load station"})
		return
	}

	routes := make([]RouteDTO, 0, len(station.RouteLinks))
	for _, link := range station.RouteLinks {
		routes = append(routes, RouteDTO{
			ID:       link.Route.ID,
			LineName: link.Route.LineName,
			Color:    link.Route.Color,
		})
	}

	timetables := make([]TimetableDTO, 0, len(station.Timetables))
	for _, timetable := range station.Timetables {
		timetables = append(timetables, TimetableDTO{
			ID:           timetable.ID,
			Direction:    timetable.Direction,
			WorkdayFirst: timetable.WorkdayFirst,
			WorkdayLast:  timetable.WorkdayLast,
			HolidayFirst: timetable.HolidayFirst,
			HolidayLast:  timetable.HolidayLast,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"station": StationDetailDTO{
			ID:         station.ID,
			Name:       station.Name,
			Pinyin:     station.Pinyin,
			Coords:     station.Coords,
			Routes:     routes,
			Timetables: timetables,
		},
	})
}
