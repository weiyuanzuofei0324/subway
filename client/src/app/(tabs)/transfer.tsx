import { StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TransferScreen() {
  return (
    <SafeAreaView style={styles.page}>
      <Text style={styles.title}>换乘信息</Text>
      <View style={styles.panel}>
        <TextInput placeholder="起点站" placeholderTextColor="#9aa0aa" style={styles.input} />
        <TextInput placeholder="终点站" placeholderTextColor="#9aa0aa" style={styles.input} />
        <View style={styles.button}>
          <Text style={styles.buttonText}>查询换乘</Text>
        </View>
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
  panel: {
    gap: 16,
  },
  input: {
    backgroundColor: '#fff',
    borderColor: '#e3e6ec',
    borderRadius: 8,
    borderWidth: 1,
    color: '#263342',
    fontSize: 18,
    height: 58,
    paddingHorizontal: 16,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#0349b8',
    borderRadius: 8,
    height: 58,
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});
