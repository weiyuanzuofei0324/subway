import * as SecureStore from 'expo-secure-store';
import * as SplashScreen from 'expo-splash-screen';
import { router, useSegments } from 'expo-router';
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import { api, AuthResponse, AuthUser, setAuthToken } from '@/lib/api';

const TOKEN_KEY = 'wuhan_subway_token';

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
    await SecureStore.setItemAsync(TOKEN_KEY, session.token);
  }

  useEffect(() => {
    async function restoreSession() {
      try {
        const storedToken = await SecureStore.getItemAsync(TOKEN_KEY);
        if (storedToken) {
          setAuthToken(storedToken);
          const { data } = await api.get<{ user: AuthUser }>('/auth/me');
          setToken(storedToken);
          setUser(data.user);
        }
      } catch {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
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
      async logout() {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        setAuthToken(null);
        setToken(null);
        setUser(null);
        router.replace('/auth/login');
      },
    }),
    [initializing, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return value;
}
