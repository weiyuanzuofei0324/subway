import axios from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const extra = Constants.expoConfig?.extra as { apiUrl?: string } | undefined;

function getDefaultBaseURL() {
  if (Platform.OS === 'android') {
    if (extra?.apiUrl && !extra.apiUrl.includes('localhost') && !extra.apiUrl.includes('127.0.0.1')) {
      return extra.apiUrl;
    }
    return 'http://10.213.21.133:8080/api';
  }
  if (extra?.apiUrl) {
    return extra.apiUrl;
  }
  return 'http://localhost:8080/api';
}

export const api = axios.create({
  baseURL: getDefaultBaseURL(),
  timeout: 10000,
});

export type AuthUser = {
  id: number;
  username: string;
  account: string;
};

export type AuthResponse = {
  token: string;
  user: AuthUser;
};

export function setAuthToken(token?: string | null) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    return;
  }
  delete api.defaults.headers.common.Authorization;
}
