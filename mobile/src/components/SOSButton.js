import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert, Linking } from 'react-native';
import { colors } from '../utils/colors';

export default function SOSButton() {
  const triggerSOS = () => {
    Alert.alert(
      'Emergency Call',
      'Are you sure you want to call emergency services (112)?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Call 112', 
          style: 'destructive',
          onPress: () => Linking.openURL('tel:112').catch(err => {
            Alert.alert('Error', 'Unable to initiate call. Please dial 112 manually.');
          })
        }
      ]
    );
  };

  return (
    <TouchableOpacity style={styles.btn} onPress={triggerSOS} activeOpacity={0.85}>
      <Text style={styles.text}>SOS</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: colors.danger,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  text: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'System'
  }
});
