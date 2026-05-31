import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const UUID_KEY = 'hervoice_device_uuid';
let cachedHash = null;

export async function getHashedUUID() {
  if (cachedHash) return cachedHash;

  try {
    let uuid = await AsyncStorage.getItem(UUID_KEY);
    if (!uuid) {
      uuid = Crypto.randomUUID();
      await AsyncStorage.setItem(UUID_KEY, uuid);
    }

    // Hash it with SHA-256 to ensure absolute anonymity on the server
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      uuid
    );

    cachedHash = hash;
    return hash;
  } catch (err) {
    console.error('Error generating device identifier', err);
    // Fallback to random value in memory for this session if storage fails
    return Crypto.randomUUID();
  }
}
