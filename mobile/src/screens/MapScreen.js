import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '../store/useAppStore';
import { colors } from '../utils/colors';
import LeafletMap from '../components/LeafletMap';
import TimeFilterBar from '../components/TimeFilterBar';
import SOSButton from '../components/SOSButton';
import { watchLocation } from '../services/locationService';

// Custom vector-styled recenter crosshair icon
function RecenterIcon() {
  return (
    <View style={styles.crosshairContainer}>
      <View style={styles.crosshairCircle} />
      <View style={styles.crosshairDot} />
      <View style={[styles.crosshairTick, { top: 2, width: 2, height: 4 }]} />
      <View style={[styles.crosshairTick, { bottom: 2, width: 2, height: 4 }]} />
      <View style={[styles.crosshairTick, { left: 2, width: 4, height: 2 }]} />
      <View style={[styles.crosshairTick, { right: 2, width: 4, height: 2 }]} />
    </View>
  );
}

export default function MapScreen({ onOpenRating }) {
  const insets = useSafeAreaInsets();
  const { userLocation, setUserLocation, heatmapCells, fetchHeatmapData, isLoading } = useAppStore();

  // Watch user location live as they move (like Google Maps)
  useEffect(() => {
    let sub = null;
    async function startTracking() {
      sub = await watchLocation((coords) => {
        setUserLocation(coords);
      });
    }
    startTracking();

    return () => {
      if (sub && typeof sub.remove === 'function') {
        sub.remove();
      }
    };
  }, [setUserLocation]);

  // Heatmap boundaries update when map is scrolled/panned
  const handleRegionChange = useCallback((region) => {
    const bounds = {
      sw: { latitude: region.sw.lat, longitude: region.sw.lng },
      ne: { latitude: region.ne.lat, longitude: region.ne.lng }
    };
    fetchHeatmapData(bounds);
  }, [fetchHeatmapData]);

  const handleRatePress = () => {
    // Force ratings to use actual live GPS location rather than manual picking
    if (userLocation) {
      onOpenRating(userLocation);
    } else {
      Alert.alert(
        'Location Unavailable',
        'Could not determine your current coordinates. Please check your GPS and permissions.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleRecenter = () => {
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
        <RecenterIcon />
      </TouchableOpacity>

      {/* Bottom bar: SOS + Rate button */}
      <View style={[styles.bottomBar, { bottom: Math.max(insets.bottom + 16, 24) }]}>
        <SOSButton />
        <TouchableOpacity
          style={styles.rateBtn}
          onPress={handleRatePress}
          activeOpacity={0.8}
        >
          <Text style={styles.rateBtnText}>Rate Current Area</Text>
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
  // Recenter button
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
    borderWidth: 1,
    borderColor: '#2e2e46',
  },
  // Recenter Crosshair styles
  crosshairContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  crosshairCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.text,
  },
  crosshairDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
    position: 'absolute',
  },
  crosshairTick: {
    position: 'absolute',
    backgroundColor: colors.text,
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
