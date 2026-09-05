import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import MapView from '../../components/common/MapView';
import { Package, Users, DollarSign, TrendingUp, Truck, Clock, CheckCircle, XCircle, AlertCircle, MapPin, RefreshCw } from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchAll = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [statsRes, driversRes] = await Promise.all([
        api.get('/admin/dashboard'),
        api.get('/admin/drivers'),
      ]);
      setStats(statsRes.data);
      // Only keep drivers who have REAL GPS coordinates in DB (not null)
      const allDrivers = driversRes.data;
      const withLocation = allDrivers.filter(d => d.latitude != null && d.longitude != null);
      setDrivers({ all: allDrivers, withLocation });
      setLastUpdated(new Date());
    } catch {}
    setLoading(false);
    if (isManual) setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchAll();
    // Auto-refresh every 10 seconds so live driver locations stay current
    const interval = setInterval(() => fetchAll(), 10000);
    return () => clearInterval(interval);
  }, [fetchAll]);


  if (loading) return <div className="card text-center py-12"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>;
  if (!stats) return <div className="card text-center py-12 text-gray-500">فشل تحميل البيانات</div>;

  const allDrivers     = drivers?.all          || [];
  const driversOnMap   = drivers?.withLocation  || [];
  const statCards = [
    { label: 'طلبات اليوم',      value: stats.today.total,           icon: <Package size={20} />,    color: 'bg-blue-500',    link: '/admin/orders' },
    { label: 'نشطة',           value: stats.today.active,          icon: <Clock size={20} />,      color: 'bg-yellow-500',  link: '/admin/orders' },
    { label: 'مكتملة',         value: stats.today.completed,       icon: <CheckCircle size={20} />, color: 'bg-green-500',   link: '/admin/orders' },
    { label: 'ملغية',           value: stats.today.cancelled,       icon: <XCircle size={20} />,    color: 'bg-red-500',     link: '/admin/orders?status=cancelled' },
    // Revenue = fees only (delivery + service + places - promo). NOT including purchase money.
    { label: 'إيرادات الخدمة',  value: `${parseFloat(stats.today.revenue).toFixed(2)} ج.م`,         icon: <DollarSign size={20} />,  color: 'bg-primary-500', link: '/admin/orders?status=completed&financial=service',
      sub: 'رسوم توصيل + خدمة فقط' },
    // Total collected = everything including purchase money passing through
    { label: 'إجمالي المحصيل',  value: `${parseFloat(stats.today.total_collected).toFixed(2)} ج.م`,   icon: <TrendingUp size={20} />,  color: 'bg-indigo-500',  link: '/admin/orders',
      sub: 'يشمل ثمن المشتريات' },
    { label: 'أرباح المالك',    value: `${parseFloat(stats.today.owner_earnings).toFixed(2)} ج.م`,  icon: <TrendingUp size={20} />,  color: 'bg-purple-500',  link: '/admin/orders?status=completed&financial=owner' },
    { label: 'السائقين',       value: stats.drivers.total,         icon: <Users size={20} />,      color: 'bg-indigo-500',  link: '/admin/drivers' },
    { label: 'متاحون',         value: stats.drivers.available,     icon: <Truck size={20} />,      color: 'bg-green-600',   link: '/admin/drivers' },
  ];

  const mapMarkers = driversOnMap.map((d, i) => ({
    lat: parseFloat(d.latitude),
    lng: parseFloat(d.longitude),
    label: d.name?.charAt(0) || String(i + 1)
  }));

  // Center map on first driver with real location
  const centerLat = mapMarkers.length > 0 ? mapMarkers[0].lat : 30.7865;
  const centerLng = mapMarkers.length > 0 ? mapMarkers[0].lng : 31.0004;

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">لوحة التحكم</h1>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              آخر تحديث: {lastUpdated.toLocaleTimeString('ar-EG')}
            </span>
          )}
          <button
            onClick={() => fetchAll(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all text-sm font-medium disabled:opacity-50"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            تحديث
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <Link key={i} to={card.link} className="card hover:shadow-lg transition-shadow">
            <div className={`w-10 h-10 ${card.color} rounded-xl flex items-center justify-center text-white mb-3`}>
              {card.icon}
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{card.value}</p>
            <p className="text-sm text-gray-500">{card.label}</p>
            {card.sub && <p className="text-[10px] text-gray-400 mt-0.5">{card.sub}</p>}
          </Link>
        ))}
      </div>

      {/* Live Drivers Map */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <MapPin size={20} className="text-primary-500" /> مواقع السائقين المباشرة
          </h3>
          <span className="text-xs text-gray-500">
            {driversOnMap.length} / {allDrivers.length} يشاركون موقعهم
          </span>
        </div>

        {driversOnMap.length === 0 ? (
          // No driver has shared their GPS — show clear message, no fake map
          <div className="flex flex-col items-center justify-center py-12 text-center rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40">
            <MapPin size={40} className="text-gray-300 dark:text-gray-600 mb-3" />
            <p className="font-semibold text-gray-600 dark:text-gray-300 mb-1">لا يوجد سائق يشارك موقعه حالياً</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 max-w-xs">
              يجب على السائق السماح بالوصول للموقع في المتصفح ليظهر هنا
            </p>
            {allDrivers.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4 justify-center">
                {allDrivers.slice(0, 5).map(d => (
                  <Link key={d.id} to="/admin/drivers" className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm">
                    <span className="text-base">{d.icon}</span>
                    <span className="font-medium text-gray-700 dark:text-gray-200">{d.name}</span>
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      d.availability_status === 'available' ? 'bg-green-500' :
                      d.availability_status === 'busy'      ? 'bg-red-500'   : 'bg-gray-400'
                    }`} />
                    <span className="text-xs text-gray-400">لم يسمح بالموقع</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ) : (
          // At least one driver has real GPS
          <>
            <MapView
              lat={centerLat}
              lng={centerLng}
              height="350px"
              markers={mapMarkers}
            />
            <div className="flex flex-wrap gap-2 mt-3">
              {driversOnMap.map(d => (
                <Link key={d.id} to="/admin/drivers" className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm">
                  <span className="text-lg">{d.icon}</span>
                  <span className="font-medium">{d.name}</span>
                  <span className={`w-2 h-2 rounded-full ${
                    d.availability_status === 'available' ? 'bg-green-500' :
                    d.availability_status === 'busy'      ? 'bg-red-500'   : 'bg-gray-400'
                  }`} />
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Unpaid Earnings Alert */}
      {stats.totalUnpaid > 0 && (
        <div className="card bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 flex items-center gap-4">
          <AlertCircle size={24} className="text-yellow-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-bold text-yellow-800 dark:text-yellow-200">أرباح غير مدفوعة للسائقين</p>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">إجمالي المبالغ المستحقة: {stats.totalUnpaid} ج.م</p>
          </div>
          <Link to="/admin/drivers" className="btn-primary text-sm">إدارة أرصدة السائقين</Link>
        </div>
      )}
    </div>
  );
}
