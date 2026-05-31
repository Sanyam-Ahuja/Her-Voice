import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useAppStore } from '../store/useAppStore';
import { colors } from '../utils/colors';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function formatHour(h) {
  if (h === 0) return '12 AM';
  if (h === 12) return '12 PM';
  return h > 12 ? `${h - 12} PM` : `${h} AM`;
}

function getTimeBlockLabel(h) {
  if (h >= 22 || h < 6) return 'Late Night (Quiet)';
  if (h >= 6 && h < 10) return 'Morning (Commute)';
  if (h >= 10 && h < 16) return 'Midday (Active)';
  return 'Evening (Rush)';
}

export default function TimeFilterBar() {
  const { selectedHour, setSelectedHour } = useAppStore();
  const scrollViewRef = useRef(null);

  const currentHour = new Date().getHours();
  const displayHour = selectedHour === 'live' ? currentHour : selectedHour;

  return (
    <View style={styles.container}>
      {/* Title / Description of the active time block */}
      <View style={styles.header}>
        <Text style={styles.blockLabel}>
          {selectedHour === 'live' ? `Live — ${getTimeBlockLabel(displayHour)}` : getTimeBlockLabel(displayHour)}
        </Text>
        <Text style={styles.timeLabel}>{formatHour(displayHour)}</Text>
      </View>

      <View style={styles.sliderContainer}>
        {/* Live Snap Button */}
        <TouchableOpacity
          style={[styles.liveBtn, selectedHour === 'live' && styles.activeLiveBtn]}
          onPress={() => setSelectedHour('live')}
          activeOpacity={0.8}
        >
          <View style={[styles.pulseDot, selectedHour === 'live' && styles.activePulseDot]} />
          <Text style={[styles.liveText, selectedHour === 'live' && styles.activeLiveText]}>LIVE</Text>
        </TouchableOpacity>

        {/* Vertical Divider */}
        <View style={styles.divider} />

        {/* Timeline Scrubber */}
        <ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {HOURS.map((h) => {
            const isSelected = selectedHour !== 'live' && selectedHour === h;
            return (
              <TouchableOpacity
                key={h}
                style={[styles.hourTab, isSelected && styles.activeHourTab]}
                onPress={() => setSelectedHour(h)}
                activeOpacity={0.7}
              >
                <Text style={[styles.hourText, isSelected && styles.activeHourText]}>
                  {formatHour(h)}
                </Text>
                {/* Visual Tick */}
                <View style={[styles.tick, isSelected && styles.activeTick]} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(26, 26, 46, 0.93)',
    borderRadius: 20,
    padding: 10,
    width: '92%',
    maxWidth: 380,
    alignSelf: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#2e2e46',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  blockLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  timeLabel: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  activeLiveBtn: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.muted,
    marginRight: 6,
  },
  activePulseDot: {
    backgroundColor: '#10B981',
  },
  liveText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  activeLiveText: {
    color: '#10B981',
  },
  divider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginHorizontal: 8,
  },
  scrollContent: {
    alignItems: 'center',
  },
  hourTab: {
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginHorizontal: 2,
  },
  activeHourTab: {
    backgroundColor: 'rgba(108, 63, 197, 0.15)',
    borderRadius: 8,
  },
  hourText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '600',
  },
  activeHourText: {
    color: colors.accent,
    fontWeight: '800',
  },
  tick: {
    width: 2,
    height: 3,
    borderRadius: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginTop: 4,
  },
  activeTick: {
    backgroundColor: colors.accent,
    height: 5,
  },
});
