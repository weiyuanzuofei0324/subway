import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/lib/api';

type RouteSummary = {
  id: number;
  lineName: string;
  color: string;
};

type Station = {
  id: number;
  name: string;
  pinyin: string;
  transferRoutes: RouteSummary[] | null;
};

type RouteDetail = RouteSummary & {
  stations: Station[];
};

type StationOption = Station & {
  route: RouteSummary;
};

type StationSection = {
  title: string;
  color: string;
  data: StationOption[];
};

type PickingTarget = 'from' | 'to';

type RouteStep = {
  type: 'ride' | 'transfer';
  lineName?: string;
  fromLine?: string;
  toLine?: string;
  from: string;
  to: string;
  direction?: string;
  stationNum: number;
  distance: number;
  durationMin: number;
  arriveTime: string;
};

type RoutePlan = {
  summary: {
    totalSeconds: number;
    totalTime: string;
    totalDistance: number;
    totalFare: number;
    transferCount: number;
  };
  steps: RouteStep[];
};

export default function TransferScreen() {
  const sectionListRef = useRef<SectionList<StationOption, StationSection>>(null);
  const [sections, setSections] = useState<StationSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickingTarget, setPickingTarget] = useState<PickingTarget>('from');
  const [query, setQuery] = useState('');
  const [fromStation, setFromStation] = useState<StationOption | null>(null);
  const [toStation, setToStation] = useState<StationOption | null>(null);
  const [planning, setPlanning] = useState(false);
  const [plan, setPlan] = useState<RoutePlan | null>(null);
  const [departureAt, setDepartureAt] = useState('');

  useEffect(() => {
    let mounted = true;

    async function loadStations() {
      try {
        setLoading(true);
        const { data } = await api.get<{ routes: RouteSummary[] }>('/routes');
        const routeDetails = await Promise.all(
          data.routes.map(async (route) => {
            const response = await api.get<{ route: RouteDetail }>(`/routes/${encodeURIComponent(route.lineName)}`);
            return response.data.route;
          }),
        );

        if (mounted) {
          setSections(
            routeDetails.map((route) => ({
              title: route.lineName,
              color: route.color,
              data: route.stations.map((station) => ({
                ...station,
                transferRoutes: station.transferRoutes ?? [],
                route: {
                  id: route.id,
                  lineName: route.lineName,
                  color: route.color,
                },
              })),
            })),
          );
        }
      } catch {
        if (mounted) {
          Alert.alert('加载失败', '暂时无法加载站点列表');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadStations();
    return () => {
      mounted = false;
    };
  }, []);

  const filteredSections = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) {
      return sections;
    }

    return sections
      .map((section) => ({
        ...section,
        data: section.data.filter(
          (station) => station.name.includes(keyword) || station.pinyin.toLowerCase().includes(keyword),
        ),
      }))
      .filter((section) => section.data.length > 0);
  }, [query, sections]);

  function openPicker(target: PickingTarget) {
    setPickingTarget(target);
    setQuery('');
    setPickerVisible(true);
  }

  function selectStation(station: StationOption) {
    if (pickingTarget === 'from') {
      setFromStation(station);
    } else {
      setToStation(station);
    }
    setPickerVisible(false);
  }

  async function submitSearch() {
    if (!fromStation || !toStation) {
      Alert.alert('提示', '请先选择出发站和到达站');
      return;
    }

    try {
      setPlanning(true);
      setPlan(null);
      const nextDepartureAt = currentClockTime();
      setDepartureAt(nextDepartureAt);
      const { data } = await api.get<RoutePlan>('/route', {
        params: {
          from: fromStation.name,
          to: toStation.name,
          departure_time: nextDepartureAt,
          strategy: 'fastest',
        },
      });
      setPlan(data);
    } catch {
      Alert.alert('查询失败', '暂时没有找到可用路线');
    } finally {
      setPlanning(false);
    }
  }

  function jumpToSection(index: number) {
    sectionListRef.current?.scrollToLocation({
      animated: true,
      itemIndex: 0,
      sectionIndex: index,
      viewPosition: 0,
    });
  }

  if (plan && fromStation && toStation) {
    return (
      <SafeAreaView style={styles.resultPage} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.resultContent} showsVerticalScrollIndicator={false}>
          <View style={styles.resultHeader}>
            <View style={styles.resultHeaderText}>
              <Text style={styles.resultTitle}>
                {fromStation.name} → {toStation.name}
              </Text>
              <Text style={styles.resultSubtitle}>
                {formatToday()} {departureAt} 出发
              </Text>
            </View>
            <Pressable onPress={() => setPlan(null)}>
              <Text style={styles.resultBack}>返回</Text>
            </Pressable>
          </View>

          <View style={styles.planCard}>
            <View style={styles.planSummary}>
              <Text style={styles.planTime}>
                {departureAt} → {plan.steps[plan.steps.length - 1]?.arriveTime ?? departureAt}
              </Text>
              <Text style={styles.planDuration}>{plan.summary.totalTime}</Text>
              <Text style={styles.planMeta}>
                票价 ¥{plan.summary.totalFare} · 换乘 {plan.summary.transferCount}次 · {plan.summary.totalDistance} km
              </Text>
            </View>

            <View style={styles.routeTimeline}>
              {plan.steps.map((step, index) => {
                const startTime = index === 0 ? departureAt : plan.steps[index - 1].arriveTime;
                const color = step.type === 'ride' ? lineColor(step.lineName ?? '', sections) : '#148A45';
                return (
                  <View key={`${step.type}-${index}-${step.from}-${step.to}`} style={styles.routeBlock}>
                    <View style={styles.routeTimeColumn}>
                      <Text style={styles.routeTime}>{startTime}</Text>
                      {step.type === 'ride' ? <Text style={styles.routeStationCount}>{step.stationNum}站</Text> : null}
                      <Text style={styles.routeTime}>{step.arriveTime}</Text>
                    </View>

                    <View style={styles.routeLineColumn}>
                      <View style={[styles.routeCircle, { borderColor: color }]} />
                      <View style={[styles.routeLine, { backgroundColor: color }]} />
                      <View style={[styles.routeCircle, { borderColor: color }]} />
                    </View>

                    <View style={styles.routeInfoColumn}>
                      <Text style={styles.routeStationName}>{step.from}</Text>
                      <View style={styles.routeInstruction}>
                        {step.type === 'ride' ? (
                          <>
                            <Text style={styles.routeLineName}>{step.lineName}</Text>
                            <Text style={styles.routeDirection}>{step.direction}</Text>
                            <Text style={styles.routeDetail}>
                              {step.durationMin}分钟 · {step.distance} km
                            </Text>
                          </>
                        ) : (
                          <>
                            <Text style={styles.routeLineName}>站内换乘</Text>
                            <View style={styles.routeTransferBadges}>
                              {step.fromLine ? (
                                <View style={[styles.transferBadge, { backgroundColor: lineColor(step.fromLine, sections) }]}>
                                  <Text style={styles.transferBadgeText}>{formatLineNumber(step.fromLine)}</Text>
                                </View>
                              ) : null}
                              <Text style={styles.routeDirection}>→</Text>
                              {step.toLine ? (
                                <View style={[styles.transferBadge, { backgroundColor: lineColor(step.toLine, sections) }]}>
                                  <Text style={styles.transferBadgeText}>{formatLineNumber(step.toLine)}</Text>
                                </View>
                              ) : null}
                            </View>
                            <Text style={styles.routeDetail}>{step.durationMin}分钟</Text>
                          </>
                        )}
                      </View>
                      <Text style={styles.routeStationName}>{step.to}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.stationPanel}>
          <Pressable style={styles.stationField} onPress={() => openPicker('from')}>
            <Text style={[styles.stationLabel, fromStation && styles.stationValue]}>{fromStation?.name ?? '出发'}</Text>
          </Pressable>
          <View style={styles.swapBadge}>
            <Text style={styles.swapText}>⇅</Text>
          </View>
          <Pressable style={styles.stationField} onPress={() => openPicker('to')}>
            <Text style={[styles.stationLabel, toStation && styles.stationValue]}>{toStation?.name ?? '到达'}</Text>
          </Pressable>
        </View>

        <View style={styles.nowPanel}>
          <Text style={styles.nowLabel}>时刻</Text>
          <Text style={styles.nowText}>现在出发</Text>
        </View>

        <Pressable
          disabled={planning}
          style={({ pressed }) => [styles.searchButton, (pressed || planning) && styles.pressed]}
          onPress={submitSearch}>
          <Text style={styles.searchButtonText}>{planning ? '查询中' : '换乘查询'}</Text>
        </Pressable>

        {plan ? (
          <View style={styles.resultPanel}>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{plan.summary.totalTime}</Text>
                <Text style={styles.summaryLabel}>全程时间</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{plan.summary.totalDistance} km</Text>
                <Text style={styles.summaryLabel}>距离</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{plan.summary.totalFare} 元</Text>
                <Text style={styles.summaryLabel}>票价</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{plan.summary.transferCount} 次</Text>
                <Text style={styles.summaryLabel}>换乘</Text>
              </View>
            </View>

            <View style={styles.stepList}>
              {plan.steps.map((step, index) => (
                <View key={`${step.type}-${index}-${step.from}-${step.to}`} style={styles.stepCard}>
                  <View style={[styles.stepDot, step.type === 'transfer' && styles.transferDot]}>
                    <Text style={styles.stepDotText}>{index + 1}</Text>
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={styles.stepTitle}>
                      {step.type === 'transfer' ? '站内换乘' : `${step.lineName} ${step.direction ?? ''}`}
                    </Text>
                    {step.type === 'transfer' ? (
                      <View style={styles.stepTransferLines}>
                        {step.fromLine ? (
                          <View style={[styles.stepLineBadge, { backgroundColor: lineColor(step.fromLine, sections) }]}>
                            <Text style={styles.stepLineBadgeText}>{formatLineNumber(step.fromLine)}</Text>
                          </View>
                        ) : null}
                        <Text style={styles.stepTransferArrow}>→</Text>
                        {step.toLine ? (
                          <View style={[styles.stepLineBadge, { backgroundColor: lineColor(step.toLine, sections) }]}>
                            <Text style={styles.stepLineBadgeText}>{formatLineNumber(step.toLine)}</Text>
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                    <Text style={styles.stepMain}>
                      {step.from} → {step.to}
                    </Text>
                    <Text style={styles.stepMeta}>
                      {step.type === 'ride' ? `${step.stationNum} 站 · ${step.distance} km · ` : ''}
                      约 {step.durationMin} 分钟 · 到达 {step.arriveTime}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <Modal animationType="slide" visible={pickerVisible} onRequestClose={() => setPickerVisible(false)}>
        <SafeAreaView style={styles.pickerPage} edges={['top', 'left', 'right']}>
          <View style={styles.searchRow}>
            <TextInput
              autoFocus
              placeholder="搜索车站..."
              placeholderTextColor="#64748B"
              value={query}
              onChangeText={setQuery}
              style={styles.searchInput}
            />
            <Pressable style={styles.closeButton} onPress={() => setPickerVisible(false)}>
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color="#0F766E" />
              <Text style={styles.loadingText}>正在加载站点...</Text>
            </View>
          ) : (
            <View style={styles.pickerBody}>
              <SectionList
                ref={sectionListRef}
                sections={filteredSections}
                keyExtractor={(item) => `${item.route.id}-${item.id}`}
                stickySectionHeadersEnabled={false}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.stationListContent}
                renderSectionHeader={({ section }) => (
                  <Text style={[styles.sectionTitle, { color: section.color }]}>{section.title}</Text>
                )}
                renderItem={({ item }) => (
                  <Pressable style={({ pressed }) => [styles.stationItem, pressed && styles.stationItemPressed]} onPress={() => selectStation(item)}>
                    <Text style={styles.stationItemText}>{item.name}</Text>
                    {getTransferRoutes(item).map((route) => (
                      <View key={route.id} style={[styles.transferBadge, { backgroundColor: route.color }]}>
                        <Text style={styles.transferBadgeText}>{formatLineNumber(route.lineName)}</Text>
                      </View>
                    ))}
                  </Pressable>
                )}
                getItemLayout={(_, index) => ({
                  length: 74,
                  offset: 74 * index,
                  index,
                })}
              />

              <View style={styles.lineIndex}>
                {filteredSections.map((section, index) => (
                  <Pressable key={section.title} onPress={() => jumpToSection(index)} hitSlop={6}>
                    <Text style={styles.lineIndexText}>{formatLineNumber(section.title)}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function getTransferRoutes(station: Station) {
  return station.transferRoutes ?? [];
}

function formatLineNumber(lineName: string) {
  if (lineName === '阳逻线') {
    return 'YL';
  }
  return lineName.replace('号线', '').replace('线', '');
}

function lineColor(lineName: string, sections: StationSection[]) {
  return sections.find((section) => section.title === lineName)?.color ?? '#0349B8';
}

function formatToday() {
  const now = new Date();
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${weekdays[now.getDay()]}`;
}

function currentClockTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  resultPage: {
    backgroundColor: '#F7F9FD',
    flex: 1,
  },
  resultContent: {
    paddingBottom: 34,
  },
  resultHeader: {
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 26,
    paddingBottom: 24,
  },
  resultHeaderText: {
    flex: 1,
    paddingRight: 16,
  },
  resultTitle: {
    color: '#111827',
    fontSize: 28,
    fontWeight: '900',
  },
  resultSubtitle: {
    color: '#64748B',
    fontSize: 18,
    marginTop: 12,
  },
  resultBack: {
    color: '#006CFF',
    fontSize: 22,
    fontWeight: '900',
  },
  planCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5EAF0',
    borderRadius: 8,
    borderWidth: 1,
    marginHorizontal: 0,
    marginTop: 22,
    overflow: 'hidden',
  },
  planSummary: {
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  planTime: {
    color: '#111827',
    fontSize: 30,
    fontWeight: '900',
  },
  planDuration: {
    color: '#64748B',
    fontSize: 20,
    marginTop: 8,
  },
  planMeta: {
    color: '#64748B',
    fontSize: 20,
    marginTop: 12,
  },
  routeTimeline: {
    borderTopColor: '#EEF2F6',
    borderTopWidth: 1,
  },
  routeBlock: {
    backgroundColor: '#F8FAFC',
    flexDirection: 'row',
    minHeight: 192,
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  routeTimeColumn: {
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    width: 82,
  },
  routeTime: {
    color: '#111827',
    fontSize: 24,
    fontWeight: '900',
  },
  routeStationCount: {
    color: '#006CFF',
    fontSize: 18,
    fontWeight: '900',
  },
  routeLineColumn: {
    alignItems: 'center',
    marginRight: 28,
    width: 26,
  },
  routeCircle: {
    backgroundColor: '#FFFFFF',
    borderRadius: 13,
    borderWidth: 4,
    height: 26,
    width: 26,
  },
  routeLine: {
    flex: 1,
    width: 5,
  },
  routeInfoColumn: {
    flex: 1,
    justifyContent: 'space-between',
  },
  routeStationName: {
    color: '#111827',
    fontSize: 26,
    fontWeight: '900',
  },
  routeInstruction: {
    paddingVertical: 16,
  },
  routeLineName: {
    color: '#111827',
    fontSize: 22,
    fontWeight: '900',
  },
  routeDirection: {
    color: '#64748B',
    fontSize: 19,
    marginTop: 8,
  },
  routeDetail: {
    color: '#64748B',
    fontSize: 19,
    marginTop: 8,
  },
  routeTransferBadges: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  content: {
    paddingBottom: 34,
    paddingHorizontal: 30,
    paddingTop: 86,
  },
  stationPanel: {
    backgroundColor: '#ECEEF4',
    borderRadius: 8,
    overflow: 'hidden',
  },
  stationField: {
    height: 92,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  stationLabel: {
    color: '#8A96A3',
    fontSize: 28,
    fontWeight: '900',
  },
  stationValue: {
    color: '#111827',
  },
  swapBadge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    marginLeft: 32,
    marginVertical: -18,
    width: 36,
    zIndex: 1,
  },
  swapText: {
    color: '#9AA5B1',
    fontSize: 24,
    fontWeight: '900',
  },
  nowPanel: {
    alignItems: 'center',
    backgroundColor: '#ECEEF4',
    borderRadius: 8,
    flexDirection: 'row',
    height: 90,
    justifyContent: 'space-between',
    marginTop: 24,
    paddingHorizontal: 24,
  },
  nowLabel: {
    color: '#8A96A3',
    fontSize: 26,
    fontWeight: '900',
  },
  nowText: {
    color: '#111827',
    fontSize: 28,
    fontWeight: '900',
  },
  searchButton: {
    alignItems: 'center',
    backgroundColor: '#2FB5A0',
    borderRadius: 8,
    height: 90,
    justifyContent: 'center',
    marginTop: 24,
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.72,
  },
  pickerPage: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  searchRow: {
    alignItems: 'center',
    borderBottomColor: '#ECEFF3',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 18,
    paddingBottom: 24,
    paddingHorizontal: 24,
    paddingTop: 18,
  },
  searchInput: {
    backgroundColor: '#ECEEF4',
    borderRadius: 8,
    color: '#111827',
    flex: 1,
    fontSize: 24,
    height: 72,
    paddingHorizontal: 24,
  },
  closeButton: {
    alignItems: 'center',
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  closeText: {
    color: '#747B84',
    fontSize: 48,
    fontWeight: '300',
    lineHeight: 52,
  },
  loadingBox: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  loadingText: {
    color: '#64748B',
    fontSize: 16,
    marginTop: 10,
  },
  pickerBody: {
    flex: 1,
  },
  stationListContent: {
    paddingBottom: 36,
    paddingLeft: 24,
    paddingRight: 70,
    paddingTop: 28,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 8,
    marginTop: 6,
    paddingHorizontal: 24,
  },
  stationItem: {
    alignItems: 'center',
    borderBottomColor: '#ECEFF3',
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 74,
    paddingHorizontal: 24,
  },
  stationItemPressed: {
    backgroundColor: '#F8FAFC',
  },
  stationItemText: {
    color: '#1F2937',
    flex: 1,
    fontSize: 26,
  },
  transferBadge: {
    alignItems: 'center',
    borderRadius: 15,
    height: 30,
    justifyContent: 'center',
    marginLeft: 8,
    minWidth: 30,
    paddingHorizontal: 8,
  },
  transferBadgeText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  lineIndex: {
    gap: 10,
    position: 'absolute',
    right: 16,
    top: 310,
  },
  lineIndexText: {
    color: '#006CFF',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  resultPanel: {
    marginTop: 28,
  },
  summaryGrid: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 14,
  },
  summaryItem: {
    paddingVertical: 10,
    width: '50%',
  },
  summaryValue: {
    color: '#111827',
    fontSize: 22,
    fontWeight: '900',
  },
  summaryLabel: {
    color: '#7B8794',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  stepList: {
    gap: 12,
    marginTop: 18,
  },
  stepCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5EAF0',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 14,
  },
  stepDot: {
    alignItems: 'center',
    backgroundColor: '#2FB5A0',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    marginRight: 12,
    width: 28,
  },
  transferDot: {
    backgroundColor: '#64748B',
  },
  stepDotText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '900',
  },
  stepMain: {
    color: '#1F2937',
    fontSize: 17,
    fontWeight: '800',
    marginTop: 8,
  },
  stepMeta: {
    color: '#64748B',
    fontSize: 14,
    marginTop: 6,
  },
  stepTransferLines: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  stepLineBadge: {
    alignItems: 'center',
    backgroundColor: '#0349B8',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    minWidth: 28,
    paddingHorizontal: 8,
  },
  stepLineBadgeText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  stepTransferArrow: {
    color: '#64748B',
    fontSize: 18,
    fontWeight: '900',
  },
});
