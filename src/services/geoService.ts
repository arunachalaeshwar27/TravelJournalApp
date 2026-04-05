/**
 * Geolocation Service
 *
 * - Uses @react-native-community/geolocation (native module, no Expo)
 * - Returns coordinates + human-readable place name via reverse geocoding
 * - Handles permission request on both platforms
 */

import Geolocation from '@react-native-community/geolocation';
import { Platform, PermissionsAndroid } from 'react-native';
import { Coordinates } from '@/types';

Geolocation.setRNConfiguration({
  skipPermissionRequests: false,
  authorizationLevel: 'whenInUse',
  enableBackgroundLocationUpdates: false,
  locationProvider: 'auto',
});

export async function requestLocationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Location Permission',
        message: 'Travel Journal needs your location to tag journal entries.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }
  // iOS: permission handled via plist + Geolocation config
  return true;
}

export function getCurrentLocation(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      position => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          altitude: position.coords.altitude ?? undefined,
          accuracy: position.coords.accuracy,
        });
      },
      error => reject(new Error(`Location error: ${error.message}`)),
      {
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 60_000,
      },
    );
  });
}

/**
 * Reverse geocode using OpenStreetMap Nominatim (free, no API key needed).
 * For production use Google Maps Geocoding API for reliability.
 */
export async function reverseGeocode(coords: Coordinates): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.latitude}&lon=${coords.longitude}`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'TravelJournalApp/1.0' },
    });
    const data = await response.json();
    const address = data.address;
    const parts = [
      address?.city || address?.town || address?.village,
      address?.state,
      address?.country,
    ].filter(Boolean);
    return parts.join(', ') || 'Unknown location';
  } catch {
    return `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
  }
}

export async function fetchLocationWithName(): Promise<{
  coordinates: Coordinates;
  locationName: string;
}> {
  const coordinates = await getCurrentLocation();
  const locationName = await reverseGeocode(coordinates);
  return { coordinates, locationName };
}
