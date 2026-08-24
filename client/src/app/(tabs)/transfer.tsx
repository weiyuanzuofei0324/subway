import { useEffect, useMemo, useState } from 'react';
import { SymbolView } from 'expo-symbols';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
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
  const [sections, setSections] = useState<StationSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickingTarget, setPickingTarget] = useState<PickingTarget>('from');
  const [selectedLineName, setSelectedLineName] = useState('');
  const [query, setQuery] = useState('');
  const [fromStation, setFromStation] = useState<StationOption | null>(null);
  const [toStation, setToStation] = useState<StationOption | null>(null);
  const [planning, setPlanning] = useState(false);
  const [plan, setPlan] = useState<RoutePlan | null>(null);
  const [departureAt, setDepartureAt] = useState('');
  const canSubmit = Boolean(fromStation && toStation);

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
  const pickerStationCount = useMemo(() => {
    const stationIds = new Set<number>();
    sections.forEach((section) => {
      section.data.forEach((station) => stationIds.add(station.id));
    });
    return stationIds.size;
  }, [sections]);
  const activeLineName = filteredSections.some((section) => section.title === selectedLineName)
    ? selectedLineName
    : filteredSections[0]?.title || '';
  const pickerStations = useMemo(() => {
    const stationIds = new Set<number>();
    return filteredSections.flatMap((section) => section.data).filter((station) => {
      if (stationIds.has(station.id)) {
        return false;
      }
      stationIds.add(station.id);
      return true;
    });
  }, [filteredSections]);

  function openPicker(target: PickingTarget) {
    setPickingTarget(target);
    setQuery('');
    setSelectedLineName(sections[0]?.title ?? '');
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

  // Swaps the selected terminals from the route planner controls.
  function swapSelectedStations() {
    setFromStation(toStation);
    setToStation(fromStation);
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
        <Text style={styles.pageTitle}>换乘规划</Text>

        <View style={styles.stationCard}>
          <Pressable style={styles.stationRowControl} onPress={() => openPicker('from')}>
            <View style={styles.stationLead}>
              <View style={[styles.stationDotControl, styles.startDot]} />
              <Text style={styles.stationRole}>起点</Text>
              <Text style={[styles.stationPlaceholder, fromStation && styles.stationPicked]} numberOfLines={1}>
                {fromStation?.name ?? '请选择站点'}
              </Text>
            </View>
            <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={28} tintColor="#9A9AA1" />
          </Pressable>

          <View style={styles.stationDivider} />

          <Pressable style={styles.stationRowControl} onPress={() => openPicker('to')}>
            <View style={styles.stationLead}>
              <View style={[styles.stationDotControl, styles.endDot]} />
              <Text style={styles.stationRole}>终点</Text>
              <Text style={[styles.stationPlaceholder, toStation && styles.stationPicked]} numberOfLines={1}>
                {toStation?.name ?? '请选择站点'}
              </Text>
            </View>
            <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={28} tintColor="#9A9AA1" />
          </Pressable>
        </View>

        <View style={styles.actionRow}>
          <Pressable
            style={({ pressed }) => [styles.swapButton, pressed && styles.pressed]}
            onPress={swapSelectedStations}>
            <SymbolView name={{ ios: 'arrow.up.arrow.down', android: 'swap_vert', web: 'swap_vert' }} size={34} tintColor="#A8A8AD" />
          </Pressable>

          <Pressable
            disabled={planning || !canSubmit}
            style={({ pressed }) => [
              styles.searchButton,
              canSubmit && styles.searchButtonReady,
              (pressed || planning) && styles.pressed,
            ]}
            onPress={submitSearch}>
            <SymbolView name={{ ios: 'arrow.triangle.swap', android: 'sync_alt', web: 'sync_alt' }} size={30} tintColor={canSubmit ? '#FFFFFF' : '#C7C7CC'} />
            <Text style={[styles.searchButtonText, canSubmit && styles.searchButtonTextReady]}>{planning ? '查询中' : '查询路线'}</Text>
          </Pressable>
        </View>

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

      <Modal animationType="slide" transparent visible={pickerVisible} onRequestClose={() => setPickerVisible(false)}>
        <View style={styles.pickerOverlay}>
          <Pressable style={styles.pickerBackdrop} onPress={() => setPickerVisible(false)} />
          <SafeAreaView style={styles.pickerSheet} edges={['left', 'right', 'bottom']}>
            <View style={styles.pickerHandle} />
            <Text style={styles.pickerTitle}>{pickingTarget === 'from' ? '选择起点' : '选择终点'}</Text>
            <View style={styles.searchBox}>
              <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={34} tintColor="#8E8E95" />
              <TextInput
                autoFocus
                placeholder="搜索站点..."
                placeholderTextColor="#9B9BA3"
                value={query}
                onChangeText={setQuery}
                style={styles.searchInput}
              />
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.lineTabsScroller}
              contentContainerStyle={styles.lineTabs}>
              {filteredSections.map((section) => (
                <Pressable
                  key={section.title}
                  style={({ pressed }) => [styles.lineTab, section.title === activeLineName && styles.lineTabActive, pressed && styles.pressed]}
                  onPress={() => setSelectedLineName(section.title)}>
                  <Text style={[styles.lineTabText, section.title === activeLineName && styles.lineTabTextActive]}>{section.title}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.stationCount}>{pickerStationCount} 个站点</Text>

            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color="#168CFF" />
                <Text style={styles.loadingText}>正在加载站点...</Text>
              </View>
            ) : (
              <View style={styles.pickerBody}>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.stationListContent}>
                  {pickerStations.map((station) => (
                    <Pressable
                      key={`${station.route.id}-${station.id}`}
                      style={({ pressed }) => [styles.stationItem, pressed && styles.stationItemPressed]}
                      onPress={() => selectStation(station)}>
                      <Text style={styles.stationItemText}>{station.name}</Text>
                      <Text style={styles.stationItemLine}>{station.route.lineName}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
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
    backgroundColor: '#F8F8F9',
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
    paddingHorizontal: 20,
    paddingTop: 54,
  },
  // Route picker header mirrors the compact start/end card used before querying.
  pageTitle: {
    color: '#111111',
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 38,
    marginBottom: 26,
  },
  stationCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#ECECEE',
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  stationRowControl: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 52,
    justifyContent: 'space-between',
    paddingLeft: 28,
    paddingRight: 22,
  },
  stationLead: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    paddingRight: 16,
  },
  stationDotControl: {
    borderRadius: 5,
    height: 10,
    marginRight: 14,
    width: 10,
  },
  startDot: {
    backgroundColor: '#00C853',
  },
  endDot: {
    backgroundColor: '#FF1E2D',
  },
  stationRole: {
    color: '#909098',
    fontSize: 14,
    fontWeight: '700',
    marginRight: 16,
  },
  stationPlaceholder: {
    color: '#9B9BA3',
    flex: 1,
    fontSize: 20,
    fontWeight: '500',
  },
  stationPicked: {
    color: '#111827',
    fontWeight: '800',
  },
  stationDivider: {
    backgroundColor: '#ECECEE',
    height: 1,
    marginLeft: 114,
  },
  actionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 13,
    marginTop: 16,
  },
  swapButton: {
    alignItems: 'center',
    backgroundColor: '#F8F8F9',
    borderColor: '#A9A9AE',
    borderRadius: 24,
    borderWidth: 1.5,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  searchButton: {
    alignItems: 'center',
    backgroundColor: '#E3E3E5',
    borderRadius: 12,
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    height: 48,
    justifyContent: 'center',
  },
  searchButtonReady: {
    backgroundColor: '#168CFF',
  },
  searchButtonText: {
    color: '#C7C7CC',
    fontSize: 20,
    fontWeight: '900',
  },
  searchButtonTextReady: {
    color: '#FFFFFF',
  },
  pressed: {
    opacity: 0.72,
  },
  // Station picker uses a dimmed page overlay with a rounded bottom sheet.
  pickerOverlay: {
    flex: 1,
  },
  pickerBackdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.32)',
    flex: 1,
  },
  pickerSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    height: '50%',
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingTop: 40,
  },
  pickerHandle: {
    alignSelf: 'center',
    backgroundColor: '#9E9EA4',
    borderRadius: 3,
    height: 6,
    position: 'absolute',
    top: 17,
    width: 70,
  },
  pickerTitle: {
    color: '#111111',
    fontSize: 23,
    fontWeight: '900',
    lineHeight: 30,
    marginBottom: 16,
  },
  searchBox: {
    alignItems: 'center',
    borderColor: '#E5E5EA',
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: 'row',
    height: 46,
    paddingHorizontal: 18,
  },
  searchInput: {
    color: '#111827',
    flex: 1,
    fontSize: 18,
    marginLeft: 12,
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
  lineTabs: {
    gap: 7,
    paddingTop: 8,
  },
  lineTabsScroller: {
    flexGrow: 0,
    height: 50,
    marginBottom: 14,
    marginTop: 14,
  },
  lineTab: {
    alignItems: 'center',
    borderColor: '#E6E6EA',
    borderRadius: 8,
    borderWidth: 1.5,
    height: 34,
    justifyContent: 'center',
    minWidth: 68,
    paddingHorizontal: 14,
  },
  lineTabActive: {
    backgroundColor: '#EFEFF1',
  },
  lineTabText: {
    color: '#8F8F96',
    fontSize: 17,
    fontWeight: '800',
  },
  lineTabTextActive: {
    color: '#8A8A90',
  },
  stationCount: {
    color: '#8F8F96',
    fontSize: 14,
    marginBottom: 12,
  },
  stationListContent: {
    paddingBottom: 36,
  },
  stationItem: {
    justifyContent: 'center',
    minHeight: 64,
    paddingLeft: 28,
  },
  stationItemPressed: {
    backgroundColor: '#F8FAFC',
  },
  stationItemText: {
    color: '#111111',
    fontSize: 22,
    fontWeight: '900',
  },
  stationItemLine: {
    color: '#8F8F96',
    fontSize: 16,
    marginTop: 4,
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
