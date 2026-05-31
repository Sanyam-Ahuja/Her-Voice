import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAppStore } from '../store/useAppStore';
import { colors } from '../utils/colors';

export default function TimeFilterBar() {
  const { timeFilter, setTimeFilter } = useAppStore();

  const options = [
    { label: 'All Time', value: 'all' },
    { label: '☀️ Day', value: 'day' },
    { label: '🌙 Night', value: 'night' }
  ];

  return (
    <View style={styles.bar}>
      {options.map((opt) => {
        const isActive = timeFilter === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[styles.tab, isActive && styles.activeTab]}
            onPress={() => setTimeFilter(opt.value)}
          >
            <Text style={[styles.text, isActive && styles.activeText]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 25,
    padding: 4,
    marginHorizontal: 16,
    marginTop: 10,
    alignSelf: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  activeTab: {
    backgroundColor: colors.primary,
  },
  text: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '600',
  },
  activeText: {
    color: '#FFF',
  }
});
