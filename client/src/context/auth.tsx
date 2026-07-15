import * as SecureStore from 'expo-secure-store';
import * as SplashScreen from 'expo-splash-screen';
import { router, useSegments } from 'expo-router';
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { api, AuthResponse, AuthUser, setAuthToken } from '@/lib/api';

const TOKEN_KEY = 'wuhan_subway_token';

const tokenStorage = {
  async get() {
    if (Platform.OS === 'web') {
      return window.localStorage.getItem(TOKEN_KEY);
    }
    if (typeof SecureStore.getItemAsync !== 'function') {
      return null;
    }
    return SecureStore.getItemAsync(TOKEN_KEY);
  },
  async set(value: string) {
    if (Platform.OS === 'web') {
      window.localStorage.setItem(TOKEN_KEY, value);
      return;
    }
    if (typeof SecureStore.setItemAsync !== 'function') {
      return;
    }
    await SecureStore.setItemAsync(TOKEN_KEY, value);
  },
  async delete() {
    if (Platform.OS === 'web') {
      window.localStorage.removeItem(TOKEN_KEY);
      return;
    }
    if (typeof SecureStore.deleteItemAsync === 'function') {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
  },
};

type RegisterInput = {
  username: string;
  account: string;
  password: string;
};

type AuthContextValue = {
  initializing: boolean;
  token: string | null;
  user: AuthUser | null;
  login: (account: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [initializing, setInitializing] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const segments = useSegments();

  async function persistSession(session: AuthResponse) {
    setAuthToken(session.token);
    setToken(session.token);
    setUser(session.user);
    await tokenStorage.set(session.token);
  }

  useEffect(() => {
    async function restoreSession() {
      try {
        const storedToken = await tokenStorage.get();
        if (storedToken) {
          setAuthToken(storedToken);
          const { data } = await api.get<{ user: AuthUser }>('/auth/me');
          setToken(storedToken);
          setUser(data.user);
        }
      } catch {
        await tokenStorage.delete();
        setAuthToken(null);
      } finally {
        setInitializing(false);
        SplashScreen.hideAsync();
      }
    }

    restoreSession();
  }, []);

  useEffect(() => {
    if (initializing) {
      return;
    }

    const inAuthGroup = segments[0] === 'auth';
    if (!token && !inAuthGroup) {
      router.replace('/auth/login');
    }
    if (token && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [initializing, segments, token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      initializing,
      token,
      user,
      async login(account, password) {
        const { data } = await api.post<AuthResponse>('/auth/login', { account, password });
        await persistSession(data);
      },
      async register(input) {
        const { data } = await api.post<AuthResponse>('/auth/register', input);
        await persistSession(data);
      },
      async changePassword(currentPassword, newPassword) {
        await api.post('/auth/password', { currentPassword, newPassword });
      },
      async logout() {
        await tokenStorage.delete();
        setAuthToken(null);
        setToken(null);
        setUser(null);
        router.replace('/auth/login');
      },
    }),
    [initializing, token, user],
  );

  if (initializing) {
    return null;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return value;
}
