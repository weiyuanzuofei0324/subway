import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/lib/api';

type RouteSummary = {
  id: number;
  lineName: string;
  color: string;
};

type Timetable = {
  id: number;
  direction: string;
  workdayFirst: string;
  workdayLast: string;
  holidayFirst: string;
  holidayLast: string;
};

type StationDetail = {
  id: number;
  name: string;
  pinyin: string;
  coords: string;
  routes: RouteSummary[];
  timetables: Timetable[];
};

export default function StationDetailScreen() {
  const params = useLocalSearchParams<{ stationId?: string | string[] }>();
  const stationId = useMemo(() => {
    const value = params.stationId;
    return Array.isArray(value) ? value[0] : value;
  }, [params.stationId]);
  const [station, setStation] = useState<StationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function loadStation() {
      if (!stationId) {
        return;
      }

      try {
        setLoading(true);
        setError('');
        const { data } = await api.get<{ station: StationDetail }>(`/stations/${stationId}`);
        if (mounted) {
          setStation({
            ...data.station,
            routes: data.station.routes ?? [],
            timetables: data.station.timetables ?? [],
          });
        }
      } catch {
        if (mounted) {
          setError('暂未加载到该站点时刻表');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadStation();
    return () => {
      mounted = false;
    };
  }, [stationId]);

  const primaryRoute = station?.routes[0];
  const accentColor = primaryRoute?.color ?? '#3080B7';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>返回</Text>
        </Pressable>

        {loading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator color={accentColor} />
            <Text style={styles.stateText}>正在加载时刻表...</Text>
          </View>
        ) : error || !station ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateText}>{error || '站点不存在'}</Text>
          </View>
        ) : (
          <>
            <View style={styles.header}>
              <Text style={styles.stationTitle}>
                {station.name} <Text style={styles.stationPinyin}>{formatPinyin(station.pinyin)}</Text>
              </Text>
              <View style={styles.routeBadges}>
                {station.routes.map((route) => (
                  <View key={route.id} style={[styles.routeBadge, { backgroundColor: route.color }]}>
                    <Text style={styles.routeBadgeText}>{route.lineName}</Text>
                  </View>
                ))}
              </View>
            </View>

            <Text style={styles.sectionTitle}>首末班车时刻表</Text>

            {primaryRoute ? (
              <View style={[styles.routeBadgeLarge, { backgroundColor: primaryRoute.color }]}>
                <Text style={styles.routeBadgeLargeText}>{primaryRoute.lineName}</Text>
              </View>
            ) : null}

            <View style={styles.timetableList}>
              {station.timetables.length === 0 ? (
                <View style={styles.stateBox}>
                  <Text style={styles.stateText}>暂无时刻表数据</Text>
                </View>
              ) : null}
              {station.timetables.map((item) => (
                <View key={item.id} style={[styles.tableCard, { borderLeftColor: accentColor }]}>
                  <Text style={styles.directionTitle}>{item.direction}</Text>
                  <View style={styles.tableHeader}>
                    <Text style={styles.tableHeaderText}>日期</Text>
                    <Text style={styles.tableHeaderText}>首班车</Text>
                    <Text style={styles.tableHeaderText}>末班车</Text>
                  </View>
                  <View style={styles.tableRow}>
                    <Text style={styles.tableCellLabel}>工作日</Text>
                    <Text style={styles.tableCell}>{item.workdayFirst || '--'}</Text>
                    <Text style={styles.tableCell}>{item.workdayLast || '--'}</Text>
                  </View>
                  <View style={styles.tableRow}>
                    <Text style={styles.tableCellLabel}>节假日</Text>
                    <Text style={styles.tableCell}>{item.holidayFirst || '--'}</Text>
                    <Text style={styles.tableCell}>{item.holidayLast || '--'}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function formatPinyin(pinyin: string) {
  return pinyin
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.slice(0, 1).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#F3F7FE',
    flex: 1,
  },
  content: {
    backgroundColor: '#FFFFFF',
    paddingBottom: 34,
    paddingHorizontal: 14,
    paddingTop: 16,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 12,
    paddingVertical: 6,
  },
  backText: {
    color: '#2563EB',
    fontSize: 17,
    fontWeight: '800',
  },
  header: {
    marginBottom: 30,
  },
  stationTitle: {
    color: '#07111F',
    fontSize: 36,
    fontWeight: '900',
    lineHeight: 48,
  },
  stationPinyin: {
    color: '#4B5563',
    fontSize: 30,
    fontWeight: '800',
  },
  routeBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 18,
  },
  routeBadge: {
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  routeBadgeText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  sectionTitle: {
    color: '#07111F',
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 22,
  },
  routeBadgeLarge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    marginBottom: 24,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  routeBadgeLargeText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  timetableList: {
    gap: 26,
  },
  tableCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE8',
    borderLeftWidth: 5,
    borderRadius: 5,
    borderWidth: 1,
    overflow: 'hidden',
  },
  directionTitle: {
    color: '#07111F',
    fontSize: 22,
    fontWeight: '900',
    paddingHorizontal: 24,
    paddingVertical: 18,
  },
  tableHeader: {
    borderTopColor: '#E7EBF0',
    borderTopWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  tableHeaderText: {
    color: '#657184',
    flex: 1,
    fontSize: 20,
  },
  tableRow: {
    borderTopColor: '#EDF0F4',
    borderTopWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  tableCellLabel: {
    color: '#07111F',
    flex: 1,
    fontSize: 21,
  },
  tableCell: {
    color: '#07111F',
    flex: 1,
    fontSize: 21,
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
});
