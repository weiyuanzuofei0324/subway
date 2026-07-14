package subway

type Route struct {
	ID       uint           `gorm:"primaryKey" json:"id"`
	LineName string         `gorm:"column:line_name;size:64;uniqueIndex;not null" json:"lineName"`
	Color    string         `gorm:"size:16;not null" json:"color"`
	Stations []RouteStation `gorm:"foreignKey:RouteID" json:"stations,omitempty"`
}

type Station struct {
	ID         uint           `gorm:"primaryKey" json:"id"`
	Name       string         `gorm:"size:64;uniqueIndex;not null" json:"name"`
	Pinyin     string         `gorm:"size:128;not null" json:"pinyin"`
	Coords     string         `gorm:"size:64;not null" json:"coords"`
	RouteLinks []RouteStation `gorm:"foreignKey:StationID" json:"routeLinks,omitempty"`
}

type RouteStation struct {
	RouteID   uint `gorm:"primaryKey;autoIncrement:false" json:"routeId"`
	StationID uint `gorm:"primaryKey;autoIncrement:false" json:"stationId"`
	Sequence  int  `gorm:"not null;index" json:"sequence"`

	Route   Route   `gorm:"foreignKey:RouteID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"route,omitempty"`
	Station Station `gorm:"foreignKey:StationID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"station,omitempty"`
}
