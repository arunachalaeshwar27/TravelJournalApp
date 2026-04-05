/**
 * Auth Store — Zustand
 *
 * WHY Zustand over Redux Toolkit?
 * - 1/10th the boilerplate; no actions/reducers split needed for a mobile app this size
 * - Works natively with immer for immutable updates
 * - No Provider needed — works outside React tree (services can call getState())
 * - RTK is great for large teams; Zustand wins for speed + simplicity here
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile } from '@/types';

interface AuthStore {
  storeId: string;
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;

  setUser: (user: UserProfile, token: string) => void;
  clearUser: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    immer((set) => ({
      storeId: Math.random().toString(36).substring(7),
      user: null,
      token: null,
      isLoading: false,
      error: null,

      setUser: (user, token) =>
        set(state => {
          state.user = user;
          state.token = token;
          state.error = null;
          state.isLoading = false;
        }),

      clearUser: () =>
        set(state => {
          state.user = null;
          state.token = null;
        }),

      setLoading: loading =>
        set(state => {
          state.isLoading = loading;
        }),

      setError: error =>
        set(state => {
          state.error = error;
          state.isLoading = false;
        }),
    })),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist user/token — don't persist loading/error states
      partialize: state => ({ user: state.user, token: state.token }),
    },
  ),
);
