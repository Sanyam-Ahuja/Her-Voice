import axios from 'axios';
import { API_URL, API_KEY } from '../utils/constants';
import { getHashedUUID } from './deviceService';
import { checkRateLimit, saveRatingToHistory } from './rateLimitService';

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000
});

// Automatically inject hashed device UUID and API Key into headers
api.interceptors.request.use(async (config) => {
  try {
    const hash = await getHashedUUID();
    config.headers['X-Device-ID'] = hash;
    config.headers['X-API-Key'] = API_KEY;
  } catch (err) {
    console.error('Failed to inject request headers', err);
  }
  return config;
});

export async function fetchHeatmap(bounds = null, hour = 'live') {
  try {
    let url = `/heatmap?hour=${hour}`;
    if (bounds) {
      const { sw, ne } = bounds;
      url += `&swLat=${sw.latitude}&swLng=${sw.longitude}&neLat=${ne.latitude}&neLng=${ne.longitude}`;
    }
    const res = await api.get(url);
    return res.data.cells || [];
  } catch (err) {
    console.error('Error fetching heatmap cells', err);
    return [];
  }
}

export async function submitRatingToServer(lat, lng, rating, tags) {
  try {
    const uuid = await getHashedUUID();
    const canSubmit = await checkRateLimit(lat, lng);

    if (!canSubmit) {
      // Local silent discard: simulate server success response without hitting network
      console.log('Local rate limit hit (6-day lock). Silently discarding submission.');
      return { success: true, simulated: true };
    }

    // Hit server API
    const res = await api.post('/ratings', {
      device_uuid: uuid,
      latitude: lat,
      longitude: lng,
      safety_rating: rating,
      tags,
      local_hour: new Date().getHours()
    });

    // Save submission locally to lock it for 6 days
    await saveRatingToHistory(lat, lng);

    return res.data;
  } catch (err) {
    console.error('Error sending rating to server', err);
    throw err;
  }
}

// export async function fetchTags() {
//   try {
//     const res = await api.get('/tags');
//     return res.data;
//   } catch (err) {
//     console.error('Error fetching tags list', err);
//     return { predefined: [], popular_custom: [] };
//   }
// }
