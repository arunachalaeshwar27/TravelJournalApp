/**
 * Authentication Service
 *
 * Google Sign-In flow:
 *  1. GoogleSignin.signIn() → gets idToken
 *  2. Exchange idToken with Firebase Auth or your own backend
 *  3. Store access token in Keychain (hardware-backed on Android, Secure Enclave on iOS)
 *  4. Store non-sensitive user profile in Zustand + AsyncStorage (persisted)
 *
 * Security model:
 *  - Keychain/Keystore = sensitive tokens (never in AsyncStorage)
 *  - AsyncStorage = user profile display data only
 *  - All API calls include Authorization: Bearer <token>
 */

import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import * as Keychain from 'react-native-keychain';
import { UserProfile } from '@/types';
import { useAuthStore } from '@/store/authStore';

const KEYCHAIN_SERVICE = 'travel_journal_token';
import { GOOGLE_WEB_CLIENT_ID } from "@env"
console.log("process.env.GOOGLE_WEB_CLIENT_ID",GOOGLE_WEB_CLIENT_ID);

// Call once at app startup (e.g. in App.tsx)
export function configureGoogleSignIn() {
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID, // from Firebase Console
    // scopes: ['https://www.googleapis.com/auth/drive'],
      offlineAccess: true,
      forceCodeForRefreshToken: true,
      profileImageSize: 120

    // offlineAccess: true,
    // forceCodeForRefreshToken: true,
  });
}

export async function signInWithGoogle(): Promise<UserProfile> {
  const { setUser, setLoading, setError } = useAuthStore.getState();
  setLoading(true);

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const userInfo = await GoogleSignin.signIn();

    const { idToken } = await GoogleSignin.getTokens();
    if (!idToken) throw new Error('Failed to get ID token');
console.log("idToken",idToken,GOOGLE_WEB_CLIENT_ID);

    // In production: exchange idToken with your backend for a session token
    // const { data } = await apiClient.post('/auth/google', { idToken });
    // const sessionToken = data.token;
    // For demo: use idToken directly
    const sessionToken = idToken;

    const profile: UserProfile = {
      id: userInfo.user.id,
      email: userInfo.user.email,
      name: userInfo.user.name ?? 'Traveler',
      photoUrl: userInfo.user.photo ?? undefined,
      provider: 'google',
    };

    // Store token securely in Keychain
    await Keychain.setGenericPassword('user', sessionToken, {
      service: KEYCHAIN_SERVICE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });

    setUser(profile, sessionToken);
    return profile;
  } catch (error: unknown) {
    console.log("errorsds",error);
    
    const errorCode = (error as { code?: string }).code;
    let message = 'Sign-in failed';

    if (errorCode === statusCodes.SIGN_IN_CANCELLED) {
      message = 'Sign-in cancelled';
    } else if (errorCode === statusCodes.IN_PROGRESS) {
      message = 'Sign-in already in progress';
    } else if (errorCode === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      message = 'Google Play Services not available';
    }

    setError(message);
    throw new Error(message);
  }
}

export async function restoreSession(): Promise<boolean> {
  const { setUser } = useAuthStore.getState();

  // 1. Try silent Google sign-in (refreshes token from Google's servers).
  //    signInSilently throws SIGN_IN_REQUIRED when the cache is cold — that's
  //    normal, so we catch it here and fall through to the Keychain check.
  try {
    await GoogleSignin.hasPlayServices();
    const userInfo = await GoogleSignin.signInSilently();

    if (userInfo) {
      const { idToken } = await GoogleSignin.getTokens();
      const profile: UserProfile = {
        id: userInfo.user.id,
        email: userInfo.user.email,
        name: userInfo.user.name ?? 'Traveler',
        photoUrl: userInfo.user.photo ?? undefined,
        provider: 'google',
      };

      if (idToken) {
        setUser(profile, idToken);
        return true;
      }
    }
  } catch (error) {
    console.log('Silent Google sign-in failed, trying Keychain fallback:', error);
  }

  // 2. Fallback: if the Zustand store still has a user (persisted via
  //    AsyncStorage) and Keychain has the token, re-hydrate the session.
  try {
    const credentials = await Keychain.getGenericPassword({ service: KEYCHAIN_SERVICE });
    const { user } = useAuthStore.getState();
    if (credentials && user) {
      setUser(user, credentials.password);
      return true;
    }
  } catch (error) {
    console.log('Keychain session restore failed:', error);
  }

  return false;
}

export async function signOut(): Promise<void> {
  try {
    await GoogleSignin.signOut();
  } catch {
    // Ignore Google sign-out errors
  }

  await Keychain.resetGenericPassword({ service: KEYCHAIN_SERVICE });
  useAuthStore.getState().clearUser();
}

export async function getStoredToken(): Promise<string | null> {
  const credentials = await Keychain.getGenericPassword({ service: KEYCHAIN_SERVICE });
  return credentials ? credentials.password : null;
}
