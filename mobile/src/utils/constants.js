// API_URL resolution order:
//   1. EXPO_PUBLIC_API_URL env var (set this in production or when using a Wi-Fi IP)
//   2. localhost:3000 — works on both iOS simulator AND Android real device via `adb reverse tcp:3000 tcp:3000`
export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

export const MAP_REGION_DELTA = 0.015;
export const API_KEY = process.env.EXPO_PUBLIC_API_KEY || 'hervoice_dev_secret_key_change_me_in_prod';
