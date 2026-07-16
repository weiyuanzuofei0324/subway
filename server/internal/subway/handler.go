package subway

import (
	"errors"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type Handler struct {
	db     *gorm.DB
	engine *Engine
}

func NewHandler(db *gorm.DB) *Handler {
	engine, err := NewEngine(db)
	if err != nil {
		return &Handler{db: db}
	}
	return &Handler{db: db, engine: engine}
}

func (h *Handler) RegisterRoutes(router *gin.RouterGroup) {
	router.GET("/route", h.findRoute)

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
	Routes         []RouteDTO `json:"routes"`
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

func (h *Handler) findRoute(c *gin.Context) {
	if h.engine == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"message": "route engine is not ready"})
		return
	}

	from := c.Query("from")
	to := c.Query("to")
	departureTime := c.DefaultQuery("departure_time", "08:00")
	strategy := c.DefaultQuery("strategy", "fastest")
	if strategy != "fastest" && strategy != "least_transfers" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "strategy must be fastest or least_transfers"})
		return
	}

	steps, summary, err := h.engine.FindRoute(from, to, departureTime, strategy)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"summary": summary,
		"steps":   steps,
	})
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
		Preload("Stations.Station.Routes").
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
	log.Printf("[route-detail] route=%s id=%d station_count=%d", route.LineName, route.ID, len(route.Stations))

	stations := make([]StationDTO, 0, len(route.Stations))
	for _, link := range route.Stations {
		routes := routeDTOs(link.Station.Routes)
		transferRoutes := transferRouteDTOs(link.Station.Routes, route.ID)
		log.Printf(
			"[route-detail] station=%s station_id=%d routes=%d route_names=%v transfer_routes=%d transfer_names=%v",
			link.Station.Name,
			link.Station.ID,
			len(routes),
			routeNames(routes),
			len(transferRoutes),
			routeNames(transferRoutes),
		)

		stations = append(stations, StationDTO{
			ID:             link.Station.ID,
			Sequence:       link.Sequence,
			Name:           link.Station.Name,
			Pinyin:         link.Station.Pinyin,
			Coords:         link.Station.Coords,
			Routes:         routes,
			TransferRoutes: transferRoutes,
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

func (h *Handler) getStation(c *gin.Context) {
	var station Station
	err := h.db.
		Preload("Routes").
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

	routes := routeDTOs(station.Routes)
	if len(routes) == 0 {
		for _, link := range station.RouteLinks {
			routes = append(routes, RouteDTO{
				ID:       link.Route.ID,
				LineName: link.Route.LineName,
				Color:    link.Route.Color,
			})
		}
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

func routeDTOs(routes []Route) []RouteDTO {
	items := make([]RouteDTO, 0, len(routes))
	for _, route := range routes {
		items = append(items, RouteDTO{
			ID:       route.ID,
			LineName: route.LineName,
			Color:    route.Color,
		})
	}
	return items
}

func transferRouteDTOs(routes []Route, currentRouteID uint) []RouteDTO {
	items := make([]RouteDTO, 0, len(routes))
	for _, route := range routes {
		if route.ID == currentRouteID {
			continue
		}
		items = append(items, RouteDTO{
			ID:       route.ID,
			LineName: route.LineName,
			Color:    route.Color,
		})
	}
	return items
}

func routeNames(routes []RouteDTO) []string {
	names := make([]string, 0, len(routes))
	for _, route := range routes {
		names = append(names, route.LineName)
	}
	return names
}
