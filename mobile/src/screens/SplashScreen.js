import React, { useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { getHashedUUID } from '../services/deviceService';
import { cleanupRateLimitHistory } from '../services/rateLimitService';
import { getCurrentLocation } from '../services/locationService';
import { useAppStore } from '../store/useAppStore';
import { colors } from '../utils/colors';

export default function SplashScreen({ onLoaded }) {
  const setUserLocation = useAppStore((s) => s.setUserLocation);
  const fetchHeatmapData = useAppStore((s) => s.fetchHeatmapData);

  // Keep a ref so we can clear the timeout if the component unmounts early
  const timerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        await getHashedUUID();
        await cleanupRateLimitHistory();

        const loc = await getCurrentLocation();
        if (!cancelled && loc) {
          setUserLocation(loc);
        }

        // Best-effort heatmap prefetch — don't block if it fails
        try {
          await fetchHeatmapData();
        } catch (_) {}
      } catch (err) {
        console.warn('Splash init error:', err);
      }

      if (!cancelled) {
        timerRef.current = setTimeout(onLoaded, 1000);
      }
    }

    init();

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []); // intentionally empty — runs once on mount

  return (
    <View style={styles.container}>
      <View style={styles.center}>
        <Text style={styles.title}>HerVoice</Text>
        <Text style={styles.subtitle}>Empowering Safety Through Collective Signals</Text>
        <ActivityIndicator size="large" color={colors.accent} style={styles.loader} />
      </View>
      <Text style={styles.footer}>100% Anonymous & Private</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: colors.text,
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 22,
    maxWidth: 260,
  },
  loader: {
    marginTop: 48,
  },
  footer: {
    color: colors.muted,
    fontSize: 12,
    opacity: 0.55,
  },
});
