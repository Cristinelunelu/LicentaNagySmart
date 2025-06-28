// lib/backgroundLocation.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { ref, set } from 'firebase/database';
import { db } from './firebaseConfig';

const TASK_NAME = 'background-location-task';

TaskManager.defineTask(TASK_NAME, async ({ data, error }: TaskManager.TaskManagerTaskBody) => {
  if (error) {
    console.error('❌ Background task error:', error);
    return;
  }

  const locationData = data as { locations: Location.LocationObject[] };
  if (!locationData || !locationData.locations || locationData.locations.length === 0) {
    console.warn('⚠️ No locations available');
    return;
  }

  const { latitude, longitude } = locationData.locations[0].coords;

  try {
    const snapshot = await fetch('https://licenta-smart-home-default-rtdb.europe-west1.firebasedatabase.app/home/location.json');
    const homeCoords = await snapshot.json();

    if (!homeCoords.latitude || !homeCoords.longitude) return;

    const distance = getDistanceMeters(latitude, longitude, homeCoords.latitude, homeCoords.longitude);

    if (distance < 150) {
      const autoLamp = await AsyncStorage.getItem('autoLamp');
      const autoBarrier = await AsyncStorage.getItem('autoBarrier');

      if (autoLamp === 'true') {
        await set(ref(db, 'lamp/status/state'), 'ON');
      }
      if (autoBarrier === 'true') {
        await set(ref(db, 'barrier/status/state'), 'OPEN');
      }
    }
  } catch (err) {
    console.error('❌ Background logic failed:', err);
  }
});

function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const startBackgroundTracking = async () => {
  const { status } = await Location.requestBackgroundPermissionsAsync();
  if (status !== 'granted') {
    console.warn('❌ Background location permission not granted');
    return;
  }

  const hasStarted = await Location.hasStartedLocationUpdatesAsync(TASK_NAME);
  if (!hasStarted) {
    await Location.startLocationUpdatesAsync(TASK_NAME, {
      accuracy: Location.Accuracy.High,
      timeInterval: 10000,
      distanceInterval: 0,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Locație în fundal',
        notificationBody: 'Se verifică automat distanța față de casă...'
      }
    });
  }
};