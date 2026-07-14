import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const lines = [
  { id: '1', name: '1号线', english: 'Line 1', color: '#257ECD' },
  { id: '2', name: '2号线', english: 'Line 2', color: '#F394C9' },
  { id: '3', name: '3号线', english: 'Line 3', color: '#EBC16F' },
  { id: '4', name: '4号线', english: 'Line 4', color: '#98D13C' },
  { id: '5', name: '5号线', english: 'Line 5', color: '#E7343F' },
  { id: '6', name: '6号线', english: 'Line 6', color: '#138643' },
  { id: '7', name: '7号线', english: 'Line 7', color: '#FF9221' },
  { id: '8', name: '8号线', english: 'Line 8', color: '#99C7D3' },
  { id: '11', name: '11号线', english: 'Line 11', color: '#B58DD5' },
  { id: '16', name: '16号线', english: 'Line 16', color: '#55B7A8' },
];

const lineRows = Array.from({ length: Math.ceil(lines.length / 2) }, (_, index) =>
  lines.slice(index * 2, index * 2 + 2),
);

export default function LinesScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.logo}>
            <Text style={styles.logoLetter}>M</Text>
            <View style={styles.logoRails}>
              <View style={styles.rail} />
              <View style={styles.rail} />
            </View>
          </View>
          <Text style={styles.cityName}>武汉地铁</Text>

          <View style={styles.stats}>
            <View style={styles.statPill}>
              <Text style={styles.statText}>554 公里</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statText}>335 座车站</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statText}>13 条线路</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statText}>2004年7月 通车</Text>
            </View>
          </View>
        </View>

        <View style={styles.grid}>
          {lineRows.map((row) => (
            <View key={row.map((line) => line.id).join('-')} style={styles.row}>
              {row.map((line) => (
                <View key={line.id} style={styles.card}>
                  <View style={[styles.lineBadge, { borderColor: line.color }]}>
                    <Text style={styles.lineNumber}>{line.id}</Text>
                  </View>
                  <Text style={styles.lineName}>{line.name}</Text>
                  <Text style={styles.lineEnglish}>{line.english}</Text>
                </View>
              ))}
              {row.length === 1 ? <View style={styles.cardPlaceholder} /> : null}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#F3F7FE',
    flex: 1,
  },
  content: {
    backgroundColor: '#FFFFFF',
    paddingBottom: 34,
    paddingHorizontal: 18,
    paddingTop: 22,
  },
  hero: {
    alignItems: 'center',
  },
  logo: {
    alignItems: 'center',
    backgroundColor: '#4B5DE2',
    borderRadius: 54,
    height: 108,
    justifyContent: 'center',
    marginBottom: 12,
    width: 108,
  },
  logoLetter: {
    color: '#FFFFFF',
    fontSize: 64,
    fontWeight: '900',
    lineHeight: 70,
  },
  logoRails: {
    flexDirection: 'row',
    gap: 18,
    marginTop: -8,
  },
  rail: {
    backgroundColor: '#FFFFFF',
    height: 5,
    width: 28,
  },
  cityName: {
    color: '#09111D',
    fontSize: 30,
    fontWeight: '900',
    marginBottom: 14,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 26,
  },
  statPill: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DFE5EE',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  statText: {
    color: '#07121F',
    fontSize: 16,
    fontWeight: '800',
  },
  grid: {
    gap: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  card: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    elevation: 4,
    minHeight: 212,
    paddingBottom: 16,
    paddingTop: 14,
    shadowColor: '#718096',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    width: '47%',
  },
  cardPlaceholder: {
    width: '47%',
  },
  lineBadge: {
    alignItems: 'center',
    borderRadius: 54,
    borderWidth: 17,
    height: 108,
    justifyContent: 'center',
    marginBottom: 14,
    width: 108,
  },
  lineNumber: {
    color: '#000000',
    fontSize: 36,
    fontWeight: '900',
  },
  lineName: {
    color: '#101010',
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 32,
  },
  lineEnglish: {
    color: '#5A6C7E',
    fontSize: 22,
    marginTop: 4,
  },
});
