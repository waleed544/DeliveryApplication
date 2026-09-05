/**
 * MapView.js — Static location map using Leaflet + OpenStreetMap (free, no API key)
 * Drop-in replacement for the old Google Maps embed component.
 */
import React, { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

export default function MapView({
  lat   = 30.7865,
  lng   = 31.0004,
  zoom  = 15,
  height = '220px',
  label  = 'الموقع',
}) {
  const containerRef   = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    // Guard: Leaflet throws if container already has a map
    if (containerRef.current._leaflet_id) return;

    import('leaflet').then((L) => {
      if (!containerRef.current || containerRef.current._leaflet_id) return;
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl:       require('leaflet/dist/images/marker-icon.png'),
        iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
        shadowUrl:     require('leaflet/dist/images/marker-shadow.png'),
      });

      const map = L.map(containerRef.current, { center: [lat, lng], zoom, zoomControl: true });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);
      L.marker([lat, lng]).addTo(map).bindPopup(label).openPopup();
      mapInstanceRef.current = map;
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-center when lat/lng props change
  useEffect(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([lat, lng], zoom);
    }
  }, [lat, lng, zoom]);

  return (
    <div
      className="relative rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700"
      style={{ height }}
    >
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <a
        href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{ zIndex: 1000 }}
        className="absolute bottom-3 left-3 bg-white dark:bg-gray-800 text-primary-600 px-3 py-2 rounded-xl shadow-lg flex items-center gap-2 text-xs font-bold hover:bg-gray-50 transition-all"
      >
        🗺 فتح في الخريطة
      </a>
    </div>
  );
}
