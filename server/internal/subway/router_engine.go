package subway

import (
	"container/heap"
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"

	"gorm.io/gorm"
)

const (
	trainSpeedKMH       = 50.0
	stopSeconds         = 30.0
	transferSeconds     = 300.0
	leastTransferWeight = 36000.0
)

type Engine struct {
	nodes        map[string]*graphNode
	adjacency    map[string][]graphEdge
	stationNodes map[string][]string
	stations     map[uint]Station
	timetables   map[uint][]Timetable
}

type graphNode struct {
	ID      string
	Station Station
	Route   Route
}

type graphEdge struct {
	From       string
	To         string
	Route      Route
	Distance   float64
	Seconds    float64
	Transfer   bool
	Direction  string
	StationNum int
}

type Step struct {
	Type        string  `json:"type"`
	LineName    string  `json:"lineName,omitempty"`
	FromLine    string  `json:"fromLine,omitempty"`
	ToLine      string  `json:"toLine,omitempty"`
	From        string  `json:"from"`
	To          string  `json:"to"`
	Direction   string  `json:"direction,omitempty"`
	StationNum  int     `json:"stationNum"`
	Distance    float64 `json:"distance"`
	DurationMin int     `json:"durationMin"`
	ArriveTime  string  `json:"arriveTime"`
}

type Summary struct {
	TotalSeconds  int     `json:"totalSeconds"`
	TotalTime     string  `json:"totalTime"`
	TotalDistance float64 `json:"totalDistance"`
	TotalFare     int     `json:"totalFare"`
	TransferCount int     `json:"transferCount"`
}

func NewEngine(db *gorm.DB) (*Engine, error) {
	engine := &Engine{
		nodes:        map[string]*graphNode{},
		adjacency:    map[string][]graphEdge{},
		stationNodes: map[string][]string{},
		stations:     map[uint]Station{},
		timetables:   map[uint][]Timetable{},
	}

	var stations []Station
	if err := db.Find(&stations).Error; err != nil {
		return nil, fmt.Errorf("load stations for engine: %w", err)
	}
	for _, station := range stations {
		engine.stations[station.ID] = station
	}

	var timetables []Timetable
	if err := db.Find(&timetables).Error; err != nil {
		return nil, fmt.Errorf("load timetables for engine: %w", err)
	}
	for _, timetable := range timetables {
		engine.timetables[timetable.StationID] = append(engine.timetables[timetable.StationID], timetable)
	}

	var routes []Route
	if err := db.Preload("Stations", func(tx *gorm.DB) *gorm.DB {
		return tx.Order("route_stations.sequence ASC")
	}).Preload("Stations.Station").Find(&routes).Error; err != nil {
		return nil, fmt.Errorf("load routes for engine: %w", err)
	}

	for _, route := range routes {
		engine.addRoute(route)
	}
	engine.addTransferEdges()
	return engine, nil
}

func (e *Engine) addRoute(route Route) {
	for _, link := range route.Stations {
		nodeID := virtualNodeID(link.StationID, route.ID)
		e.nodes[nodeID] = &graphNode{ID: nodeID, Station: link.Station, Route: route}
		e.stationNodes[link.Station.Name] = append(e.stationNodes[link.Station.Name], nodeID)
	}

	for i := 0; i < len(route.Stations)-1; i++ {
		current := route.Stations[i]
		next := route.Stations[i+1]
		distance := next.Distance
		if distance <= 0 {
			distance = current.Distance
		}
		seconds := distance/trainSpeedKMH*3600 + stopSeconds

		forwardDirection := route.Stations[len(route.Stations)-1].Station.Name + "方向"
		backwardDirection := route.Stations[0].Station.Name + "方向"
		fromID := virtualNodeID(current.StationID, route.ID)
		toID := virtualNodeID(next.StationID, route.ID)
		e.adjacency[fromID] = append(e.adjacency[fromID], graphEdge{
			From: fromID, To: toID, Route: route, Distance: distance, Seconds: seconds, Direction: forwardDirection, StationNum: 1,
		})
		e.adjacency[toID] = append(e.adjacency[toID], graphEdge{
			From: toID, To: fromID, Route: route, Distance: distance, Seconds: seconds, Direction: backwardDirection, StationNum: 1,
		})
	}
}

func (e *Engine) addTransferEdges() {
	for _, nodeIDs := range e.stationNodes {
		if len(nodeIDs) < 2 {
			continue
		}
		for _, from := range nodeIDs {
			for _, to := range nodeIDs {
				if from == to {
					continue
				}
				e.adjacency[from] = append(e.adjacency[from], graphEdge{
					From: from, To: to, Seconds: transferSeconds, Transfer: true,
				})
			}
		}
	}
}

func (e *Engine) FindRoute(from, to string, departureTime string, strategy string) ([]Step, Summary, error) {
	if strings.TrimSpace(from) == "" || strings.TrimSpace(to) == "" {
		return nil, Summary{}, errors.New("from and to are required")
	}
	startNodes := e.stationNodes[from]
	targetNodes := e.stationNodes[to]
	if len(startNodes) == 0 || len(targetNodes) == 0 {
		return nil, Summary{}, errors.New("station not found")
	}
	if from == to {
		return nil, Summary{}, errors.New("from and to cannot be the same")
	}

	departureMinutes, err := parseClockMinutes(departureTime)
	if err != nil {
		return nil, Summary{}, err
	}
	targetSet := map[string]bool{}
	for _, nodeID := range targetNodes {
		targetSet[nodeID] = true
	}

	dist := map[string]float64{}
	prev := map[string]graphEdge{}
	queue := &priorityQueue{}
	heap.Init(queue)

	for _, nodeID := range startNodes {
		dist[nodeID] = 0
		heap.Push(queue, &queueItem{nodeID: nodeID, priority: e.heuristicSeconds(nodeID, targetNodes)})
	}

	var endNode string
	for queue.Len() > 0 {
		item := heap.Pop(queue).(*queueItem)
		if targetSet[item.nodeID] {
			endNode = item.nodeID
			break
		}

		for _, edge := range e.adjacency[item.nodeID] {
			edgeSeconds := edge.Seconds
			if edge.Transfer && strategy == "least_transfers" {
				edgeSeconds = leastTransferWeight
			}
			nextCost := dist[item.nodeID] + edgeSeconds
			if !edge.Transfer && e.exceedsLastTrain(edge, departureMinutes+int(math.Round(dist[item.nodeID]))) {
				continue
			}
			if old, ok := dist[edge.To]; ok && old <= nextCost {
				continue
			}
			dist[edge.To] = nextCost
			prev[edge.To] = edge
			heap.Push(queue, &queueItem{nodeID: edge.To, priority: nextCost + e.heuristicSeconds(edge.To, targetNodes)})
		}
	}
	if endNode == "" {
		return nil, Summary{}, errors.New("no route found")
	}

	edges := backtrackEdges(prev, startNodes, endNode)
	steps, summary := e.edgesToSteps(edges, departureMinutes)
	return steps, summary, nil
}

func (e *Engine) exceedsLastTrain(edge graphEdge, currentAbsoluteMinutes int) bool {
	fromNode := e.nodes[edge.From]
	if fromNode == nil {
		return false
	}
	for _, timetable := range e.timetables[fromNode.Station.ID] {
		if timetable.Direction != edge.Direction {
			continue
		}
		last, err := parseClockMinutes(timetable.WorkdayLast)
		if err != nil {
			return false
		}
		current := currentAbsoluteMinutes % (24 * 60)
		if last < 3*60 {
			last += 24 * 60
		}
		if current < 3*60 {
			current += 24 * 60
		}
		return current > last
	}
	return false
}

func (e *Engine) edgesToSteps(edges []graphEdge, departureMinutes int) ([]Step, Summary) {
	steps := []Step{}
	currentMinutes := departureMinutes
	totalSeconds := 0.0
	totalDistance := 0.0
	transferCount := 0

	for i := 0; i < len(edges); {
		edge := edges[i]
		if edge.Transfer {
			currentMinutes += int(math.Round(edge.Seconds / 60))
			totalSeconds += edge.Seconds
			transferCount++
			fromNode := e.nodes[edge.From]
			toNode := e.nodes[edge.To]
			steps = append(steps, Step{
				Type: "transfer", From: fromNode.Station.Name, To: toNode.Station.Name,
				FromLine: fromNode.Route.LineName, ToLine: toNode.Route.LineName,
				DurationMin: int(math.Round(edge.Seconds / 60)), ArriveTime: formatClockMinutes(currentMinutes),
			})
			i++
			continue
		}

		lineName := edge.Route.LineName
		direction := edge.Direction
		startNode := e.nodes[edge.From]
		endEdge := edge
		stationNum := 0
		distance := 0.0
		seconds := 0.0
		j := i
		for j < len(edges) && !edges[j].Transfer && edges[j].Route.ID == edge.Route.ID && edges[j].Direction == direction {
			endEdge = edges[j]
			stationNum++
			distance += edges[j].Distance
			seconds += edges[j].Seconds
			j++
		}
		currentMinutes += int(math.Round(seconds / 60))
		totalSeconds += seconds
		totalDistance += distance
		endNode := e.nodes[endEdge.To]
		steps = append(steps, Step{
			Type: "ride", LineName: lineName, From: startNode.Station.Name, To: endNode.Station.Name,
			Direction: direction, StationNum: stationNum, Distance: roundDistance(distance),
			DurationMin: int(math.Round(seconds / 60)), ArriveTime: formatClockMinutes(currentMinutes),
		})
		i = j
	}

	return steps, Summary{
		TotalSeconds:  int(math.Round(totalSeconds)),
		TotalTime:     formatDuration(totalSeconds),
		TotalDistance: roundDistance(totalDistance),
		TotalFare:     fareForDistance(totalDistance),
		TransferCount: transferCount,
	}
}

func (e *Engine) heuristicSeconds(nodeID string, targetNodes []string) float64 {
	node := e.nodes[nodeID]
	if node == nil {
		return 0
	}
	minDistance := 0.0
	for i, targetID := range targetNodes {
		target := e.nodes[targetID]
		if target == nil {
			continue
		}
		distance := haversineKM(node.Station.Coords, target.Station.Coords)
		if i == 0 || distance < minDistance {
			minDistance = distance
		}
	}
	return minDistance / trainSpeedKMH * 3600
}

func backtrackEdges(prev map[string]graphEdge, startNodes []string, endNode string) []graphEdge {
	startSet := map[string]bool{}
	for _, nodeID := range startNodes {
		startSet[nodeID] = true
	}
	edges := []graphEdge{}
	for !startSet[endNode] {
		edge := prev[endNode]
		edges = append(edges, edge)
		endNode = edge.From
	}
	for i, j := 0, len(edges)-1; i < j; i, j = i+1, j-1 {
		edges[i], edges[j] = edges[j], edges[i]
	}
	return edges
}

func virtualNodeID(stationID, routeID uint) string {
	return fmt.Sprintf("%d_%d", stationID, routeID)
}

func parseClockMinutes(value string) (int, error) {
	if strings.TrimSpace(value) == "" {
		return 0, errors.New("departure_time is required")
	}
	parts := strings.Split(value, ":")
	if len(parts) != 2 {
		return 0, errors.New("invalid time format, expected HH:mm")
	}
	hour, err := strconv.Atoi(parts[0])
	if err != nil {
		return 0, err
	}
	minute, err := strconv.Atoi(parts[1])
	if err != nil {
		return 0, err
	}
	return hour*60 + minute, nil
}

func formatClockMinutes(value int) string {
	value = value % (24 * 60)
	return fmt.Sprintf("%02d:%02d", value/60, value%60)
}

func formatDuration(seconds float64) string {
	minutes := int(math.Round(seconds / 60))
	if minutes < 60 {
		return fmt.Sprintf("%d分钟", minutes)
	}
	return fmt.Sprintf("%d小时%d分钟", minutes/60, minutes%60)
}

func fareForDistance(distance float64) int {
	switch {
	case distance <= 9:
		return 2
	case distance <= 14:
		return 3
	case distance <= 21:
		return 4
	case distance <= 30:
		return 5
	case distance <= 41:
		return 6
	case distance <= 54:
		return 7
	case distance <= 69:
		return 8
	default:
		return 9
	}
}

func roundDistance(value float64) float64 {
	return math.Round(value*100) / 100
}

func haversineKM(a, b string) float64 {
	lon1, lat1, ok1 := parseCoords(a)
	lon2, lat2, ok2 := parseCoords(b)
	if !ok1 || !ok2 || (lon1 == 0 && lat1 == 0) || (lon2 == 0 && lat2 == 0) {
		return 0
	}
	const earthRadius = 6371.0
	dLat := degreesToRadians(lat2 - lat1)
	dLon := degreesToRadians(lon2 - lon1)
	x := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(degreesToRadians(lat1))*math.Cos(degreesToRadians(lat2))*math.Sin(dLon/2)*math.Sin(dLon/2)
	return earthRadius * 2 * math.Atan2(math.Sqrt(x), math.Sqrt(1-x))
}

func parseCoords(coords string) (float64, float64, bool) {
	parts := strings.Split(coords, ",")
	if len(parts) != 2 {
		return 0, 0, false
	}
	lon, err := strconv.ParseFloat(strings.TrimSpace(parts[0]), 64)
	if err != nil {
		return 0, 0, false
	}
	lat, err := strconv.ParseFloat(strings.TrimSpace(parts[1]), 64)
	if err != nil {
		return 0, 0, false
	}
	return lon, lat, true
}

func degreesToRadians(value float64) float64 {
	return value * math.Pi / 180
}

type queueItem struct {
	nodeID   string
	priority float64
	index    int
}

type priorityQueue []*queueItem

func (pq priorityQueue) Len() int { return len(pq) }
func (pq priorityQueue) Less(i, j int) bool {
	return pq[i].priority < pq[j].priority
}
func (pq priorityQueue) Swap(i, j int) {
	pq[i], pq[j] = pq[j], pq[i]
	pq[i].index = i
	pq[j].index = j
}
func (pq *priorityQueue) Push(x any) {
	item := x.(*queueItem)
	item.index = len(*pq)
	*pq = append(*pq, item)
}
func (pq *priorityQueue) Pop() any {
	old := *pq
	item := old[len(old)-1]
	*pq = old[:len(old)-1]
	return item
}
