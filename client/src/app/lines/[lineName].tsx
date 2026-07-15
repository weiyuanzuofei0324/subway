import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/lib/api';

type Station = {
  id: number;
  sequence: number;
  name: string;
  pinyin: string;
  coords: string;
  transferRoutes: RouteSummary[] | null;
};

type RouteSummary = {
  id: number;
  lineName: string;
  color: string;
};

type RouteDetail = {
  id: number;
  lineName: string;
  color: string;
  stations: Station[];
};

export default function LineDetailScreen() {
  const params = useLocalSearchParams<{ lineName?: string | string[] }>();
  const lineName = useMemo(() => {
    const value = params.lineName;
    return Array.isArray(value) ? value[0] : value;
  }, [params.lineName]);
  const [routeDetail, setRouteDetail] = useState<RouteDetail | null>(null);
  const [activeTab, setActiveTab] = useState<'stations' | 'transfers'>('stations');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function loadRoute() {
      if (!lineName) {
        return;
      }

      try {
        setLoading(true);
        setError('');
        const { data } = await api.get<{ route: RouteDetail }>(`/routes/${encodeURIComponent(lineName)}`);
        if (mounted) {
          setRouteDetail(normalizeRouteDetail(data.route));
        }
      } catch {
        if (mounted) {
          setError('暂未加载到该线路的站点数据');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadRoute();
    return () => {
      mounted = false;
    };
  }, [lineName]);

  const title = routeDetail?.lineName ?? lineName ?? '线路详情';
  const color = routeDetail?.color ?? '#3080B7';
  const transferStations = useMemo(
    () => routeDetail?.stations.filter((station) => getTransferRoutes(station).length > 0) ?? [],
    [routeDetail],
  );
  const visibleStations = activeTab === 'transfers' ? transferStations : routeDetail?.stations ?? [];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>返回</Text>
        </Pressable>

        <View style={styles.header}>
          <View style={[styles.lineBadge, { borderColor: color }]}>
            <Text style={styles.lineNumber}>{title.replace('号线', '').replace('线', '')}</Text>
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{routeDetail ? `${routeDetail.stations.length} 座车站` : '武汉地铁线路'}</Text>
          </View>
        </View>

        <View style={styles.tabs}>
          <Pressable
            style={[styles.tabButton, activeTab === 'stations' && styles.tabButtonActive]}
            onPress={() => setActiveTab('stations')}>
            <Text style={[styles.tabText, activeTab === 'stations' && styles.tabTextActive]}>车站</Text>
          </Pressable>
          <Pressable
            style={[styles.tabButton, activeTab === 'transfers' && styles.tabButtonActive]}
            onPress={() => setActiveTab('transfers')}>
            <Text style={[styles.tabText, activeTab === 'transfers' && styles.tabTextActive]}>换乘</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator color={color} />
            <Text style={styles.stateText}>正在加载站点...</Text>
          </View>
        ) : error ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateText}>{error}</Text>
          </View>
        ) : (
          <View style={styles.stationList}>
            {visibleStations.length === 0 ? (
              <View style={styles.stateBox}>
                <Text style={styles.stateText}>暂无换乘站</Text>
              </View>
            ) : null}
            {visibleStations.map((station, index) => (
              <Pressable
                key={`${station.sequence}-${station.id}`}
                style={({ pressed }) => [styles.stationRow, pressed && styles.stationRowPressed]}
                onPress={() =>
                  router.push({
                    pathname: '/stations/[stationId]',
                    params: { stationId: String(station.id) },
                  })
                }>
                <View style={styles.timeline}>
                  <View style={[styles.stationDot, { borderColor: color }]} />
                  {index < visibleStations.length - 1 ? <View style={[styles.track, { backgroundColor: color }]} /> : null}
                </View>
                <View style={styles.stationInfo}>
                  <View style={styles.stationTitleRow}>
                    <Text style={styles.stationName}>{station.name}</Text>
                    {getTransferRoutes(station).length > 0 ? (
                      <View style={styles.transferBadges}>
                        {getTransferRoutes(station).map((route) => (
                          <View key={route.id} style={[styles.transferBadge, { backgroundColor: route.color }]}>
                            <Text style={styles.transferBadgeText}>{formatLineNumber(route.lineName)}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.stationMeta}>{station.pinyin}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function normalizeRouteDetail(route: RouteDetail): RouteDetail {
  return {
    ...route,
    stations: (route.stations ?? []).map((station) => ({
      ...station,
      transferRoutes: station.transferRoutes ?? [],
    })),
  };
}

function getTransferRoutes(station: Station) {
  return station.transferRoutes ?? [];
}

function formatLineNumber(lineName: string) {
  return lineName.replace('号线', '').replace('线', '');
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#F3F7FE',
    flex: 1,
  },
  content: {
    backgroundColor: '#FFFFFF',
    paddingBottom: 34,
    paddingHorizontal: 22,
    paddingTop: 18,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 18,
    paddingVertical: 6,
  },
  backText: {
    color: '#2563EB',
    fontSize: 17,
    fontWeight: '800',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 28,
  },
  headerText: {
    flex: 1,
    marginLeft: 18,
  },
  lineBadge: {
    alignItems: 'center',
    borderRadius: 38,
    borderWidth: 12,
    height: 76,
    justifyContent: 'center',
    width: 76,
  },
  lineNumber: {
    color: '#000000',
    fontSize: 26,
    fontWeight: '900',
  },
  title: {
    color: '#09111D',
    fontSize: 30,
    fontWeight: '900',
  },
  subtitle: {
    color: '#5A6C7E',
    fontSize: 16,
    marginTop: 5,
  },
  tabs: {
    backgroundColor: '#F8FAFC',
    flexDirection: 'row',
    marginBottom: 20,
  },
  tabButton: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: 12,
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
  },
  tabText: {
    color: '#111827',
    fontSize: 22,
    fontWeight: '900',
  },
  tabTextActive: {
    color: '#000000',
  },
  stateBox: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 28,
  },
  stateText: {
    color: '#5A6C7E',
    fontSize: 16,
    marginTop: 10,
  },
  stationList: {
    gap: 0,
  },
  stationRow: {
    flexDirection: 'row',
    minHeight: 72,
  },
  stationRowPressed: {
    opacity: 0.68,
  },
  timeline: {
    alignItems: 'center',
    width: 34,
  },
  stationDot: {
    backgroundColor: '#FFFFFF',
    borderRadius: 9,
    borderWidth: 4,
    height: 18,
    width: 18,
  },
  track: {
    flex: 1,
    marginVertical: 4,
    width: 4,
  },
  stationInfo: {
    flex: 1,
    paddingBottom: 20,
    paddingLeft: 12,
  },
  stationTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stationName: {
    color: '#111827',
    flex: 1,
    fontSize: 20,
    fontWeight: '900',
  },
  stationMeta: {
    color: '#64748B',
    fontSize: 14,
    marginTop: 4,
  },
  transferBadges: {
    flexDirection: 'row',
    gap: 6,
    marginLeft: 10,
  },
  transferBadge: {
    alignItems: 'center',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    minWidth: 28,
    paddingHorizontal: 8,
  },
  transferBadgeText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
});
