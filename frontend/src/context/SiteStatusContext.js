import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../utils/api';

const SiteStatusContext = createContext({ accepting_orders: true, offline_message: '', loading: true });

export const useSiteStatus = () => useContext(SiteStatusContext);

export function SiteStatusProvider({ children }) {
  const [status, setStatus] = useState({ accepting_orders: true, offline_message: '', loading: true });

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get('/settings');
      setStatus({
        accepting_orders: res.data.accepting_orders !== 'false',
        offline_message: res.data.offline_message || 'المنصة غير متاحة حالياً، يرجى المحاولة لاحقاً.',
        loading: false,
      });
    } catch {
      // On error assume open so we don't block everyone accidentally
      setStatus({ accepting_orders: true, offline_message: '', loading: false });
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    // Re-check every 60 seconds in case admin changes it while user is on page
    const id = setInterval(fetchStatus, 60000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  return (
    <SiteStatusContext.Provider value={status}>
      {children}
    </SiteStatusContext.Provider>
  );
}
