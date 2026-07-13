import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const lines = ['1号线', '2号线', '3号线', '4号线', '5号线', '6号线', '7号线', '8号线'];

export default function LinesScreen() {
  return (
    <SafeAreaView style={styles.page}>
      <Text style={styles.title}>线路站点</Text>
      <View style={styles.grid}>
        {lines.map((line) => (
          <View key={line} style={styles.lineItem}>
            <Text style={styles.lineName}>{line}</Text>
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#f7f9fd',
    padding: 22,
  },
  title: {
    color: '#1f2a38',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 22,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  lineItem: {
    backgroundColor: '#fff',
    borderLeftColor: '#0349b8',
    borderLeftWidth: 5,
    borderRadius: 8,
    padding: 18,
    width: '47%',
  },
  lineName: {
    color: '#263342',
    fontSize: 18,
    fontWeight: '700',
  },
});
