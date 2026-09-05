/**
 * LiveMap.js — Real-time location map using Leaflet + OpenStreetMap
 * 100% free. No API key. No Google Maps.
 *
 * Props:
 *  driverLocation   { latitude, longitude } | null  — 🚗 shown as purple truck marker
 *  customerLocation { latitude, longitude } | null  — 📍 shown as green pin marker
 *  height           CSS string (default '260px')
 *  showOpenInMaps   boolean — show "Open in OSM" button (default true)
 */
import React, { useEffect, useRef } from 'react';

// Import Leaflet CSS at module level (injected once into <head>)
import 'leaflet/dist/leaflet.css';

// ── Custom marker icons ──────────────────────────────────────────────────────
const driverSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
  <circle cx="20" cy="20" r="20" fill="#4f46e5" opacity="0.95"/>
  <text x="20" y="27" text-anchor="middle" font-size="20">🚗</text>
</svg>`;

const customerSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
  <circle cx="20" cy="20" r="20" fill="#059669" opacity="0.95"/>
  <text x="20" y="27" text-anchor="middle" font-size="20">📍</text>
</svg>`;

const svgToUrl = (svg) =>
  'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));

// Build icon once outside component to avoid re-creating on every render
let _L = null;  // cached Leaflet module
const getIcon = (svg) => {
  if (!_L) return null;
  return _L.icon({ iconUrl: svgToUrl(svg), iconSize: [40, 40], iconAnchor: [20, 40], popupAnchor: [0, -40] });
};

export default function LiveMap({
  driverLocation   = null,
  customerLocation = null,
  height           = '260px',
  showOpenInMaps   = true,
}) {
  const containerRef      = useRef(null);
  const mapRef            = useRef(null);     // Leaflet map instance
  const driverMarkerRef   = useRef(null);
  const customerMarkerRef = useRef(null);
  // Keep latest prop values accessible in effects without re-running them
  const driverLocRef   = useRef(driverLocation);
  const customerLocRef = useRef(customerLocation);
  driverLocRef.current   = driverLocation;
  customerLocRef.current = customerLocation;

  // ── Init map once ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    import('leaflet').then((L) => {
      // Guard: Leaflet throws if container already has a map
      if (containerRef.current._leaflet_id) return;

      _L = L;

      // Fix CRA broken default icon paths
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl:       require('leaflet/dist/images/marker-icon.png'),
        iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
        shadowUrl:     require('leaflet/dist/images/marker-shadow.png'),
      });

      const initialCenter =
        driverLocRef.current   ? [driverLocRef.current.latitude,   driverLocRef.current.longitude]   :
        customerLocRef.current ? [customerLocRef.current.latitude,  customerLocRef.current.longitude] :
        [30.7865, 31.0004]; // El-Santa default

      const map = L.map(containerRef.current, {
        center: initialCenter,
        zoom: 15,
        zoomControl: true,
        scrollWheelZoom: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;

      // Add initial markers if locations are already known
      if (driverLocRef.current) {
        driverMarkerRef.current = L.marker(
          [driverLocRef.current.latitude, driverLocRef.current.longitude],
          { icon: getIcon(driverSVG), title: 'السائق' }
        ).addTo(map).bindPopup('🚗 موقع السائق');
      }

      if (customerLocRef.current) {
        customerMarkerRef.current = L.marker(
          [customerLocRef.current.latitude, customerLocRef.current.longitude],
          { icon: getIcon(customerSVG), title: 'موقعك' }
        ).addTo(map).bindPopup('📍 موقعك');
      }

      autoFit(L, map, driverLocRef.current, customerLocRef.current);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current          = null;
        driverMarkerRef.current   = null;
        customerMarkerRef.current = null;
      }
    };
  // Intentionally empty — init once only
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Update driver marker ───────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !_L || !driverLocation) return;
    const latlng = [driverLocation.latitude, driverLocation.longitude];
    if (driverMarkerRef.current) {
      driverMarkerRef.current.setLatLng(latlng);
    } else {
      driverMarkerRef.current = _L.marker(latlng, { icon: getIcon(driverSVG), title: 'السائق' })
        .addTo(mapRef.current).bindPopup('🚗 موقع السائق');
    }
    // Use the ref for customer so we always get the CURRENT value, not stale closure
    autoFit(_L, mapRef.current, driverLocation, customerLocRef.current);
  }, [driverLocation]);

  // ── Update customer marker ─────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !_L || !customerLocation) return;
    const latlng = [customerLocation.latitude, customerLocation.longitude];
    if (customerMarkerRef.current) {
      customerMarkerRef.current.setLatLng(latlng);
    } else {
      customerMarkerRef.current = _L.marker(latlng, { icon: getIcon(customerSVG), title: 'موقعك' })
        .addTo(mapRef.current).bindPopup('📍 موقعك');
    }
    // Use the ref for driver so we always get the CURRENT value, not stale closure
    autoFit(_L, mapRef.current, driverLocRef.current, customerLocation);
  }, [customerLocation]);

  return (
    <div
      className="relative rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700"
      style={{ height }}
    >
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Open in OSM button */}
      {showOpenInMaps && driverLocation && (
        <a
          href={`https://www.openstreetmap.org/?mlat=${driverLocation.latitude}&mlon=${driverLocation.longitude}#map=16/${driverLocation.latitude}/${driverLocation.longitude}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ zIndex: 1000 }}
          className="absolute bottom-3 left-3 bg-white dark:bg-gray-800 text-primary-600 px-3 py-2 rounded-xl shadow-lg flex items-center gap-2 text-xs font-bold hover:bg-gray-50 transition-all"
        >
          🗺 فتح في الخريطة
        </a>
      )}
    </div>
  );
}

// ── Auto-fit map to show both markers ─────────────────────────────────────────
function autoFit(L, map, driverLoc, customerLoc) {
  if (!L || !map) return;
  try {
    if (driverLoc && customerLoc) {
      // Only fit if they're far enough apart (> ~50m) to avoid excessive zoom-out
      const d = Math.abs(driverLoc.latitude - customerLoc.latitude) +
                Math.abs(driverLoc.longitude - customerLoc.longitude);
      if (d > 0.001) {
        map.fitBounds(
          L.latLngBounds(
            [driverLoc.latitude,    driverLoc.longitude],
            [customerLoc.latitude,  customerLoc.longitude]
          ),
          { padding: [48, 48], maxZoom: 16 }
        );
        return;
      }
    }
    // Single marker or very close — just pan, keep current zoom
    const focus = driverLoc || customerLoc;
    if (focus) map.panTo([focus.latitude, focus.longitude]);
  } catch { /* map may not be ready yet */ }
}
