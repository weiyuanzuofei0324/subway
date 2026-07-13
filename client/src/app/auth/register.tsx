import { Image } from 'expo-image';
import { router } from 'expo-router';
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

export default function RegisterScreen() {
  const { register } = useAuth();
  const [username, setUsername] = useState('');
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [secure, setSecure] = useState(true);
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!username.trim() || !account.trim() || password.length < 6) {
      Alert.alert('提示', '请输入用户名、账号，并确保密码至少 6 位');
      return;
    }

    try {
      setLoading(true);
      await register({ username: username.trim(), account: account.trim(), password });
    } catch (error) {
      Alert.alert('注册失败', '账号可能已存在，请换一个账号');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', android: undefined })}
        style={styles.container}>
        <View style={styles.header}>
          <Pressable hitSlop={12} onPress={() => router.back()}>
            <SymbolView name={{ ios: 'arrow.left', android: 'arrow_back', web: 'arrow_left' }} size={34} tintColor="#2c343f" />
          </Pressable>
          <Text style={styles.title}>Create Account</Text>
          <View style={styles.headerSpace} />
        </View>

        <Image source={logo} style={styles.logo} contentFit="contain" />

        <View style={styles.form}>
          <AuthInput icon="person" placeholder="Username" value={username} onChangeText={setUsername} />
          <AuthInput icon="person" placeholder="Account" value={account} onChangeText={setAccount} />
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

          <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]} onPress={handleRegister} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Sign Up</Text>}
          </Pressable>

          <Pressable style={({ pressed }) => pressed && styles.pressed} onPress={() => router.replace('/auth/login')}>
            <Text style={styles.footerText}>
              Already have an account? <Text style={styles.footerLink}>Login</Text>
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type AuthInputProps = {
  icon: 'person';
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
};

function AuthInput({ icon, placeholder, value, onChangeText }: AuthInputProps) {
  return (
    <View style={styles.inputRow}>
      <SymbolView name={{ ios: icon, android: icon, web: icon }} size={30} tintColor="#8d929d" />
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        placeholder={placeholder}
        placeholderTextColor="#9aa0aa"
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fbfcff',
  },
  container: {
    flex: 1,
    paddingHorizontal: 28,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 20,
  },
  title: {
    color: '#202832',
    fontSize: 28,
    fontWeight: '700',
  },
  headerSpace: {
    width: 34,
  },
  logo: {
    alignSelf: 'center',
    height: 182,
    marginBottom: 54,
    marginTop: 108,
    width: 182,
  },
  form: {
    gap: 24,
  },
  inputRow: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 36,
    flexDirection: 'row',
    height: 72,
    paddingHorizontal: 24,
    shadowColor: '#50617b',
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 5,
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
    marginTop: 28,
    shadowColor: '#0349b8',
    shadowOpacity: 0.24,
    shadowRadius: 18,
  },
  primaryText: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '600',
  },
  footerText: {
    color: '#9196a0',
    fontSize: 21,
    marginTop: 28,
    textAlign: 'center',
  },
  footerLink: {
    color: '#064ba9',
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.72,
  },
});
