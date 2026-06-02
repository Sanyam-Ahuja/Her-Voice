import React, { useRef, useEffect, useCallback, useMemo } from 'react';
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
    html, body, #map { width: 100%; height: 100%; background: #18182c; }
    /* Lighter dark mode tiles (using CartoDB Dark Matter with increased brightness filter) */
    .leaflet-tile-pane { filter: brightness(1.05) saturate(0.85); }
    .leaflet-control-attribution { display: none; }
    .leaflet-control-zoom a {
      background: #1e1e38 !important;
      color: #f8f8ff !important;
      border-color: #3f3f5c !important;
    }
    /* Blur overlay for organic heatmap splurges */
    .heat-splurge {
      filter: blur(22px);
      pointer-events: none;
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
    var userPulseRing = null;
    var hasCenteredOnUser = false;

    // Called from React Native to update heatmap cells
    function updateHeatmap(cells) {
      heatCircles.forEach(function(c) { map.removeLayer(c); });
      heatCircles = [];

      cells.forEach(function(cell) {
        var score = cell.score;
        var color = '#F59E0B'; // moderate (amber)
        if (score >= 4.0) color = '#10B981'; // safe (emerald green)
        else if (score < 2.5) color = '#EF4444'; // danger (crimson)

        // Scale opacity based on relevance weight (minimum 0.15, maximum 0.60)
        var opacity = Math.min(0.15 + ((cell.weight || 1.0) * 0.18), 0.60);

        // Draw borderless circles with blur filter for organic heatmap splurges
        var circle = L.circle([cell.center.lat, cell.center.lng], {
          radius: 140,
          fillColor: color,
          fillOpacity: opacity,
          stroke: false,
          className: 'heat-splurge'
        }).addTo(map);

        heatCircles.push(circle);
      });
    }

    // Called from React Native to move to user location
    function setUserLocation(lat, lng) {
      var latLng = [lat, lng];
      window.currentUserLatLng = latLng;

      if (userMarker) {
        userMarker.setLatLng(latLng);
      } else {
        // White-bordered blue dot location marker
        userMarker = L.circleMarker(latLng, {
          radius: 7,
          fillColor: '#1A73E8',
          fillOpacity: 1,
          color: '#FFFFFF',
          weight: 2.5
        }).addTo(map);
      }

      if (userPulseRing) {
        userPulseRing.setLatLng(latLng);
      } else {
        // Add a Google Maps-style soft blue pulsing circle aura
        userPulseRing = L.circle(latLng, {
          radius: 40,
          fillColor: '#1A73E8',
          fillOpacity: 0.15,
          color: 'transparent',
          weight: 0
        }).addTo(map);
      }

      // Only center map on user on first initial coordinate loading
      if (!hasCenteredOnUser) {
        map.setView(latLng, 15);
        hasCenteredOnUser = true;
      }
    }

    // Post drag state starting back to React Native
    map.on('movestart', function() {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'mapDragStart'
      }));
    });

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
        if (msg.type === 'recenter' && window.currentUserLatLng) {
          map.setView(window.currentUserLatLng, 15, { animate: true });
        }
      } catch(e) {}
    }
  </script>
</body>
</html>
  `;
}

export default function LeafletMap({ userLocation, heatmapCells, onRegionChange, onMapDragStart }) {
  const webRef = useRef(null);

  // Memoize the map HTML to prevent WebView reloads when coordinates update
  const mapHtml = useMemo(() => buildMapHtml(28.6139, 77.2090), []);

  // Send a message to the WebView
  const postMsg = useCallback((obj) => {
    if (!webRef.current) return;
    webRef.current.postMessage(JSON.stringify(obj));
  }, []);

  // When heatmap cells update, push them into the map
  useEffect(() => {
    postMsg({ type: 'updateHeatmap', cells: heatmapCells });
  }, [heatmapCells, postMsg]);

  // When user location arrives, update marker position
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
      } else if (msg.type === 'mapDragStart' && onMapDragStart) {
        onMapDragStart();
      }
    } catch (_) {}
  }, [onRegionChange, onMapDragStart]);

  return (
    <View style={styles.container}>
      <WebView
        ref={webRef}
        style={styles.webview}
        originWhitelist={['*']}
        source={{ html: mapHtml }}
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
    backgroundColor: '#18182c',
  }
});
