import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const logo = require('@/assets/images/ChatGPT Image Jul 13, 2026, 12_01_02 PM.png');

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.header}>
        <Image source={logo} style={styles.logo} contentFit="contain" />
        <View>
          <Text style={styles.title}>武汉地铁</Text>
          <Text style={styles.subtitle}>Wuhan Metro</Text>
        </View>
      </View>

      <View style={styles.hero}>
        <Text style={styles.heroTitle}>便捷出行，从这里开始</Text>
        <Text style={styles.heroText}>查询线路站点、规划换乘路径，后续会继续接入实时运营信息。</Text>
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
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    paddingTop: 10,
  },
  logo: {
    height: 58,
    width: 58,
  },
  title: {
    color: '#1f2a38',
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: '#7d8591',
    fontSize: 14,
    marginTop: 2,
  },
  hero: {
    backgroundColor: '#0349b8',
    borderRadius: 8,
    marginTop: 30,
    padding: 22,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  heroText: {
    color: '#dce8ff',
    fontSize: 15,
    lineHeight: 23,
    marginTop: 10,
  },
});
