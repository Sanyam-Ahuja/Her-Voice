import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../utils/colors';

const RATING_STEPS = [
  { val: 1, label: 'Unsafe' },
  { val: 2, label: 'Risky' },
  { val: 3, label: 'Neutral' },
  { val: 4, label: 'Safe' },
  { val: 5, label: 'Very Safe' }
];

export default function SafetyRatingSlider({ rating, onRatingChange }) {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Rate Area Safety</Text>
      <View style={styles.row}>
        {RATING_STEPS.map((step) => {
          const isSelected = rating === step.val;
          
          // Color coding for each rating
          let ratingColor = colors.moderate;
          if (step.val >= 4) ratingColor = colors.safe;
          if (step.val <= 2) ratingColor = colors.danger;

          return (
            <TouchableOpacity
              key={step.val}
              style={[
                styles.card,
                isSelected && { 
                  backgroundColor: ratingColor, 
                  borderColor: ratingColor,
                  transform: [{ scale: 1.05 }]
                }
              ]}
              onPress={() => onRatingChange(step.val)}
              activeOpacity={0.8}
            >
              <View style={[
                styles.numCircle,
                isSelected && styles.activeNumCircle
              ]}>
                <Text style={[
                  styles.numText,
                  isSelected ? { color: ratingColor, fontWeight: '800' } : { color: colors.text }
                ]}>
                  {step.val}
                </Text>
              </View>
              <Text style={[
                styles.label, 
                isSelected ? styles.activeLabelText : { color: colors.muted }
              ]}>
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
    marginVertical: 18,
    alignItems: 'center',
    width: '100%',
  },
  header: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 14,
    letterSpacing: 0.2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  card: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: '#2e2e46',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginHorizontal: 3,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  numCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  activeNumCircle: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
  },
  numText: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  label: {
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
  },
  activeLabelText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  }
});
