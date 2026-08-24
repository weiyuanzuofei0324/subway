import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SubwayMapViewer } from '@/components/subway-map-viewer';
import { api } from '@/lib/api';

type RouteSummary = {
  id: number;
  lineName: string;
  color: string;
};

type StationOption = {
  id: number;
  name: string;
  pinyin: string;
  routeName: string;
};

type RouteDetail = RouteSummary & {
  stations: Array<{
    id: number;
    name: string;
    pinyin: string;
  }>;
};

export default function HomeScreen() {
  const [fullscreen, setFullscreen] = useState(false);
  const [stations, setStations] = useState<StationOption[]>([]);
  const [loadingStations, setLoadingStations] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let mounted = true;

    async function loadStations() {
      try {
        setLoadingStations(true);
        const { data } = await api.get<{ routes: RouteSummary[] }>('/routes');
        const routeDetails = await Promise.all(
          data.routes.map(async (route) => {
            const response = await api.get<{ route: RouteDetail }>(`/routes/${encodeURIComponent(route.lineName)}`);
            return response.data.route;
          }),
        );

        if (!mounted) {
          return;
        }

        const stationIds = new Set<number>();
        const nextStations: StationOption[] = [];
        routeDetails.forEach((route) => {
          route.stations.forEach((station) => {
            if (stationIds.has(station.id)) {
              return;
            }
            stationIds.add(station.id);
            nextStations.push({
              id: station.id,
              name: station.name,
              pinyin: station.pinyin,
              routeName: route.lineName,
            });
          });
        });
        setStations(nextStations);
      } catch {
        if (mounted) {
          Alert.alert('加载失败', '暂时无法加载站点搜索');
        }
      } finally {
        if (mounted) {
          setLoadingStations(false);
        }
      }
    }

    loadStations();
    return () => {
      mounted = false;
    };
  }, []);

  const searchResults = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) {
      return [];
    }
    return stations
      .filter((station) => station.name.includes(keyword) || station.pinyin.toLowerCase().includes(keyword))
      .slice(0, 8);
  }, [query, stations]);

  // Opens the existing station detail screen from the map search results.
  function openStation(station: StationOption) {
    setQuery('');
    router.push({
      pathname: '/stations/[stationId]',
      params: { stationId: String(station.id) },
    });
  }

  return (
    <SafeAreaView style={styles.page} edges={['top', 'left', 'right']}>
      <SubwayMapViewer onRequestFullscreen={() => setFullscreen(true)} />
      <View style={styles.searchPanel}>
        <View style={styles.searchBox}>
          <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={22} tintColor="#7B8494" />
          <TextInput
            placeholder="搜索站点"
            placeholderTextColor="#8A96A3"
            value={query}
            onChangeText={setQuery}
            style={styles.searchInput}
          />
          {loadingStations ? <ActivityIndicator color="#168CFF" size="small" /> : null}
        </View>

        {query.trim() ? (
          <ScrollView style={styles.resultBox} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {searchResults.length > 0 ? (
              searchResults.map((station) => (
                <Pressable
                  key={station.id}
                  style={({ pressed }) => [styles.resultItem, pressed && styles.pressed]}
                  onPress={() => openStation(station)}>
                  <Text style={styles.resultName}>{station.name}</Text>
                  <Text style={styles.resultLine}>{station.routeName}</Text>
                </Pressable>
              ))
            ) : (
              <View style={styles.emptyResult}>
                <Text style={styles.emptyText}>未找到相关站点</Text>
              </View>
            )}
          </ScrollView>
        ) : null}
      </View>

      <Modal animationType="fade" visible={fullscreen} onRequestClose={() => setFullscreen(false)}>
        <SafeAreaView style={styles.fullscreenPage}>
          <SubwayMapViewer fullscreen onExitFullscreen={() => setFullscreen(false)} />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fullscreenPage: {
    backgroundColor: '#eef0f3',
    flex: 1,
  },
  page: {
    backgroundColor: '#eef0f3',
    flex: 1,
  },
  searchPanel: {
    left: 16,
    position: 'absolute',
    right: 72,
    top: 18,
    zIndex: 2,
  },
  searchBox: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE3EC',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    height: 48,
    paddingHorizontal: 14,
    shadowColor: '#1F2937',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  searchInput: {
    color: '#111827',
    flex: 1,
    fontSize: 17,
    marginLeft: 10,
    paddingVertical: 0,
  },
  resultBox: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E4E8EF',
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 8,
    maxHeight: 360,
    overflow: 'hidden',
  },
  resultItem: {
    borderBottomColor: '#EEF1F5',
    borderBottomWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  resultName: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '900',
  },
  resultLine: {
    color: '#7B8494',
    fontSize: 14,
    marginTop: 4,
  },
  emptyResult: {
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  emptyText: {
    color: '#7B8494',
    fontSize: 15,
  },
  pressed: {
    opacity: 0.72,
  },
});
