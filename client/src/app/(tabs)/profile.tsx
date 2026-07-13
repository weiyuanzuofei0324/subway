import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/auth';

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  return (
    <SafeAreaView style={styles.page}>
      <Text style={styles.title}>个人信息</Text>
      <View style={styles.card}>
        <Text style={styles.label}>用户名</Text>
        <Text style={styles.value}>{user?.username}</Text>
        <Text style={styles.label}>账号</Text>
        <Text style={styles.value}>{user?.account}</Text>
      </View>
      <Pressable style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed]} onPress={logout}>
        <Text style={styles.logoutText}>退出登录</Text>
      </Pressable>
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
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 20,
  },
  label: {
    color: '#8d929d',
    fontSize: 14,
    marginBottom: 6,
  },
  value: {
    color: '#263342',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 18,
  },
  logoutButton: {
    alignItems: 'center',
    borderColor: '#0349b8',
    borderRadius: 8,
    borderWidth: 1,
    height: 52,
    justifyContent: 'center',
    marginTop: 18,
  },
  logoutText: {
    color: '#0349b8',
    fontSize: 17,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.72,
  },
});
