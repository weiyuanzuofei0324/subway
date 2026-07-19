import axios from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const extra = Constants.expoConfig?.extra as { apiUrl?: string } | undefined;
const DEFAULT_API_URL = 'http://8.148.10.177:8080/api';

function getExpoHost() {
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost;
  return hostUri?.split(':')[0];
}

function getDefaultBaseURL() {
  if (extra?.apiUrl) {
    return extra.apiUrl;
  }

  if (Platform.OS !== 'web') {
    const expoHost = getExpoHost();
    if (expoHost) {
      return `http://${expoHost}:8080/api`;
    }
  }

  return DEFAULT_API_URL;
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
