import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import SplashScreen from './src/screens/SplashScreen';
import MapScreen from './src/screens/MapScreen';
import RatingScreen from './src/screens/RatingScreen';

export default function App() {
  const [screen, setScreen] = useState('splash');
  const [ratingVisible, setRatingVisible] = useState(false);
  const [ratingCoords, setRatingCoords] = useState(null);

  const handleOpenRating = (coords) => {
    setRatingCoords(coords);
    setRatingVisible(true);
  };

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      
      {screen === 'splash' ? (
        <SplashScreen onLoaded={() => setScreen('map')} />
      ) : (
        <>
          <MapScreen onOpenRating={handleOpenRating} />
          <RatingScreen
            visible={ratingVisible}
            coords={ratingCoords}
            onClose={() => setRatingVisible(false)}
          />
        </>
      )}
    </SafeAreaProvider>
  );
}
