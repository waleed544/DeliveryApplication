import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import { useSocket } from '../../context/SocketContext';
import LiveMap from '../../components/common/LiveMap';
import {
  Package, CheckCircle, MapPin, Plus, Trash2, ChevronDown, ChevronUp,
  Phone, Navigation, MessageCircle, Store, Send, XCircle, AlertTriangle,
  Receipt, ShoppingBag, Info
} from 'lucide-react';
import toast from 'react-hot-toast';

// Build store emojis
const storeEmoji = (n) => '🏪'.repeat(Math.min(n || 1, 5));

export default function DriverOrders() {
  const socket = useSocket();
  const [availableOrders, setAvailableOrders] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedLoc, setExpandedLoc] = useState(null);
  const [activeTab, setActiveTab] = useState('available'); // 'available' | 'history'
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const printReceipt = (order) => {
    const printWindow = window.open('', '_blank', 'width=420,height=700');
    if (!printWindow) {
      toast.error('اسمح بالنوافذ المنبثقة لطباعة الإيصال');
      return;
    }

    const escapeHtml = (value) => String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    const money = value => `${parseFloat(value || 0).toFixed(2)} ج.م`;
    const date = new Date(order.completed_at || order.created_at).toLocaleString('ar-EG');
    const locations = (order.locations || [])
      .map(location => `<li>${escapeHtml(location.location_name || location.name_ar || '')}${location.custom_address ? ` — ${escapeHtml(location.custom_address)}` : ''}</li>`)
      .join('');

    printWindow.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>إيصال ${escapeHtml(order.order_number)}</title><style>
      body{font-family:Arial,sans-serif;color:#111;background:#fff;margin:0;padding:24px;line-height:1.6}main{max-width:360px;margin:auto}.header{text-align:center;border-bottom:2px solid #111;padding-bottom:14px;margin-bottom:16px}h1{font-size:22px;margin:0 0 4px}.muted{color:#555;font-size:12px}.row{display:flex;justify-content:space-between;gap:16px;border-bottom:1px solid #ddd;padding:7px 0}.total{font-size:18px;font-weight:700;border-top:2px solid #111;border-bottom:0;margin-top:8px;padding-top:12px}.discount{color:#07833b}.section{margin-top:18px;font-weight:700}ul{padding-right:20px;margin-top:5px;font-size:13px}@media print{body{padding:0}button{display:none}}
    </style></head><body><main><div class="header"><h1>إيصال الطلب</h1><div>${escapeHtml(order.order_number)}</div><div class="muted">${escapeHtml(date)}</div></div>
      <div class="row"><span>العميل</span><strong>${escapeHtml(order.customer_name)}</strong></div>
      <div class="row"><span>الهاتف</span><span>${escapeHtml(order.customer_phone)}</span></div>
      ${locations ? `<div class="section">محطات التوصيل</div><ul>${locations}</ul>` : ''}
      <div class="section">تفاصيل الحساب</div>
      <div class="row"><span>رسوم التوصيل</span><span>${money(order.delivery_fee)}</span></div>
      <div class="row"><span>رسوم الخدمة</span><span>${money(order.service_fee)}</span></div>
      ${parseFloat(order.places_fee || 0) > 0 ? `<div class="row"><span>رسوم الأماكن</span><span>${money(order.places_fee)}</span></div>` : ''}
      ${parseFloat(order.items_subtotal || 0) > 0 ? `<div class="row"><span>المشتريات</span><span>${money(order.items_subtotal)}</span></div>` : ''}
      ${parseFloat(order.promo_discount || 0) > 0 ? `<div class="row discount"><span>الخصم</span><span>- ${money(order.promo_discount)}</span></div>` : ''}
      <div class="row total"><span>الإجمالي المدفوع</span><span>${money(order.final_total)}</span></div>
      ${order.notes ? `<div class="section">ملاحظات</div><div class="muted">${escapeHtml(order.notes)}</div>` : ''}
      <p class="muted" style="text-align:center;margin-top:24px">شكراً لاستخدام خدمة التوصيل</p>
    </main><script>window.onload=function(){window.print();window.onafterprint=function(){window.close()}}</script></body></html>`);
    printWindow.document.close();
  };

  // ── Estimate builder state ────────────────────────────────────────────────
  // estimateByPlace: { [placeIndex]: [{ name, quantity, unit, price }] }
  const [estimateByPlace, setEstimateByPlace] = useState({});
  const [newItemByPlace, setNewItemByPlace] = useState({});
  const [sendingEstimate, setSendingEstimate] = useState(false);
  const [editingEstimate, setEditingEstimate] = useState(false); // allows re-editing after sent
  const [cancellingOrder, setCancellingOrder] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  // Ref so socket handlers always see the latest activeOrder without stale closures
  const activeOrderRef = useRef(null);

  // ─ Live location state (driver sees both their own + customer pin) ────────
  const [driverLocation, setDriverLocation]     = useState(null);
  const [customerLocation, setCustomerLocation] = useState(null);
  const [locationDenied, setLocationDenied]     = useState(false);
  const geoWatchRef      = useRef(null);
  const trackingOrderRef = useRef(null);
  const activeOrderIdRef = useRef(null); // always-current order id for socket handler

  const fetchData = useCallback(() => {
    api.get('/drivers/available-orders').then(r => setAvailableOrders(r.data)).catch(() => {});
    api.get('/drivers/dashboard').then(r => {
      if (r.data.activeOrder) {
        api.get(`/drivers/order/${r.data.activeOrder.id}`)
          .then(or => setActiveOrder(or.data))
          .catch(() => setActiveOrder(r.data.activeOrder));
      } else {
        setActiveOrder(null);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);


  // Keep ref in sync whenever activeOrder changes
  useEffect(() => { activeOrderRef.current = activeOrder; }, [activeOrder]);

  // Fetch history when tab switches
  useEffect(() => {
    if (activeTab === 'history') fetchHistory();
  }, [activeTab]); // eslint-disable-line
  const fetchHistory = () => {
    setHistoryLoading(true);
    api.get('/drivers/history')
      .then(r => setHistory(r.data))
      .catch((err) => {
        const msg = err.response?.data?.message || 'فشل تحميل سجل الطلبات';
        toast.error(msg);
      })
      .finally(() => setHistoryLoading(false));
  };


  // ── Sockets ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleNewOrder = (order) => {
      setAvailableOrders(prev => {
        if (prev.some(o => o.id === order.id)) return prev;
        toast.success('📦 طلب جديد متاح!', { duration: 4000 });
        return [order, ...prev];
      });
    };

    const handleOrderUpdate = ({ orderId, status }) => {
      if (status === 'cancelled') {
        setActiveOrder(prev => {
          if (prev && String(prev.id) === String(orderId)) {
            toast.error('❌ تم إلغاء الطلب من العميل');
            return null;
          }
          return prev;
        });
        setAvailableOrders(prev => prev.filter(o => String(o.id) !== String(orderId)));
      }
    };

    // Customer approved or rejected the estimate — use ref to avoid stale closure
    const handleEstimateResponse = ({ orderId, approved }) => {
      const current = activeOrderRef.current;
      if (!current || String(current.id) !== String(orderId)) return;
      if (approved) {
        toast.success('✅ وافق العميل على التكلفة — تابع الشراء!', { duration: 5000 });
        setActiveOrder(prev => prev ? { ...prev, estimate_status: 'approved' } : prev);
      } else {
        toast.error('❌ رفض العميل التكلفة — تم إلغاء الطلب', { duration: 5000 });
        setActiveOrder(null);
        fetchData();
      }
    };

    socket.on('new_order', handleNewOrder);
    socket.on('order_update', handleOrderUpdate);
    socket.on('estimate_response', handleEstimateResponse);

    // Receive customer's live location
    const handleCustomerLocation = ({ orderId, latitude, longitude }) => {
      if (activeOrderIdRef.current && String(orderId) === String(activeOrderIdRef.current)) {
        setCustomerLocation({ latitude, longitude });
      }
    };
    socket.on('customer_location', handleCustomerLocation);

    return () => {
      socket.off('new_order', handleNewOrder);
      socket.off('order_update', handleOrderUpdate);
      socket.off('estimate_response', handleEstimateResponse);
      socket.off('customer_location', handleCustomerLocation);
    };
  }, [socket, fetchData]);

  // ─ Keep activeOrderIdRef in sync ────────────────────────────────────────
  useEffect(() => {
    activeOrderIdRef.current = activeOrder?.id ? String(activeOrder.id) : null;
  }, [activeOrder?.id]);

  // ─ Start/stop location sharing when active order changes ─────────────────
  useEffect(() => {
    const activeStatuses = ['driver_accepted','going_to_location','arrived_at_location','items_collected','delivering'];
    const isActive = activeOrder && activeStatuses.includes(activeOrder.status);

    if (!isActive) {
      // Stop sharing
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

    // Join tracking room
    if (trackingOrderRef.current !== orderId) {
      socket.emit('join_order_tracking', { orderId });
      trackingOrderRef.current = orderId;
    }

    // Watch own GPS
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
            toast('📍 اسمح بالوصول للموقع حتى يرى العميل موقعك', { icon: '⚠️', duration: 5000 });
          }
        },
        { enableHighAccuracy: true, maximumAge: 4000, timeout: 10000 }
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrder?.id, activeOrder?.status, socket]);

  // ─ Cleanup on unmount ───────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (geoWatchRef.current !== null) navigator.geolocation.clearWatch(geoWatchRef.current);
      if (trackingOrderRef.current) socket.emit('leave_order_tracking', { orderId: trackingOrderRef.current });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Order actions ─────────────────────────────────────────────────────────
  const acceptOrder = async (orderId) => {
    try {
      await api.post(`/drivers/accept-order/${orderId}`);
      toast.success('تم قبول الطلب!');
      setAvailableOrders(prev => prev.filter(o => o.id !== orderId));
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل القبول');
    }
  };

  const updateStatus = async (status) => {
    // Block status advance if estimate is still pending
    if (activeOrder?.service_type === 'driver_purchase' &&
        activeOrder?.estimate_status === 'pending') {
      toast.error('انتظر موافقة العميل على التكلفة أولاً');
      return;
    }
    try {
      await api.put(`/drivers/order-status/${activeOrder.id}`, { status });
      toast.success('تم تحديث الحالة');
      setActiveOrder(prev => prev ? { ...prev, status } : prev);
      if (status === 'completed') {
        setTimeout(() => { setActiveOrder(null); fetchData(); }, 1200);
      }
    } catch {
      toast.error('فشل التحديث');
    }
  };

  const cancelOrder = async () => {
    setCancellingOrder(true);
    try {
      await api.post(`/drivers/cancel-order/${activeOrder.id}`);
      toast.success('تم إلغاء الطلب');
      setActiveOrder(null);
      setShowCancelConfirm(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل الإلغاء');
    } finally {
      setCancellingOrder(false);
    }
  };

  // ── Estimate helpers ──────────────────────────────────────────────────────
  const getNewItem = (idx) => newItemByPlace[idx] || { name: '', quantity: 1, unit: 'قطعة', price: '' };
  const setNewItem = (idx, val) => setNewItemByPlace(prev => ({ ...prev, [idx]: val }));

  const addEstimateItem = (placeIdx) => {
    const item = getNewItem(placeIdx);
    if (!item.name.trim() || !item.price) { toast.error('أدخل اسم المنتج والسعر'); return; }
    const newEntry = { ...item, price: parseFloat(item.price), total: parseFloat(item.price) * (parseInt(item.quantity) || 1) };
    setEstimateByPlace(prev => ({ ...prev, [placeIdx]: [...(prev[placeIdx] || []), newEntry] }));
    setNewItem(placeIdx, { name: '', quantity: 1, unit: 'قطعة', price: '' });
  };

  const removeEstimateItem = (placeIdx, itemIdx) => {
    setEstimateByPlace(prev => {
      const updated = [...(prev[placeIdx] || [])];
      updated.splice(itemIdx, 1);
      return { ...prev, [placeIdx]: updated };
    });
  };

  const buildEstimatePayload = () => {
    const placeDetails = activeOrder?.place_details || [];
    const items = [];
    let total = 0;
    placeDetails.forEach((place, idx) => {
      const placeItems = estimateByPlace[idx] || [];
      const subtotal = placeItems.reduce((s, i) => s + i.total, 0);
      total += subtotal;
      items.push({ place_name: place.name || `مكان ${idx + 1}`, place_description: place.description || '', items: placeItems, subtotal });
    });
    return { estimate_items: items, estimate_total: total };
  };

  const totalEstimate = () => {
    let t = 0;
    Object.values(estimateByPlace).forEach(items => items.forEach(i => (t += i.total)));
    return t;
  };

  const sendEstimate = async () => {
    const payload = buildEstimatePayload();
    const hasItems = payload.estimate_items.some(p => p.items.length > 0);
    if (!hasItems) { toast.error('أضف منتجاً واحداً على الأقل'); return; }
    setSendingEstimate(true);
    try {
      await api.post(`/drivers/send-estimate/${activeOrder.id}`, payload);
      toast.success('✅ تم إرسال الفاتورة للعميل');
      setActiveOrder(prev => prev ? { ...prev, estimate_status: 'pending', estimate_items: payload.estimate_items, estimate_total: payload.estimate_total } : prev);
      setEditingEstimate(false); // collapse back to summary view
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل إرسال الفاتورة');
    } finally {
      setSendingEstimate(false);
    }
  };

  // ── Status flow ───────────────────────────────────────────────────────────
  const statusFlow = ['driver_accepted', 'going_to_location', 'arrived_at_location', 'items_collected', 'delivering', 'completed'];
  const statusLabels = {
    driver_accepted: 'قبول الطلب', going_to_location: 'في الطريق', arrived_at_location: 'وصل للموقع',
    items_collected: 'تم جمع المنتجات', delivering: 'جاري التوصيل', completed: 'تم التسليم'
  };
  const currentStatusIndex = activeOrder ? statusFlow.indexOf(activeOrder.status) : -1;

  const estimateBadge = {
    pending:  { text: 'بانتظار موافقة العميل', cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
    approved: { text: 'وافق العميل ✅',          cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    rejected: { text: 'رفض العميل ❌',            cls: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
  };


  if (loading) return (
    <div className="card text-center py-12">
      <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
    </div>
  );

  return (
    <div className="animate-fade-in space-y-4">
      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      <div className="flex gap-2">
        {[['available','📦 الطلبات'],['history','📋 سجلي']].map(([key,label]) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === key
                ? 'bg-primary-500 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}>
            {label}
            {key === 'available' && availableOrders.length > 0 && (
              <span className="mr-1.5 bg-white/30 text-white text-xs px-1.5 py-0.5 rounded-full">{availableOrders.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Active Order ─────────────────────────────────────────────────── */}
      {activeOrder && (
        <div className="space-y-3">

          {/* Header card */}
          <div className="card border-2 border-primary-200 dark:border-primary-800">
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-sm text-gray-500">{activeOrder.order_number}</span>
              <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-full">
                {statusLabels[activeOrder.status]}
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-0.5">👤 {activeOrder.customer_name}</p>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-0.5">📍 {activeOrder.customer_address}</p>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">📞 {activeOrder.customer_phone}</p>

            {/* Live Map — driver + customer positions */}
            {['driver_accepted','going_to_location','arrived_at_location','items_collected','delivering'].includes(activeOrder.status) && (
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                    <Navigation size={13} className="text-primary-500" /> موقعك وموقع العميل
                  </span>
                  <div className="flex items-center gap-2">
                    {driverLocation && (
                      <span className="text-xs text-green-500 flex items-center gap-1">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        مباشر
                      </span>
                    )}
                    {locationDenied && <span className="text-xs text-amber-500">⚠ موقعك محجوب</span>}
                  </div>
                </div>
                <LiveMap
                  driverLocation={driverLocation}
                  customerLocation={customerLocation}
                  height="220px"
                />
              </div>
            )}

            {/* Status flow */}
            <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
              {statusFlow.map((s, idx) => (
                <button key={s}
                  onClick={() => idx === currentStatusIndex + 1 && updateStatus(s)}
                  disabled={idx > currentStatusIndex + 1}
                  className={`flex-shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all
                    ${idx < currentStatusIndex ? 'bg-primary-500 text-white'
                      : idx === currentStatusIndex + 1 ? 'bg-primary-100 text-primary-700 border border-primary-300 dark:bg-primary-900/30 dark:text-primary-300'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}
                >
                  {statusLabels[s]}
                </button>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 flex-wrap">
              <a href={`tel:${activeOrder.customer_phone}`} className="btn-secondary flex items-center gap-1 text-sm px-3 py-2">
                <Phone size={15} /> اتصال
              </a>
              <Link to={`/driver/chat/${activeOrder.id}`} className="btn-secondary flex items-center gap-1 text-sm px-3 py-2 bg-primary-50 text-primary-600 border-primary-200 dark:bg-primary-900/20">
                <MessageCircle size={15} /> محادثة
              </Link>
              <button onClick={() => setShowCancelConfirm(true)}
                className="flex items-center gap-1 text-sm px-3 py-2 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 border border-red-200 dark:border-red-800 transition-colors">
                <XCircle size={15} /> إلغاء الطلب
              </button>
            </div>

            {/* Cancel confirm */}
            {showCancelConfirm && (
              <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl space-y-2">
                <p className="text-sm font-semibold text-red-700 dark:text-red-300 flex items-center gap-2">
                  <AlertTriangle size={15} /> هل أنت متأكد من إلغاء الطلب؟
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setShowCancelConfirm(false)} className="btn-secondary text-sm flex-1">لا</button>
                  <button onClick={cancelOrder} disabled={cancellingOrder}
                    className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 disabled:opacity-50 transition-colors">
                    {cancellingOrder ? 'جاري الإلغاء...' : 'نعم، إلغاء'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Place Details (what customer wants) ────────────────────── */}
          {activeOrder.place_details && activeOrder.place_details.length > 0 && (
            <div className="card space-y-3">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Store size={16} className="text-primary-500" />
                الأماكن المطلوبة
                <span className="text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-300 px-2 py-0.5 rounded-full">
                  {storeEmoji(activeOrder.num_places)} {activeOrder.num_places} أماكن
                </span>
              </h3>
              <div className="space-y-2">
                {activeOrder.place_details.map((place, idx) => (
                  <div key={idx} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 border border-gray-200 dark:border-gray-700">
                    <p className="font-semibold text-sm text-gray-900 dark:text-white mb-1">
                      🏪 مكان {idx + 1}{place.name ? `: ${place.name}` : ''}
                    </p>
                    {place.description ? (
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                        <Info size={11} className="inline ml-1" />
                        {place.description}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400 italic">لا توجد تفاصيل إضافية</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Delivery Stops ──────────────────────────────────────────── */}
          {activeOrder.locations?.length > 0 && (
            <div className="card space-y-2">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <MapPin size={16} className="text-primary-500" /> محطات التوصيل
              </h3>
              {activeOrder.locations.map((loc, idx) => (
                <button key={loc.id} onClick={() => setExpandedLoc(expandedLoc === loc.id ? null : loc.id)}
                  className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 text-right">
                  <span className="font-medium text-sm">📍 محطة {idx + 1}: {loc.name_ar || loc.custom_address}</span>
                  {expandedLoc === loc.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              ))}
            </div>
          )}

          {/* ── Receipt Builder — available at any time for any order ─────────── */}
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Receipt size={16} className="text-primary-500" /> فاتورة المشتريات
              </h3>
              <div className="flex items-center gap-2">
                {activeOrder.estimate_status && (
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${estimateBadge[activeOrder.estimate_status]?.cls}`}>
                    {estimateBadge[activeOrder.estimate_status]?.text}
                  </span>
                )}
                {/* Allow editing/updating at any time */}
                {(activeOrder.estimate_status === 'pending' || activeOrder.estimate_status === 'approved') && !editingEstimate && (
                  <button
                    onClick={() => setEditingEstimate(true)}
                    className="text-xs px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-1"
                  >
                    <Send size={11} /> تعديل
                  </button>
                )}
              </div>
            </div>

            {/* ── Summary view: estimate already sent and not being edited ── */}
            {(activeOrder.estimate_status === 'pending' || activeOrder.estimate_status === 'approved') &&
             activeOrder.estimate_items?.length > 0 && !editingEstimate ? (
              <div className="space-y-2">
                {activeOrder.estimate_items.map((place, idx) => (
                  <div key={idx} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 border border-gray-200 dark:border-gray-700">
                    <p className="font-semibold text-sm text-primary-600 mb-2">🏪 {place.place_name}</p>
                    {place.items.map((item, i) => (
                      <div key={i} className="flex justify-between text-xs text-gray-600 dark:text-gray-300 py-0.5">
                        <span>{item.name} × {item.quantity} {item.unit}</span>
                        <span className="font-medium">{item.total} ج.م</span>
                      </div>
                    ))}
                    <div className="border-t border-gray-200 dark:border-gray-600 mt-1.5 pt-1.5 flex justify-between text-xs font-semibold">
                      <span>إجمالي المكان</span><span className="text-primary-600">{place.subtotal} ج.م</span>
                    </div>
                  </div>
                ))}

                {/* Separate cost breakdown */}
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 space-y-1.5 border border-gray-200 dark:border-gray-700">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">🛍 تكلفة المشتريات</span>
                    <span className="font-semibold">{activeOrder.estimate_total} ج.م</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">🚗 رسوم التوصيل</span>
                    <span className="font-semibold">{activeOrder.delivery_fee} ج.م</span>
                  </div>
                  {parseFloat(activeOrder.service_fee || 0) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">🔧 رسوم الخدمة</span>
                      <span className="font-semibold">{activeOrder.service_fee} ج.م</span>
                    </div>
                  )}
                  {parseFloat(activeOrder.places_fee || 0) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">🏪 رسوم الأماكن</span>
                      <span className="font-semibold">{activeOrder.places_fee} ج.م</span>
                    </div>
                  )}
                  {parseFloat(activeOrder.promo_discount || 0) > 0 && (
                    <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                      <span>🎟 خصم</span>
                      <span className="font-semibold">- {activeOrder.promo_discount} ج.م</span>
                    </div>
                  )}
                  <div className="border-t border-gray-300 dark:border-gray-600 pt-1.5 flex justify-between text-sm font-bold">
                    <span className="text-gray-900 dark:text-white">الإجمالي</span>
                    <span className="text-primary-600 text-base">
                      {(parseFloat(activeOrder.estimate_total || 0) + parseFloat(activeOrder.delivery_fee || 0) + parseFloat(activeOrder.service_fee || 0) + parseFloat(activeOrder.places_fee || 0) - parseFloat(activeOrder.promo_discount || 0)).toFixed(0)} ج.م
                    </span>
                  </div>
                </div>

                {activeOrder.estimate_status === 'pending' && (
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl text-xs text-yellow-700 dark:text-yellow-300 text-center">
                    ⏳ بانتظار موافقة العميل... سيتم إشعارك تلقائياً
                  </div>
                )}
              </div>

            ) : (
              /* ── Builder form — shown when no estimate sent yet OR editing ── */
              <div className="space-y-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <ShoppingBag size={12} /> {editingEstimate ? 'تعديل الفاتورة — ستُعاد إرسالها للعميل بعد التعديل' : 'أضف المنتجات لكل مكان وأرسل الفاتورة للعميل'}
                </p>
                {(activeOrder.place_details?.length > 0 ? activeOrder.place_details : [{ name: 'مشتريات' }]).map((place, placeIdx) => (
                  <div key={placeIdx} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                    <div className="bg-gray-50 dark:bg-gray-800/50 px-3 py-2 flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-800 dark:text-white">🏪 {place.name || `مكان ${placeIdx + 1}`}</span>
                      {(estimateByPlace[placeIdx] || []).length > 0 && (
                        <span className="text-xs bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300 px-1.5 py-0.5 rounded-full">
                          {(estimateByPlace[placeIdx] || []).reduce((s, i) => s + i.total, 0)} ج.م
                        </span>
                      )}
                    </div>
                    <div className="p-3 space-y-2">
                      {(estimateByPlace[placeIdx] || []).map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-sm bg-primary-50 dark:bg-primary-900/10 rounded-lg px-2 py-1.5">
                          <span className="text-gray-700 dark:text-gray-300">{item.name} × {item.quantity} {item.unit}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-primary-600">{item.total} ج.م</span>
                            <button onClick={() => removeEstimateItem(placeIdx, i)} className="text-red-400 hover:text-red-600">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                      <div className="grid grid-cols-12 gap-1.5">
                        <input
                          value={getNewItem(placeIdx).name}
                          onChange={e => setNewItem(placeIdx, { ...getNewItem(placeIdx), name: e.target.value })}
                          className="input-field text-xs col-span-5" placeholder="اسم المنتج"
                        />
                        <input
                          type="number" min="1"
                          value={getNewItem(placeIdx).quantity}
                          onChange={e => setNewItem(placeIdx, { ...getNewItem(placeIdx), quantity: parseInt(e.target.value) || 1 })}
                          className="input-field text-xs col-span-2" placeholder="كمية"
                        />
                        <input
                          type="number" min="0" step="0.5"
                          value={getNewItem(placeIdx).price}
                          onChange={e => setNewItem(placeIdx, { ...getNewItem(placeIdx), price: e.target.value })}
                          className="input-field text-xs col-span-3" placeholder="سعر ج.م"
                        />
                        <button onClick={() => addEstimateItem(placeIdx)}
                          className="col-span-2 bg-primary-500 text-white rounded-xl flex items-center justify-center hover:bg-primary-600 transition-colors">
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Breakdown preview + send */}
                <div className="pt-2 border-t border-gray-200 dark:border-gray-700 space-y-2">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>🛍 تكلفة المشتريات</span>
                    <span>{totalEstimate()} ج.م</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>🚗 رسوم التوصيل</span>
                    <span>{activeOrder.delivery_fee} ج.م</span>
                  </div>
                  {parseFloat(activeOrder.service_fee || 0) > 0 && (
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>🔧 رسوم الخدمة</span>
                      <span>{activeOrder.service_fee} ج.م</span>
                    </div>
                  )}
                  {parseFloat(activeOrder.places_fee || 0) > 0 && (
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>🏪 رسوم الأماكن</span>
                      <span>{activeOrder.places_fee} ج.م</span>
                    </div>
                  )}
                  {parseFloat(activeOrder.promo_discount || 0) > 0 && (
                    <div className="flex justify-between text-xs text-green-600 dark:text-green-400">
                      <span>🎟 خصم</span>
                      <span>- {activeOrder.promo_discount} ج.م</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold border-t border-gray-200 dark:border-gray-700 pt-1.5">
                    <span className="text-gray-900 dark:text-white">الإجمالي</span>
                    <span className="text-primary-600 text-base">
                      {(totalEstimate() + parseFloat(activeOrder.delivery_fee || 0) + parseFloat(activeOrder.service_fee || 0) + parseFloat(activeOrder.places_fee || 0) - parseFloat(activeOrder.promo_discount || 0)).toFixed(0)} ج.م
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {editingEstimate && (
                      <button onClick={() => setEditingEstimate(false)}
                        className="flex-1 btn-secondary text-sm">
                        إلغاء
                      </button>
                    )}
                    <button onClick={sendEstimate} disabled={sendingEstimate}
                      className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50">
                      {sendingEstimate
                        ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> جاري الإرسال...</>
                        : <><Send size={16} /> {editingEstimate ? 'إرسال التحديث' : 'إرسال الفاتورة للعميل'}</>
                      }
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Available Orders Tab ──────────────────────────────────── */}
      {activeTab === 'available' && !activeOrder && (
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">طلبات متاحة</h3>

          {availableOrders.length === 0 ? (
            <div className="card text-center py-8">
              <Package size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500">لا توجد طلبات متاحة حالياً</p>
            </div>
          ) : (
            <div className="space-y-3">
              {availableOrders.map(order => {
                const isExpanded = expandedOrderId === order.id;
                const myEarnings = parseFloat(order.driver_earnings || 0);
                return (
                  <div key={order.id} className="card border border-gray-200 dark:border-gray-700">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono text-gray-400">{order.order_number}</span>
                          <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 rounded-full">جديد</span>
                          <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 rounded-full">
                            {order.service_type === 'driver_purchase' ? '🛒 شراء' : '📦 جاهز'}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-gray-800 dark:text-white mt-1">👤 {order.customer_name}</p>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">📍 {order.customer_address?.substring(0, 60)}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-primary-600 text-lg">{parseFloat(order.final_total).toFixed(0)} ج.م</p>
                        <p className="text-xs text-green-600 font-semibold">عمولتك: {myEarnings.toFixed(0)} ج.م</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                      className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 rounded-xl mb-3 hover:bg-primary-100 transition-colors"
                    >
                      {isExpanded
                        ? <><ChevronUp size={14} /> إخفاء التفاصيل</>
                        : <><ChevronDown size={14} /> عرض كل التفاصيل قبل القبول</>}
                    </button>
                    {isExpanded && (
                      <div className="space-y-3 mb-3 animate-fade-in">
                        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 space-y-1.5">
                          <p className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-2">💰 تفصيل الأسعار</p>
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
                        {order.num_places > 0 && (
                          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3">
                            <p className="text-xs font-bold text-gray-600 dark:text-gray-300">🏪 عدد الأماكن: {storeEmoji(order.num_places)} {order.num_places}</p>
                          </div>
                        )}
                        {order.notes && (
                          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-3">
                            <p className="text-xs font-bold text-amber-700 dark:text-amber-300 mb-1">🗒 ملاحظات العميل</p>
                            <p className="text-xs text-amber-700 dark:text-amber-300">{order.notes}</p>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-xs text-gray-500 px-1">
                          <Phone size={12} /><span>{order.customer_phone}</span>
                        </div>
                      </div>
                    )}
                    <button onClick={() => acceptOrder(order.id)} className="btn-primary w-full flex items-center justify-center gap-2">
                      <CheckCircle size={16} /> قبول الطلب
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── History Tab ─────────────────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white">سجل طلباتي</h3>
          </div>
          {historyLoading ? (
            <div className="card text-center py-8">
              <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : history.length === 0 ? (
            <div className="card text-center py-10">
              <Package size={36} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
              <p className="text-gray-500 text-sm">لا يوجد سجل طلبات</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map(order => {
                const isExpanded = expandedOrderId === order.id;
                const isCompleted = order.status === 'completed';
                const fmt = d => new Date(d).toLocaleDateString('ar-EG', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
                return (
                  <div key={order.id} className="card border border-gray-200 dark:border-gray-700">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs font-mono text-gray-400">{order.order_number}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${isCompleted?'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400':'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'}`}>
                            {isCompleted ? '✅ مكتمل' : '❌ ملغي'}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-gray-800 dark:text-white">{order.customer_name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{fmt(order.created_at)}</p>
                      </div>
                      {isCompleted && (
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs text-gray-400">عمولتي</p>
                          <p className="font-bold text-green-600">{parseFloat(order.driver_earnings||0).toFixed(2)} ج.م</p>
                        </div>
                      )}
                    </div>
                    <button onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                      className="w-full flex items-center justify-center gap-1 py-1.5 mt-2 text-xs text-gray-500 bg-gray-50 dark:bg-gray-800/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                      {isExpanded ? <><ChevronUp size={13} /> إخفاء</> : <><ChevronDown size={13} /> عرض التفاصيل</>}
                    </button>
                    {isExpanded && (
                      <div className="mt-3 space-y-2 animate-fade-in">
                        {order.locations?.length > 0 && (
                          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3">
                            <p className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-2">📍 محطات التوصيل</p>
                            {order.locations.map((l,i) => (
                              <p key={i} className="text-xs text-gray-500">• {l.location_name||l.name_ar||''} {l.custom_address && `— ${l.custom_address}`}</p>
                            ))}
                          </div>
                        )}
                        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 space-y-1">
                          <p className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">💰 تفصيل الفاتورة</p>
                          <div className="flex justify-between text-xs"><span className="text-gray-500">رسوم التوصيل</span><span>{parseFloat(order.delivery_fee||0).toFixed(2)} ج.م</span></div>
                          <div className="flex justify-between text-xs"><span className="text-gray-500">رسوم الخدمة</span><span>{parseFloat(order.service_fee||0).toFixed(2)} ج.م</span></div>
                          {parseFloat(order.places_fee||0)>0&&<div className="flex justify-between text-xs"><span className="text-gray-500">رسوم الأماكن</span><span>{parseFloat(order.places_fee).toFixed(2)} ج.م</span></div>}
                          {parseFloat(order.items_subtotal||0)>0&&<div className="flex justify-between text-xs"><span className="text-gray-500">مشتريات</span><span>{parseFloat(order.items_subtotal).toFixed(2)} ج.م</span></div>}
                          {parseFloat(order.promo_discount||0)>0&&<div className="flex justify-between text-xs text-green-600"><span>خصم</span><span>- {parseFloat(order.promo_discount).toFixed(2)} ج.م</span></div>}
                          <div className="border-t border-gray-200 dark:border-gray-600 pt-1 flex justify-between text-xs font-bold">
                            <span>الإجمالي</span><span className="text-primary-600">{parseFloat(order.final_total||0).toFixed(2)} ج.م</span>
                          </div>
                          {isCompleted&&<div className="flex justify-between text-xs font-bold text-green-700 dark:text-green-400"><span>✨ عمولتي</span><span>{parseFloat(order.driver_earnings||0).toFixed(2)} ج.م</span></div>}
                        </div>
                        {order.notes&&(
                          <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-3 py-2">
                            🗒 {order.notes}
                          </p>
                        )}
                        {isCompleted && (
                          <button type="button" onClick={() => printReceipt(order)} className="btn-secondary flex w-full items-center justify-center gap-2 text-sm">
                            <Receipt size={16} /> طباعة الإيصال
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
