import React, { useRef, useEffect, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

// Build the full HTML page for Leaflet once, outside the component
function buildMapHtml(initLat, initLng) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; background: #0d0d1a; }
    .leaflet-tile-pane { filter: brightness(0.7) saturate(0.6); }
    .leaflet-control-attribution { display: none; }
    .leaflet-control-zoom a {
      background: #1a1a2e !important;
      color: #f8f8ff !important;
      border-color: #334 !important;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', {
      center: [${initLat}, ${initLng}],
      zoom: 15,
      zoomControl: true
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19
    }).addTo(map);

    var heatCircles = [];
    var userMarker = null;

    // Called from React Native to update heatmap cells
    function updateHeatmap(cells) {
      heatCircles.forEach(function(c) { map.removeLayer(c); });
      heatCircles = [];

      cells.forEach(function(cell) {
        var score = cell.score;
        var color = '#F59E0B'; // moderate
        if (score >= 4.0) color = '#10B981';
        else if (score < 2.5) color = '#EF4444';

        var circle = L.circle([cell.center.lat, cell.center.lng], {
          radius: 100,
          fillColor: color,
          fillOpacity: 0.35,
          color: color,
          opacity: 0.7,
          weight: 1.5
        }).addTo(map);

        heatCircles.push(circle);
      });
    }

    // Called from React Native to move to user location
    function setUserLocation(lat, lng) {
      if (userMarker) {
        map.removeLayer(userMarker);
      }
      userMarker = L.circleMarker([lat, lng], {
        radius: 9,
        fillColor: '#6C3FC5',
        fillOpacity: 1,
        color: '#A78BFA',
        weight: 3
      }).addTo(map);
      map.setView([lat, lng], 15, { animate: true });
    }

    // Post map center back to React Native when user moves map
    map.on('moveend', function() {
      var center = map.getCenter();
      var bounds = map.getBounds();
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'regionChange',
        lat: center.lat,
        lng: center.lng,
        sw: { lat: bounds.getSouthWest().lat, lng: bounds.getSouthWest().lng },
        ne: { lat: bounds.getNorthEast().lat, lng: bounds.getNorthEast().lng }
      }));
    });

    // Listen for messages from React Native
    document.addEventListener('message', function(e) { handleMsg(e.data); });
    window.addEventListener('message', function(e) { handleMsg(e.data); });

    function handleMsg(raw) {
      try {
        var msg = JSON.parse(raw);
        if (msg.type === 'updateHeatmap') updateHeatmap(msg.cells);
        if (msg.type === 'setUserLocation') setUserLocation(msg.lat, msg.lng);
        if (msg.type === 'recenter' && userMarker) {
          map.setView(userMarker.getLatLng(), 15, { animate: true });
        }
      } catch(e) {}
    }
  </script>
</body>
</html>
  `;
}

export default function LeafletMap({ userLocation, heatmapCells, onRegionChange }) {
  const webRef = useRef(null);

  // Send a message to the WebView
  const postMsg = useCallback((obj) => {
    if (!webRef.current) return;
    webRef.current.postMessage(JSON.stringify(obj));
  }, []);

  // When heatmap cells update, push them into the map
  useEffect(() => {
    postMsg({ type: 'updateHeatmap', cells: heatmapCells });
  }, [heatmapCells, postMsg]);

  // When user location arrives, center and show marker
  useEffect(() => {
    if (userLocation) {
      postMsg({
        type: 'setUserLocation',
        lat: userLocation.latitude,
        lng: userLocation.longitude
      });
    }
  }, [userLocation, postMsg]);

  // Expose recenter function via ref externally (called from MapScreen)
  LeafletMap.recenter = () => postMsg({ type: 'recenter' });

  const defaultLat = userLocation ? userLocation.latitude : 28.6139;
  const defaultLng = userLocation ? userLocation.longitude : 77.2090;

  const handleMessage = useCallback((event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'regionChange' && onRegionChange) {
        onRegionChange({
          latitude: msg.lat,
          longitude: msg.lng,
          sw: msg.sw,
          ne: msg.ne
        });
      }
    } catch (_) {}
  }, [onRegionChange]);

  return (
    <View style={styles.container}>
      <WebView
        ref={webRef}
        style={styles.webview}
        originWhitelist={['*']}
        source={{ html: buildMapHtml(defaultLat, defaultLng) }}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mixedContentMode="always"
        allowFileAccess={true}
        scrollEnabled={false}
        bounces={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: '#0d0d1a',
  }
});
