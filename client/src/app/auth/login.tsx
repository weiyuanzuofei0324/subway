import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/auth';

const logo = require('@/assets/images/ChatGPT Image Jul 13, 2026, 12_01_02 PM.png');

export default function LoginScreen() {
  const { login } = useAuth();
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [secure, setSecure] = useState(true);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!account.trim() || !password) {
      Alert.alert('提示', '请输入账号和密码');
      return;
    }

    try {
      setLoading(true);
      await login(account.trim(), password);
    } catch (error) {
      Alert.alert('登录失败', '账号或密码不正确');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', android: undefined })}
        style={styles.container}>
        <View style={styles.logoWrap}>
          <Image source={logo} style={styles.logo} contentFit="contain" />
        </View>

        <View style={styles.form}>
          <View style={styles.inputRow}>
            <SymbolView name={{ ios: 'person', android: 'person', web: 'person' }} size={30} tintColor="#8d929d" />
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Account"
              placeholderTextColor="#9aa0aa"
              style={styles.input}
              value={account}
              onChangeText={setAccount}
            />
          </View>

          <View style={styles.inputRow}>
            <SymbolView name={{ ios: 'lock', android: 'lock', web: 'lock' }} size={28} tintColor="#8d929d" />
            <TextInput
              placeholder="Password"
              placeholderTextColor="#9aa0aa"
              secureTextEntry={secure}
              style={styles.input}
              value={password}
              onChangeText={setPassword}
            />
            <Pressable hitSlop={12} onPress={() => setSecure((value) => !value)}>
              <SymbolView
                name={{ ios: secure ? 'eye.slash' : 'eye', android: secure ? 'visibility_off' : 'visibility', web: secure ? 'visibility_off' : 'visibility' }}
                size={28}
                tintColor="#b4b7bf"
              />
            </Pressable>
          </View>

          <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Login</Text>}
          </Pressable>

          <Link href="/auth/register" asChild>
            <Pressable style={({ pressed }) => pressed && styles.pressed}>
              <Text style={styles.linkText}>Register</Text>
            </Pressable>
          </Link>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fbfcff',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: 92,
  },
  logo: {
    height: 190,
    width: 190,
  },
  form: {
    gap: 18,
  },
  inputRow: {
    alignItems: 'center',
    borderColor: '#d9dce3',
    borderRadius: 38,
    borderWidth: 1.5,
    flexDirection: 'row',
    height: 72,
    paddingHorizontal: 24,
    shadowColor: '#3a4a68',
    shadowOpacity: 0.05,
    shadowRadius: 18,
  },
  input: {
    color: '#242b35',
    flex: 1,
    fontSize: 24,
    marginLeft: 22,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#0349b8',
    borderRadius: 36,
    height: 72,
    justifyContent: 'center',
    marginTop: 22,
    shadowColor: '#0349b8',
    shadowOpacity: 0.24,
    shadowRadius: 18,
  },
  primaryText: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '600',
  },
  linkText: {
    color: '#064ba9',
    fontSize: 22,
    marginTop: 34,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.72,
  },
});
