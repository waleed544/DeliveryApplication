import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import { useSocket } from '../../context/SocketContext';
import { useSiteStatus } from '../../context/SiteStatusContext';
import { useAuth } from '../../context/AuthContext';
import LiveMap from '../../components/common/LiveMap';
import {
  DollarSign, ClipboardCheck, MapPin, Power, PowerOff,
  CheckCircle, AlertCircle, Package, Navigation, AlertTriangle,
  Phone, Store, ChevronDown, ChevronUp, Wifi, WifiOff, Wallet
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function DriverDashboard() {
  const socket = useSocket();
  const { user } = useAuth();
  const [data, setData]                       = useState(null);
  const [availableOrders, setAvailableOrders] = useState([]);
  const [loading, setLoading]                 = useState(true);
  const [error, setError]                     = useState(null);
  const [accepting, setAccepting]             = useState(null);
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [balanceDepleted, setBalanceDepleted] = useState(false);
  const { accepting_orders, offline_message } = useSiteStatus();

  // ─ Order-tracking location state (only while delivering) ─────────────
  const [driverLocation, setDriverLocation]     = useState(null);
  const [customerLocation, setCustomerLocation] = useState(null);
  const [locationDenied, setLocationDenied]     = useState(false);
  const geoWatchRef      = useRef(null);
  const trackingOrderRef = useRef(null);
  const activeOrderIdRef = useRef(null);
  const prepaidBalanceRef = useRef(0);

  // ─ Always-on location sharing ──────────────────────────────────
  const alwaysShareKey = user?.id ? `driver_always_share_${user.id}` : 'driver_always_share';
  const [alwaysSharing, setAlwaysSharing] = useState(
    () => localStorage.getItem(alwaysShareKey) === 'true'
  );
  const [alwaysLocation, setAlwaysLocation] = useState(null); // current GPS when always-sharing
  const alwaysWatchRef    = useRef(null);
  const alwaysSaveTimer   = useRef(null); // interval that POSTs to DB every 30s
  const alwaysLocationRef = useRef(null); // latest coords without re-render lag

  const fetchDashboard = useCallback(() => {
    setError(null);
    api.get('/drivers/dashboard').then(r => {
      setData(r.data);
      prepaidBalanceRef.current = parseFloat(r.data?.driver?.prepaid_balance || 0);
      if (prepaidBalanceRef.current <= 0) {
        setAvailableOrders([]);
        setBalanceDepleted(true);
      }
      // Keep ref in sync so socket handlers always have the current active order ID
      activeOrderIdRef.current = r.data?.activeOrder?.id ? String(r.data.activeOrder.id) : null;
      setLoading(false);
    }).catch((err) => {
      setError(err.response?.data?.message || 'تعذّر الاتصال بالخادم');
      setLoading(false);
    });
  }, []);

  const fetchAvailable = useCallback(() => {
    api.get('/drivers/available-orders')
      .then(r => { setAvailableOrders(r.data); setBalanceDepleted(false); })
      .catch(err => {
        if (err.response?.status === 402 && err.response?.data?.balance_depleted) {
          setBalanceDepleted(true);
          setAvailableOrders([]);
        }
      });
  }, []);

  // Initial load + polling every 10 s
  useEffect(() => {
    fetchDashboard();
    fetchAvailable();
    const interval = setInterval(() => {
      fetchDashboard();
      fetchAvailable();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchDashboard, fetchAvailable]);

  // Real-time socket events
  useEffect(() => {
    const handleNewOrder = (order) => {
      // A socket event can arrive before the next polling refresh. Never show
      // new work to a driver whose prepaid balance is already depleted.
      if (prepaidBalanceRef.current <= 0) return;
      setAvailableOrders(prev => {
        if (prev.some(o => o.id === order.id)) return prev;
        toast.success('📦 طلب جديد متاح!', { duration: 4000 });
        return [order, ...prev];
      });
    };
    const handleOrderUpdate = ({ orderId, status }) => {
      if (status === 'cancelled') {
        setAvailableOrders(prev => prev.filter(o => String(o.id) !== String(orderId)));
      }
      if (status === 'completed' && String(orderId) === activeOrderIdRef.current) {
        fetchDashboard();
        fetchAvailable();
      }
    };
    // Receive customer's location — use ref so this never has a stale closure on data
    const handleCustomerLocation = ({ orderId, latitude, longitude }) => {
      if (activeOrderIdRef.current && String(orderId) === activeOrderIdRef.current) {
        setCustomerLocation({ latitude, longitude });
      }
    };
    socket.on('new_order', handleNewOrder);
    socket.on('order_update', handleOrderUpdate);
    socket.on('customer_location', handleCustomerLocation);
    return () => {
      socket.off('new_order', handleNewOrder);
      socket.off('order_update', handleOrderUpdate);
      socket.off('customer_location', handleCustomerLocation);
    };
  }, [socket, fetchDashboard, fetchAvailable]);

  const toggleAvailability = async () => {
    const newStatus = data.driver.availability_status === 'available' ? 'offline' : 'available';
    try {
      await api.put('/drivers/availability', { status: newStatus });
      toast.success(newStatus === 'available' ? 'أنت متاح الآن للطلبات' : 'أنت غير متاح');
      fetchDashboard();
    } catch {
      toast.error('فشل التحديث');
    }
  };

  // ─ Always-on location sharing: start/stop ───────────────────────────
  const startAlwaysSharing = () => {
    if (!navigator.geolocation) {
      toast.error('متصفحك لا يدعم خدمة الموقع');
      return;
    }
    let firstSave = true; // flag: save immediately on first fix
    alwaysWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setAlwaysLocation(loc);
        alwaysLocationRef.current = loc;
        // Save to DB immediately on the first GPS fix (don't wait 30s)
        if (firstSave) {
          firstSave = false;
          api.put('/drivers/location', { latitude: loc.latitude, longitude: loc.longitude })
            .catch(() => {});
        }
      },
      (err) => {
        if (err.code === 1) {
          toast.error('يجب السماح بالوصول للموقع في إعدادات المتصفح');
          stopAlwaysSharing();
        }
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );
    // Also save every 30 seconds to keep DB fresh
    alwaysSaveTimer.current = setInterval(() => {
      const loc = alwaysLocationRef.current;
      if (loc) {
        api.put('/drivers/location', { latitude: loc.latitude, longitude: loc.longitude })
          .catch(() => {}); // silent — non-critical
      }
    }, 30000);
  };

  const stopAlwaysSharing = () => {
    if (alwaysWatchRef.current !== null) {
      navigator.geolocation.clearWatch(alwaysWatchRef.current);
      alwaysWatchRef.current = null;
    }
    clearInterval(alwaysSaveTimer.current);
    alwaysSaveTimer.current = null;
    setAlwaysLocation(null);
    alwaysLocationRef.current = null;
    // Clear from DB so admin map doesn’t show stale position
    api.put('/drivers/location', { latitude: null, longitude: null }).catch(() => {});
  };

  const toggleAlwaysSharing = () => {
    const next = !alwaysSharing;
    setAlwaysSharing(next);
    localStorage.setItem(alwaysShareKey, String(next));
    if (next) {
      startAlwaysSharing();
      toast.success('📍 بدأ مشاركة موقعك باستمرار');
    } else {
      stopAlwaysSharing();
      toast('❌ توقفت مشاركة الموقع');
    }
  };

  // Auto-start if preference was saved
  useEffect(() => {
    if (alwaysSharing) startAlwaysSharing();
    return () => {
      // Cleanup always-on watch on unmount
      if (alwaysWatchRef.current !== null) navigator.geolocation.clearWatch(alwaysWatchRef.current);
      clearInterval(alwaysSaveTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─ Location sharing: start/stop when active order changes ────────────────
  useEffect(() => {
    const activeOrder = data?.activeOrder;
    const activeStatuses = ['driver_accepted','going_to_location','arrived_at_location','items_collected','delivering'];
    const isActive = activeOrder && activeStatuses.includes(activeOrder.status);

    if (!isActive) {
      if (trackingOrderRef.current) {
        socket.emit('leave_order_tracking', { orderId: trackingOrderRef.current });
        trackingOrderRef.current = null;
      }
      if (geoWatchRef.current !== null) {
        navigator.geolocation.clearWatch(geoWatchRef.current);
        geoWatchRef.current = null;
        setDriverLocation(null);
        setCustomerLocation(null);
      }
      return;
    }

    const orderId = String(activeOrder.id);

    // Join tracking room (idempotent)
    if (trackingOrderRef.current !== orderId) {
      socket.emit('join_order_tracking', { orderId });
      trackingOrderRef.current = orderId; // already String from above
    }

    // Watch GPS and emit to customer
    if (geoWatchRef.current === null && navigator.geolocation) {
      geoWatchRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          setDriverLocation(loc);
          socket.emit('location_update', { orderId, ...loc });
        },
        (err) => {
          if (err.code === 1) {
            setLocationDenied(true);
            toast('📍 اسمح بالوصول للموقع حتى يتمكن العميل من متابعتك', {
              duration: 5000, icon: '⚠️',
            });
          }
        },
        { enableHighAccuracy: true, maximumAge: 4000, timeout: 10000 }
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.activeOrder?.id, data?.activeOrder?.status, socket]);

  // ─ Cleanup on unmount ───────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (geoWatchRef.current !== null) navigator.geolocation.clearWatch(geoWatchRef.current);
      if (trackingOrderRef.current) socket.emit('leave_order_tracking', { orderId: trackingOrderRef.current });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const acceptOrder = async (orderId) => {
    setAccepting(orderId);
    try {
      await api.post(`/drivers/accept-order/${orderId}`);
      toast.success('✅ تم قبول الطلب!');
      setAvailableOrders(prev => prev.filter(o => o.id !== orderId));
      fetchDashboard();
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل القبول');
    } finally {
      setAccepting(null);
    }
  };

  const statusColors = { available: 'bg-green-500', busy: 'bg-red-500', offline: 'bg-gray-400' };
  const statusLabels = {
    requested: 'تم الطلب', finding_driver: 'جاري البحث', driver_accepted: 'قبول السائق',
    going_to_location: 'في الطريق', arrived_at_location: 'وصل', items_collected: 'تم الجمع',
    delivering: 'جاري التوصيل', completed: 'مكتمل', cancelled: 'ملغي'
  };

  if (loading) return (
    <div className="card text-center py-12">
      <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
    </div>
  );

  if (!data) return (
    <div className="card text-center py-10 space-y-3">
      <AlertCircle size={40} className="mx-auto text-red-400" />
      <p className="font-bold text-gray-900 dark:text-white">فشل تحميل البيانات</p>
      <p className="text-sm text-gray-500 max-w-xs mx-auto">
        {error || 'تعذّر الاتصال بالخادم — تأكد من تشغيل الخادم وأن حسابك مُفعَّل'}
      </p>
      <button
        onClick={() => { setLoading(true); fetchDashboard(); fetchAvailable(); }}
        className="btn-primary mt-2"
      >
        إعادة المحاولة
      </button>
    </div>
  );

  return (
    <div className="animate-fade-in space-y-4">

      {/* Platform offline warning */}
      {!accepting_orders && (
        <div className="card border-2 border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 flex items-start gap-3">
          <AlertTriangle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-amber-700 dark:text-amber-300">المنصة مغلقة حالياً</p>
            <p className="text-sm text-amber-600 dark:text-amber-400">{offline_message} — لن تصلك طلبات جديدة حتى يفتحها المشرف</p>
          </div>
        </div>
      )}

      {/* Status Toggle */}
      <div className="card flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${statusColors[data.driver.availability_status]} ${data.driver.availability_status === 'available' ? 'pulse-ring' : ''}`} />
          <div>
            <p className="font-bold text-gray-900 dark:text-white">
              {data.driver.availability_status === 'available' ? 'متاح ✅' : data.driver.availability_status === 'busy' ? 'مشغول 🔴' : 'غير متاح ⚫'}
            </p>
            <p className="text-xs text-gray-500">
              {data.driver.availability_status === 'available' ? 'ستستقبل طلبات جديدة' : 'لن تستقبل طلبات'}
            </p>
          </div>
        </div>
        <button
          onClick={toggleAvailability}
          className={`p-3 rounded-xl transition-all ${data.driver.availability_status === 'available' ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-green-100 text-green-600 hover:bg-green-200'}`}
        >
          {data.driver.availability_status === 'available' ? <PowerOff size={20} /> : <Power size={20} />}
        </button>
      </div>

      {/* Always-on Location Sharing Toggle */}
      <div className={`card flex items-center justify-between border-2 transition-colors ${
        alwaysSharing
          ? 'border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-900/20'
          : 'border-gray-200 dark:border-gray-700'
      }`}>
        <div className="flex items-center gap-3">
          {alwaysSharing ? (
            <div className="relative">
              <MapPin size={22} className="text-green-500" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
            </div>
          ) : (
            <MapPin size={22} className="text-gray-400" />
          )}
          <div>
            <p className="font-bold text-gray-900 dark:text-white text-sm">
              {alwaysSharing ? '📍 موقعك مشارك دائماً' : 'مشاركة الموقع المستمرة'}
            </p>
            <p className="text-xs text-gray-500">
              {alwaysSharing
                ? alwaysLocation
                  ? `دقة: ${alwaysLocation.latitude.toFixed(5)}, ${alwaysLocation.longitude.toFixed(5)}`
                  : 'جاري جلب الإشارة…'
                : 'يظهر موقعك للمشرف دائماً حتى خارج التوصيل'
              }
            </p>
          </div>
        </div>
        <button
          onClick={toggleAlwaysSharing}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            alwaysSharing
              ? 'bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400'
              : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400'
          }`}
        >
          {alwaysSharing ? <WifiOff size={16} /> : <Wifi size={16} />}
          {alwaysSharing ? 'إيقاف' : 'تفعيل'}
        </button>
      </div>

      {/* Prepaid Balance Card */}
      {(() => {
        const balance  = data.driver.prepaid_balance != null ? data.driver.prepaid_balance : 0;
        const renewal  = data.driver.balance_renewal_amount || 1000;
        const negative = balance < 0;
        const depleted = balance <= 0 || balanceDepleted;
        const pct      = !depleted && renewal > 0 ? (balance / renewal) * 100 : 0;
        const low      = !depleted && pct < 20;
        const cardCls  = depleted
          ? 'border-2 border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-900/20'
          : low
          ? 'border-2 border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20'
          : 'border border-gray-200 dark:border-gray-700';
        return (
          <div className={`card ${cardCls}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Wallet size={18} className={depleted ? 'text-red-500' : low ? 'text-amber-500' : 'text-primary-500'} />
                <span className="font-bold text-gray-900 dark:text-white text-sm">رصيدي المدفوع مسبقاً</span>
                {negative && (
                  <span className="text-xs bg-red-200 dark:bg-red-900 text-red-700 dark:text-red-300 px-2 py-0.5 rounded-full font-bold">مديونية</span>
                )}
              </div>
              <span className={`text-2xl font-extrabold ${
                depleted ? 'text-red-600 dark:text-red-400' :
                low      ? 'text-amber-600 dark:text-amber-400' :
                           'text-gray-900 dark:text-white'
              }`}>{balance.toFixed(2)} ج.م</span>
            </div>

            {/* Progress bar — 0% when negative */}
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  depleted ? 'bg-red-500' : low ? 'bg-amber-400' : 'bg-green-500'
                }`}
                style={{ width: `${Math.max(Math.min(pct, 100), 0)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>مبلغ التجديد: {renewal.toFixed(2)} ج.م</span>
              {/* <span>مُخصوم اليوم: {parseFloat(data.today.earnings || 0).toFixed(2)} ج.م</span> */}
            </div>

            {depleted && (
              <div className="mt-3 flex items-center gap-2 text-red-600 dark:text-red-400 text-sm font-semibold">
                <AlertTriangle size={16} />
                {negative
                  ? `رصيدك سالب (${balance.toFixed(2)} ج.م) — لا يمكنك قبول طلبات حتى تسدد للمشرف.`
                  : 'رصيدك نفد — لا يمكنك قبول طلبات. تواصل مع المشرف لتجديد الرصيد.'
                }
              </div>
            )}
            {low && !depleted && (
              <div className="mt-2 flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs">
                <AlertCircle size={14} />
                رصيدك منخفض — تواصل مع المشرف قريباً.
              </div>
            )}
          </div>
        );
      })()}

      {/* Earnings Card */}
      <div className="card bg-gradient-to-br from-primary-500 to-green-500 text-white border-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-white/80 text-sm">إجمالي ربحك اليوم</span>
          <DollarSign size={20} className="text-white/60" />
        </div>
        <p className="text-3xl font-bold">{parseFloat(data.today.earnings || 0).toFixed(2)} ج.م</p>
        <div className="flex items-center gap-4 mt-3 text-sm text-white/80">
          <span className="flex items-center gap-1"><ClipboardCheck size={14} /> {data.today.count || 0} طلب</span>
          <span className="flex items-center gap-1"><DollarSign size={14} />إجمالي ربحك : {parseFloat(data.driver.total_earnings || 0).toFixed(2)} ج.م</span>
        </div>
      </div>

      {/* Active Order + Live Map */}
      {data.activeOrder ? (
        <div className="card border-2 border-primary-200 dark:border-primary-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Navigation size={18} className="text-primary-500" /> طلب نشط
            </h3>
            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
              {statusLabels[data.activeOrder.status]}
            </span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300">العميل: {data.activeOrder.customer_name}</p>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            العنوان: {data.activeOrder.customer_address?.substring(0, 50)}...
          </p>

          {/* Live tracking map */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <Navigation size={13} className="text-primary-500" /> موقعك وموقع العميل
              </span>
              {driverLocation && (
                <span className="text-xs text-green-500 flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  مشاركة موقعك
                </span>
              )}
              {locationDenied && <span className="text-xs text-amber-500">⚠ موقعك محجوب</span>}
            </div>
            <LiveMap
              driverLocation={driverLocation}
              customerLocation={customerLocation}
              height="220px"
            />
          </div>

          <div className="flex gap-2">
            <Link to="/driver/orders" className="btn-primary flex-1 text-center text-sm">إدارة الطلب</Link>
            <a href={`tel:${data.activeOrder.customer_phone}`} className="btn-secondary flex items-center justify-center px-4">
              <Phone size={16} />
            </a>
          </div>
        </div>

      ) : (
        /* ── Available Orders list — shown directly on home page ─────── */
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Package size={18} className="text-primary-500" />
              الطلبات المتاحة
              {availableOrders.length > 0 && (
                <span className="text-xs bg-primary-500 text-white px-2 py-0.5 rounded-full">
                  {availableOrders.length}
                </span>
              )}
            </h3>
            <button
              onClick={() => { fetchDashboard(); fetchAvailable(); }}
              className="text-xs text-primary-500 hover:text-primary-700 transition-colors"
            >
              🔄 تحديث
            </button>
          </div>

          {availableOrders.length === 0 ? (
            <div className="card text-center py-10">
              <Package size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="font-bold text-gray-900 dark:text-white">لا توجد طلبات متاحة</p>
              <p className="text-sm text-gray-500 mt-1">سيتم إشعارك فور وصول طلب جديد</p>
            </div>
          ) : (
            availableOrders.map(order => {
              const isExpanded = expandedOrderId === order.id;
              const myEarnings = parseFloat(order.driver_earnings || 0);
              return (
                <div key={order.id} className="card border border-yellow-200 dark:border-yellow-800 animate-fade-in">

                  {/* Header */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-gray-400">{order.order_number}</span>
                        <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 rounded-full font-medium">🆕 جديد</span>
                        <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 rounded-full">
                          {order.service_type === 'driver_purchase' ? '🛒 شراء' : '📦 جاهز'}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-gray-800 dark:text-white mt-1">👤 {order.customer_name}</p>
                      <p className="text-xs text-gray-500 mt-0.5 truncate flex items-center gap-1">
                        <MapPin size={11} className="flex-shrink-0 text-primary-400" />
                        {order.customer_address?.substring(0, 60)}{order.customer_address?.length > 60 ? '...' : ''}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-primary-600 text-lg">{parseFloat(order.final_total).toFixed(0)} ج.م</p>
                      <p className="text-xs text-green-600 font-semibold">عمولتك: {myEarnings.toFixed(0)} ج.م</p>
                    </div>
                  </div>

                  {/* Expand / collapse toggle */}
                  <button
                    onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                    className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 rounded-xl mb-3 hover:bg-primary-100 transition-colors"
                  >
                    {isExpanded
                      ? <><ChevronUp size={13} /> إخفاء التفاصيل</>
                      : <><ChevronDown size={13} /> عرض التفاصيل قبل القبول</>}
                  </button>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="space-y-2 mb-3 animate-fade-in">

                      {/* Fee breakdown */}
                      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 space-y-1.5">
                        <p className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">💰 تفصيل الأسعار</p>
                        <div className="flex justify-between text-xs"><span className="text-gray-500">🚗 رسوم التوصيل</span><span>{parseFloat(order.delivery_fee||0).toFixed(2)} ج.م</span></div>
                        <div className="flex justify-between text-xs"><span className="text-gray-500">🔧 رسوم الخدمة</span><span>{parseFloat(order.service_fee||0).toFixed(2)} ج.م</span></div>
                        {parseFloat(order.places_fee||0) > 0 && <div className="flex justify-between text-xs"><span className="text-gray-500">🏪 رسوم الأماكن</span><span>{parseFloat(order.places_fee).toFixed(2)} ج.م</span></div>}
                        {parseFloat(order.items_subtotal||0) > 0 && <div className="flex justify-between text-xs"><span className="text-gray-500">🛍 ثمن المشتريات</span><span>{parseFloat(order.items_subtotal).toFixed(2)} ج.م</span></div>}
                        {parseFloat(order.promo_discount||0) > 0 && <div className="flex justify-between text-xs text-green-600"><span>🎟 خصم</span><span>- {parseFloat(order.promo_discount).toFixed(2)} ج.م</span></div>}
                        <div className="border-t border-gray-200 dark:border-gray-600 pt-1.5 flex justify-between text-xs font-bold">
                          <span>الإجمالي</span><span className="text-primary-600">{parseFloat(order.final_total).toFixed(2)} ج.م</span>
                        </div>
                        <div className="flex justify-between text-xs font-bold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg px-2 py-1 mt-1">
                          <span>✨ عمولتك</span><span>{myEarnings.toFixed(2)} ج.م</span>
                        </div>
                      </div>

                      {/* Places count */}
                      {order.num_places > 1 && (
                        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3">
                          <p className="text-xs font-bold text-gray-600 dark:text-gray-300 flex items-center gap-1">
                            <Store size={12} /> عدد الأماكن: {'🏪'.repeat(Math.min(order.num_places, 5))} {order.num_places}
                          </p>
                        </div>
                      )}

                      {/* Notes */}
                      {order.notes && (
                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-3">
                          <p className="text-xs font-bold text-amber-700 dark:text-amber-300 mb-1">🗒 ملاحظات العميل</p>
                          <p className="text-xs text-amber-700 dark:text-amber-300">{order.notes}</p>
                        </div>
                      )}

                      {/* Phone */}
                      <div className="flex items-center gap-2 text-xs text-gray-500 px-1">
                        <Phone size={12} /><span>{order.customer_phone}</span>
                      </div>
                    </div>
                  )}

                  {/* Accept button */}
                  <button
                    onClick={() => acceptOrder(order.id)}
                    disabled={accepting === order.id}
                    className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {accepting === order.id
                      ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <CheckCircle size={16} />
                    }
                    قبول الطلب
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Shift Info */}
      {data.shifts.length > 0 && (
        <div className="card">
          <h3 className="font-bold text-gray-900 dark:text-white mb-3">🕐 مواعيد العمل</h3>
          <div className="space-y-2">
            {data.shifts.map(shift => {
              const days = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
              return (
                <div key={shift.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-300">{days[shift.day_of_week]}</span>
                  <span className="font-mono text-primary-600">{shift.start_time?.substring(0,5)} - {shift.end_time?.substring(0,5)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
