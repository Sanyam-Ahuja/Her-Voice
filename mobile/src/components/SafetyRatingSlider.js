import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../utils/colors';

const RATING_STEPS = [
  { val: 1, emoji: '😨', label: 'Unsafe' },
  { val: 2, emoji: '😟', label: 'Risky' },
  { val: 3, emoji: '😐', label: 'Neutral' },
  { val: 4, emoji: '🙂', label: 'Safe' },
  { val: 5, emoji: '😊', label: 'Very Safe' }
];

export default function SafetyRatingSlider({ rating, onRatingChange }) {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>How safe do you feel here?</Text>
      <View style={styles.row}>
        {RATING_STEPS.map((step) => {
          const isSelected = rating === step.val;
          let activeColor = colors.moderate;
          if (step.val >= 4) activeColor = colors.safe;
          if (step.val <= 2) activeColor = colors.danger;

          return (
            <TouchableOpacity
              key={step.val}
              style={[
                styles.card,
                isSelected && { backgroundColor: activeColor, borderColor: activeColor }
              ]}
              onPress={() => onRatingChange(step.val)}
              activeOpacity={0.7}
            >
              <Text style={styles.emoji}>{step.emoji}</Text>
              <Text style={[styles.num, isSelected && styles.activeText]}>
                {step.val}
              </Text>
              <Text style={[styles.label, isSelected && styles.activeText]}>
                {step.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 15,
    alignItems: 'center',
  },
  header: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 8,
  },
  card: {
    flex: 1,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: '#334',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  emoji: {
    fontSize: 22,
    marginBottom: 4,
  },
  num: {
    color: colors.text,
    fontSize: 14,
    fontWeight: 'bold',
  },
  label: {
    color: colors.muted,
    fontSize: 9,
    marginTop: 2,
  },
  activeText: {
    color: '#FFF',
    fontWeight: 'bold',
  }
});
