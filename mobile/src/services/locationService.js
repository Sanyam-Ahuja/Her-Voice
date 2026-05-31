import * as Location from 'expo-location';

export async function requestLocationPermission() {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch (err) {
    console.error('Error requesting location permissions', err);
    return false;
  }
}

export async function getCurrentLocation() {
  try {
    const isGranted = await requestLocationPermission();
    if (!isGranted) return null;

    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced
    });
    return {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude
    };
  } catch (err) {
    console.error('Error getting current location', err);
    return null;
  }
}

export async function watchLocation(onLocationUpdate) {
  try {
    const isGranted = await requestLocationPermission();
    if (!isGranted) return null;

    return await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 3000, // Update every 3 seconds
        distanceInterval: 2 // Update if user moves 2 meters
      },
      (loc) => {
        onLocationUpdate({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude
        });
      }
    );
  } catch (err) {
    console.error('Error watching live location', err);
    return null;
  }
}
