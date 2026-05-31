import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { submitRatingToServer } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import { colors } from '../utils/colors';
import SafetyRatingSlider from '../components/SafetyRatingSlider';
import TagSelector from '../components/TagSelector';

export default function RatingScreen({ visible, coords, onClose }) {
  const [rating, setRating] = useState(3);
  const [selectedTags, setSelectedTags] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const { fetchHeatmapData } = useAppStore();

  const handlePost = async () => {
    if (!coords) return;

    setSubmitting(true);
    try {
      await submitRatingToServer(
        coords.latitude,
        coords.longitude,
        rating,
        selectedTags
      );

      await fetchHeatmapData();

      // Alert after state is updated
      Alert.alert(
        'Submitted!',
        'Your anonymous rating has been submitted. Thank you!',
        [{ text: 'OK', onPress: handleClose }]
      );
    } catch (err) {
      console.error('submitRating error:', err);
      Alert.alert('Error', 'Could not submit rating. Check your connection.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setRating(3);
    setSelectedTags([]);
    onClose();
  };

  const coordLabel = coords
    ? `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`
    : '';

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            {/* Drag handle */}
            <View style={styles.handle} />

            {/* Header */}
            <View style={styles.headerRow}>
              <Text style={styles.title}>Safety Survey</Text>
              <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.closeX}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.locText}>📍 {coordLabel}</Text>

            {/* Scrollable body */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scrollBody}
            >
              <SafetyRatingSlider rating={rating} onRatingChange={setRating} />
              <TagSelector selectedTags={selectedTags} onTagsChange={setSelectedTags} />

              <TouchableOpacity
                style={[styles.submitBtn, submitting && styles.submitDisabled]}
                onPress={handlePost}
                disabled={submitting}
                activeOpacity={0.8}
              >
                {submitting
                  ? <ActivityIndicator color="#FFF" />
                  : <Text style={styles.submitText}>Submit Rating</Text>
                }
              </TouchableOpacity>

              <Text style={styles.disclaimer}>
                🔒 Fully anonymous. No location history, no personal data stored.
              </Text>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
    maxHeight: '90%',
  },
  handle: {
    width: 40,
    height: 5,
    backgroundColor: '#334',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  closeX: {
    color: colors.muted,
    fontSize: 20,
    padding: 4,
  },
  locText: {
    color: colors.muted,
    fontSize: 12,
    marginBottom: 12,
  },
  scrollBody: {
    paddingBottom: 8,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  submitDisabled: {
    opacity: 0.55,
  },
  submitText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  disclaimer: {
    color: colors.muted,
    fontSize: 10,
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 15,
    opacity: 0.75,
  },
});
