import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { colors } from '../utils/colors';

const PRESET_TAGS = [
  'Poor Lighting',
  'Lonely Area',
  'Harassment History',
  'Good Police Presence',
  'Well Crowded',
  'Safe at Night',
  'Unsafe Transport Stop',
  'Construction/Isolated',
];

export default function TagSelector({ selectedTags, onTagsChange }) {
  const [inputText, setInputText] = useState('');

  const toggle = (tag) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter((t) => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  };

  const addCustom = () => {
    const clean = inputText.trim();
    if (clean && !selectedTags.includes(clean)) {
      onTagsChange([...selectedTags, clean]);
    }
    setInputText('');
  };

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>Tags (optional)</Text>

      {/* Plain View with flexWrap — renders all chips without scroll */}
      <View style={styles.chipGrid}>
        {PRESET_TAGS.map((tag) => {
          const active = selectedTags.includes(tag);
          return (
            <TouchableOpacity
              key={tag}
              onPress={() => toggle(tag)}
              style={[styles.chip, active && styles.chipActive]}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {tag}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Custom tag input */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Custom tag…"
          placeholderTextColor={colors.muted}
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={addCustom}
          returnKeyType="done"
          maxLength={40}
        />
        <TouchableOpacity style={styles.addBtn} onPress={addCustom} activeOpacity={0.8}>
          <Text style={styles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Show user-added custom tags */}
      {selectedTags.filter((t) => !PRESET_TAGS.includes(t)).length > 0 && (
        <View style={styles.chipGrid}>
          {selectedTags
            .filter((t) => !PRESET_TAGS.includes(t))
            .map((tag) => (
              <TouchableOpacity
                key={tag}
                onPress={() => toggle(tag)}
                style={[styles.chip, styles.chipActive]}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, styles.chipTextActive]}>
                  {tag} ✕
                </Text>
              </TouchableOpacity>
            ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 12,
    width: '100%',
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#334',
    borderRadius: 18,
    paddingVertical: 6,
    paddingHorizontal: 12,
    margin: 4,
    backgroundColor: colors.bg,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.muted,
    fontSize: 12,
  },
  chipTextActive: {
    color: '#FFF',
    fontWeight: '500',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: '#334',
    borderRadius: 22,
    marginTop: 8,
    paddingLeft: 14,
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    paddingVertical: 8,
  },
  addBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    backgroundColor: colors.card,
  },
  addBtnText: {
    color: colors.accent,
    fontSize: 22,
    fontWeight: 'bold',
    lineHeight: 26,
  },
});
