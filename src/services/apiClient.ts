/**
 * Axios API Client
 *
 * - Automatically attaches Bearer token from Keychain
 * - Handles 401 → signs out user
 * - Adds request/response interceptors for logging in dev
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { getStoredToken, signOut } from './authService';

const BASE_URL = process.env.API_BASE_URL ?? 'https://api.traveljournal.app/v1';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ─── Request interceptor: inject auth token ────────────────────────────────

apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Response interceptor: handle 401 ─────────────────────────────────────

apiClient.interceptors.response.use(
  response => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      await signOut();
    }
    return Promise.reject(error);
  },
);

// ─── Upload helper (multipart) ─────────────────────────────────────────────

export async function uploadFile(
  endpoint: string,
  fileUri: string,
  mimeType: string,
  fieldName = 'file',
): Promise<string> {
  const formData = new FormData();
  formData.append(fieldName, {
    uri: fileUri,
    type: mimeType,
    name: fileUri.split('/').pop() ?? 'upload',
  } as unknown as Blob);

  const { data } = await apiClient.post<{ url: string }>(endpoint, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.url;
}
