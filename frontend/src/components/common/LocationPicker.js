import React, { useState } from 'react';
import MapView from './MapView';
import { MapPin } from 'lucide-react';

export default function LocationPicker({ onSelect, selectedLocation }) {
  const [showMap, setShowMap] = useState(false);

  // Default coordinates for Egypt (Tanta area)
  const defaultLat = 30.7865;
  const defaultLng = 31.0004;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button 
          onClick={() => setShowMap(!showMap)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 rounded-xl text-sm font-medium hover:bg-primary-100 transition-all"
        >
          <MapPin size={16} />
          {showMap ? 'إخفاء الخريطة' : 'عرض على الخريطة'}
        </button>
      </div>

      {showMap && (
        <div className="animate-fade-in">
          <MapView 
            lat={selectedLocation?.lat || defaultLat}
            lng={selectedLocation?.lng || defaultLng}
            height="250px"
            markers={selectedLocation ? [{ lat: selectedLocation.lat, lng: selectedLocation.lng, label: 'A' }] : []}
          />
          <p className="text-xs text-gray-400 mt-2 text-center">يتم تحديد الموقع تلقائياً عند اختيار موقع من القائمة</p>
        </div>
      )}
    </div>
  );
}
