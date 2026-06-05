import AsyncStorage from '@react-native-async-storage/async-storage';
import { encodeHash } from '../utils/geohash';

const HISTORY_KEY = 'hervoice_rating_history';
const SIX_DAYS_MS = 6 * 24 * 60 * 60 * 1000;

async function getHistory() {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export async function checkRateLimit(lat, lng) {
  const cellId = encodeHash(lat, lng, 7);
  const history = await getHistory();
  const lastRated = history[cellId];

  if (!lastRated) return true;

  const diff = Date.now() - lastRated;
  return diff > SIX_DAYS_MS;
}

export async function saveRatingToHistory(lat, lng) {
  const cellId = encodeHash(lat, lng, 7);
  const history = await getHistory();
  
  history[cellId] = Date.now();
  
  try {
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (err) {
    console.error('Failed to save rate limit log', err);
  }
}

export async function cleanupRateLimitHistory() {
  const history = await getHistory();
  const now = Date.now();
  let updated = false;

  for (const [cellId, timeVal] of Object.entries(history)) {
    const diff = now - timeVal;
    if (diff > SIX_DAYS_MS) {
      delete history[cellId];
      updated = true;
    }
  }

  if (updated) {
    try {
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (_) {}
  }
}
