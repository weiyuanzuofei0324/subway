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
