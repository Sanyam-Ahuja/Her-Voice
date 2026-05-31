import React, { useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '../store/useAppStore';
import { colors } from '../utils/colors';
import LeafletMap from '../components/LeafletMap';
import TimeFilterBar from '../components/TimeFilterBar';
import SOSButton from '../components/SOSButton';

export default function MapScreen({ onOpenRating }) {
  const insets = useSafeAreaInsets();
  const { userLocation, heatmapCells, fetchHeatmapData, isLoading } = useAppStore();

  // Track the current map center so we know where to submit a rating
  const [mapCenter, setMapCenter] = useState(null);

  const handleRegionChange = useCallback((region) => {
    setMapCenter({ latitude: region.latitude, longitude: region.longitude });

    const bounds = {
      sw: { latitude: region.sw.lat, longitude: region.sw.lng },
      ne: { latitude: region.ne.lat, longitude: region.ne.lng }
    };
    fetchHeatmapData(bounds);
  }, [fetchHeatmapData]);

  const handleRatePress = () => {
    // Prefer map center (where user is looking) over GPS location
    const coords = mapCenter || userLocation;
    if (coords) {
      onOpenRating(coords);
    }
  };

  const handleRecenter = () => {
    // Tell the WebView map to animate back to the user marker
    LeafletMap.recenter();
  };

  return (
    <View style={styles.container}>
      {/* Full-screen Leaflet map */}
      <LeafletMap
        userLocation={userLocation}
        heatmapCells={heatmapCells}
        onRegionChange={handleRegionChange}
      />

      {/* Top filter bar */}
      <View style={[styles.topOverlay, { paddingTop: Math.max(insets.top, 16) }]}>
        <TimeFilterBar />
        {isLoading && (
          <View style={styles.loadingPill}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        )}
      </View>

      {/* Re-center button */}
      <TouchableOpacity
        style={[styles.recenterBtn, { bottom: 130 + insets.bottom }]}
        onPress={handleRecenter}
        activeOpacity={0.8}
      >
        <Text style={styles.recenterIcon}>📍</Text>
      </TouchableOpacity>

      {/* Bottom bar: SOS + Rate button */}
      <View style={[styles.bottomBar, { bottom: Math.max(insets.bottom + 16, 24) }]}>
        <SOSButton />
        <TouchableOpacity
          style={styles.rateBtn}
          onPress={handleRatePress}
          activeOpacity={0.8}
        >
          <Text style={styles.rateBtnText}>Rate This Area ★</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d1a',
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  loadingPill: {
    backgroundColor: 'rgba(26,26,46,0.85)',
    borderRadius: 14,
    padding: 6,
    marginTop: 8,
  },
  recenterBtn: {
    position: 'absolute',
    right: 16,
    backgroundColor: colors.card,
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  recenterIcon: {
    fontSize: 20,
  },
  bottomBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rateBtn: {
    flex: 1,
    marginLeft: 14,
    height: 56,
    backgroundColor: colors.primary,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
  },
  rateBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },
});
