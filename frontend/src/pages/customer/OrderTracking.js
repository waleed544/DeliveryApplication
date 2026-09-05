import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../utils/api';
import { useSocket } from '../../context/SocketContext';
import LiveMap from '../../components/common/LiveMap';
import { MapPin, Phone, MessageCircle, Star, Truck, Clock, CheckCircle, Package, User, AlertCircle, Navigation, Receipt, ShoppingBag, ThumbsUp, ThumbsDown, Printer } from 'lucide-react';
import toast from 'react-hot-toast';

export default function OrderTracking() {
  const { id } = useParams();
  const socket = useSocket();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [complaint, setComplaint] = useState('');
  const [showRating, setShowRating] = useState(false);
  const [driverLocation, setDriverLocation]     = useState(null);  // from socket
  const [customerLocation, setCustomerLocation] = useState(null);  // own GPS
  const [locationDenied, setLocationDenied]     = useState(false);
  const [respondingEstimate, setRespondingEstimate] = useState(false);
  const [driverJustAccepted, setDriverJustAccepted] = useState(false);
  const geoWatchRef = useRef(null);
  const trackingOrderRef = useRef(null); // orderId currently joined for tracking

  useEffect(() => { fetchOrder(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fallback polling when socket disconnects ───────────────────────────────
  useEffect(() => {
    let interval = null;
    const startPoll = () => { interval = setInterval(fetchOrder, 30000); };
    const stopPoll  = () => { clearInterval(interval); };
    socket.on('disconnect', startPoll);
    socket.on('connect',    stopPoll);
    if (!socket.connected) startPoll(); // already disconnected on mount
    return () => { stopPoll(); socket.off('disconnect', startPoll); socket.off('connect', stopPoll); };
  }, [socket]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Socket: real-time order status updates ────────────────────────────────
  useEffect(() => {
    const handleOrderUpdate = ({ orderId, status }) => {
      if (String(orderId) !== String(id)) return;
      setOrder((prev) => {
        if (!prev) return prev;
        const updated = { ...prev, status };
        const labels = {
          driver_accepted: '✅ تم قبول الطلب من السائق',
          going_to_location: '🚗 السائق في الطريق إليك',
          arrived_at_location: '📍 وصل السائق للموقع',
          items_collected: '📦 تم جمع المنتجات',
          delivering: '🚚 جاري التوصيل',
          completed: '🎉 تم تسليم طلبك!'
        };
        if (labels[status]) toast.success(labels[status]);
        return updated;
      });
      // When driver accepts, re-fetch the full order after a short delay
      // so driver name/phone/vehicle appear instantly on the same page
      if (status === 'driver_accepted') {
        setDriverJustAccepted(true);
        setTimeout(() => {
          fetchOrder();
          // Clear the flash banner after 5 seconds
          setTimeout(() => setDriverJustAccepted(false), 5000);
        }, 800);
      }
    };

    const handleDriverLocation = ({ orderId, latitude, longitude }) => {
      if (String(orderId) !== String(id)) return;
      setDriverLocation({ latitude, longitude });
    };


    // Driver sent a cost estimate — refresh order and show notification
    const handleEstimateReceived = ({ orderId }) => {
      if (String(orderId) !== String(id)) return;
      toast('🧾 السائق أرسل فاتورة التكلفة — راجعها وأكّد!', {
        duration: 6000, icon: '🧾',
        style: { background: '#1e40af', color: '#fff' }
      });
      fetchOrder();
    };

    socket.on('order_update', handleOrderUpdate);
    socket.on('driver_location', handleDriverLocation);
    socket.on('estimate_received', handleEstimateReceived);
    return () => {
      socket.off('order_update', handleOrderUpdate);
      socket.off('driver_location', handleDriverLocation);
      socket.off('estimate_received', handleEstimateReceived);
    };
  }, [socket, id]);

  // ── Location sharing: join tracking room + watch own GPS ──────────────────
  useEffect(() => {
    if (!order) return;
    const activeStatuses = ['driver_accepted','going_to_location','arrived_at_location','items_collected','delivering'];
    const isActive = activeStatuses.includes(order.status) && order.driver_id;

    if (!isActive) {
      // Stop sharing if order ended
      if (trackingOrderRef.current) {
        socket.emit('leave_order_tracking', { orderId: trackingOrderRef.current });
        trackingOrderRef.current = null;
      }
      if (geoWatchRef.current !== null) {
        navigator.geolocation.clearWatch(geoWatchRef.current);
        geoWatchRef.current = null;
      }
      return;
    }

    // Join the tracking room (idempotent — server checks auth)
    if (trackingOrderRef.current !== String(id)) {
      socket.emit('join_order_tracking', { orderId: id });
      trackingOrderRef.current = String(id);
    }

    // Start sharing own position if not already watching
    if (geoWatchRef.current === null && navigator.geolocation) {
      geoWatchRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          setCustomerLocation(loc);
          socket.emit('location_update', { orderId: id, ...loc });
        },
        (err) => {
          if (err.code === 1) {
            setLocationDenied(true);
            toast('📍 اسمح بالوصول للموقع لمشاركة موقعك مع السائق', {
              duration: 5000, icon: '⚠️'
            });
          }
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
      );
    }

    return () => {
      // Don't cleanup here — only cleanup when order becomes inactive (handled above)
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.status, order?.driver_id, id, socket]);

  // ── Final cleanup on unmount ──────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (geoWatchRef.current !== null) {
        navigator.geolocation.clearWatch(geoWatchRef.current);
      }
      if (trackingOrderRef.current) {
        socket.emit('leave_order_tracking', { orderId: trackingOrderRef.current });
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchOrder = () => {
    api.get(`/customers/orders/${id}`).then(r => {
      setOrder(r.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  const handleRate = async () => {
    if (rating === 0) { toast.error('اختر عدد النجوم أولاً'); return; }
    try {
      await api.post(`/orders/rate/${id}`, { rating, review, complaint });
      toast.success('تم إرسال التقييم بنجاح');
      setShowRating(false);
      fetchOrder();
    } catch {
      toast.error('فشل إرسال التقييم');
    }
  };

  const respondToEstimate = async (approved) => {
    setRespondingEstimate(true);
    try {
      await api.put(`/orders/estimate-response/${id}`, { approved });
      if (approved) {
        toast.success('✅ تمت الموافقة — السائق سيتابع الشراء');
      } else {
        toast.success('تم رفض الفاتورة وإلغاء الطلب');
      }
      fetchOrder();
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل الإجراء');
    } finally {
      setRespondingEstimate(false);
    }
  };

  const printReceipt = () => {
    const o = order;
    const itemsTotal  = parseFloat(o.estimate_total || 0);
    const deliveryFee = parseFloat(o.delivery_fee   || 0);
    const serviceFee  = parseFloat(o.service_fee    || 0);
    const placesFee   = parseFloat(o.places_fee     || 0);
    const grandTotal  = parseFloat(o.final_total    || 0);
    const promoDisc   = parseFloat(o.promo_discount || 0);
    const date = new Date(o.completed_at || o.created_at).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' });

    const placeRows = (o.estimate_items || []).flatMap(place =>
      (place.items || []).map(item =>
        `<tr>
          <td style="padding:4px 8px;border-bottom:1px solid #eee">${item.name}</td>
          <td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:center">${item.quantity} ${item.unit || ''}</td>
          <td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:left">${item.total} ج.م</td>
        </tr>`
      )
    ).join('');

    const html = `
      <!DOCTYPE html><html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>فاتورة طلب - بكليك</title>
        <style>
          * { margin:0; padding:0; box-sizing:border-box; }
          body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; font-size:13px; color:#111; background:#fff; padding:16px; max-width:320px; margin:auto; }
          .header { text-align:center; padding-bottom:12px; border-bottom:2px dashed #333; margin-bottom:12px; }
          .logo { font-size:28px; font-weight:900; letter-spacing:-1px; color:#4f46e5; }
          .logo span { color:#f59e0b; }
          .tagline { font-size:10px; color:#666; margin-top:2px; }
          .order-num { font-size:11px; color:#555; margin-top:6px; font-family:monospace; }
          .section-title { font-weight:700; font-size:12px; color:#444; margin:10px 0 4px; border-bottom:1px solid #eee; padding-bottom:3px; }
          table { width:100%; border-collapse:collapse; }
          th { padding:4px 8px; font-size:11px; color:#666; text-align:right; }
          th:last-child { text-align:left; }
          td { font-size:12px; }
          .totals { margin-top:10px; border-top:2px solid #333; padding-top:8px; }
          .totals-row { display:flex; justify-content:space-between; padding:2px 0; font-size:13px; }
          .grand { font-weight:900; font-size:16px; color:#4f46e5; margin-top:6px; border-top:1px dashed #333; padding-top:6px; }
          .footer { text-align:center; margin-top:14px; padding-top:10px; border-top:2px dashed #333; font-size:10px; color:#888; }
          .footer strong { color:#4f46e5; }
          @media print { body { padding:0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">بك<span>ليك</span></div>
          <div class="tagline">خدمة التوصيل والمشتريات</div>
          <div class="order-num">${o.order_number}</div>
          <div style="font-size:10px;color:#888;margin-top:3px">${date}</div>
        </div>

        <div class="section-title">معلومات الطلب</div>
        <div style="font-size:12px;line-height:1.7">
          <div>العميل: <strong>${o.customer_name || ''}</strong></div>
          <div>السائق: <strong>${o.driver_name || ''}</strong></div>
          <div>العنوان: ${o.customer_address || ''}</div>
        </div>

        ${placeRows ? `
        <div class="section-title">المشتريات</div>
        <table>
          <thead><tr><th>الصنف</th><th style="text-align:center">كمية</th><th style="text-align:left">سعر</th></tr></thead>
          <tbody>${placeRows}</tbody>
        </table>` : ''}

        <div class="totals">
          ${itemsTotal > 0 ? `<div class="totals-row"><span>تكلفة المشتريات</span><span>${itemsTotal.toFixed(2)} ج.م</span></div>` : ''}
          <div class="totals-row"><span>🚗 رسوم التوصيل</span><span>${deliveryFee.toFixed(2)} ج.م</span></div>
          ${serviceFee > 0 ? `<div class="totals-row"><span>🔧 رسوم الخدمة</span><span>${serviceFee.toFixed(2)} ج.م</span></div>` : ''}
          ${placesFee > 0 ? `<div class="totals-row"><span>🏪 رسوم الأماكن</span><span>${placesFee.toFixed(2)} ج.م</span></div>` : ''}
          ${promoDisc > 0 ? `<div class="totals-row" style="color:green"><span>🎟 خصم</span><span>- ${promoDisc.toFixed(2)} ج.م</span></div>` : ''}
          <div class="totals-row grand"><span>الإجمالي</span><span>${grandTotal.toFixed(2)} ج.م</span></div>
        </div>

        <div class="footer">
          شكراً لاختيارك <strong>بكليك</strong><br/>
          نتمنى لك تجربة رائعة دائماً ♥
        </div>
      </body></html>`;

    const win = window.open('', '_blank', 'width=400,height=600');
    if (!win) {
      toast.error('يرجى السماح بالنوافذ المنبثقة في المتصفح');
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
  };

  const statusSteps = [
    { key: 'requested', label: 'تم الطلب', icon: <Package size={16} /> },
    { key: 'finding_driver', label: 'البحث عن سائق', icon: <Truck size={16} /> },
    { key: 'driver_accepted', label: 'قبول السائق', icon: <CheckCircle size={16} /> },
    { key: 'going_to_location', label: 'في الطريق', icon: <MapPin size={16} /> },
    { key: 'arrived_at_location', label: 'وصل للموقع', icon: <MapPin size={16} /> },
    { key: 'items_collected', label: 'تم الجمع', icon: <Package size={16} /> },
    { key: 'delivering', label: 'جاري التوصيل', icon: <Truck size={16} /> },
    { key: 'completed', label: 'تم التسليم', icon: <CheckCircle size={16} /> },
  ];

  const getStepIndex = (status) => statusSteps.findIndex(s => s.key === status);

  if (loading) return <div className="card text-center py-12"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>;
  if (!order) return <div className="card text-center py-12 text-gray-500">الطلب غير موجود</div>;

  const currentStep = getStepIndex(order.status);

  return (
    <div className="animate-fade-in space-y-4">

      {/* ── Driver accepted flash banner ── */}
      {driverJustAccepted && (
        <div className="card border-2 border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-900/20 flex items-center gap-3 animate-fade-in">
          <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
            <Truck size={20} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-green-800 dark:text-green-200">✅ السائق قبل طلبك!</p>
            <p className="text-sm text-green-700 dark:text-green-300">ستجد تفاصيل السائق أدناه — يمكنك التواصل معه مباشرة</p>
          </div>
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse flex-shrink-0" />
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-mono text-gray-500">{order.order_number}</span>
          <span className={`text-xs px-3 py-1 rounded-full ${order.status === 'completed' ? 'bg-green-100 text-green-700' : order.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
            {statusSteps.find(s => s.key === order.status)?.label || order.status}
          </span>
        </div>
        <div className="flex items-end justify-between">
          <div className="text-2xl font-bold text-primary-600">{order.final_total} ج.م</div>
          {order.status === 'completed' && (
            <button
              onClick={printReceipt}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
            >
              <Printer size={15} /> طباعة الفاتورة
            </button>
          )}
        </div>
      </div>

      {/* Live Map — shown while order is active and driver assigned */}
      {order.status !== 'completed' && order.status !== 'cancelled' && order.driver_id && (
        <div className="card p-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Navigation size={17} className="text-primary-500" /> الخريطة المباشرة
            </h3>
            <div className="flex items-center gap-2">
              {driverLocation && (
                <span className="text-xs text-green-500 flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse inline-block" />
                  موقع السائق مباشر
                </span>
              )}
              {locationDenied && (
                <span className="text-xs text-amber-500">⚠ موقعك محجوب</span>
              )}
            </div>
          </div>
          <LiveMap
            driverLocation={driverLocation}
            customerLocation={customerLocation}
            height="260px"
          />
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-2">
            🚗 موقع السائق &nbsp;·&nbsp; 📍 موقعك &nbsp;·&nbsp; OpenStreetMap
          </p>
        </div>
      )}

      {/* Progress */}
      <div className="card">
        <h3 className="font-bold text-gray-900 dark:text-white mb-4">حالة الطلب</h3>
        <div className="space-y-3">
          {statusSteps.map((step, idx) => {
            const isActive = idx <= currentStep;
            const isCurrent = idx === currentStep;
            return (
              <div key={step.key} className={`flex items-center gap-3 ${isActive ? 'opacity-100' : 'opacity-40'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isActive ? 'bg-primary-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}`}>
                  {step.icon}
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${isCurrent ? 'text-primary-600' : 'text-gray-700 dark:text-gray-300'}`}>{step.label}</p>
                </div>
                {isCurrent && <div className="w-2 h-2 bg-primary-500 rounded-full pulse-ring" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Driver Info — appears instantly when driver accepts via socket */}
      {order.driver_name && (
        <div className={`card border-2 ${driverJustAccepted ? 'border-green-400 dark:border-green-600' : 'border-gray-200 dark:border-gray-700'} animate-fade-in`}>
          <h3 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Truck size={18} className="text-primary-500" />
            معلومات السائق
            {driverJustAccepted && (
              <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 mr-auto">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse inline-block" />
                قبل طلبك الآن
              </span>
            )}
          </h3>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-14 h-14 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center flex-shrink-0">
              <User size={28} className="text-primary-600" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-gray-900 dark:text-white text-base">{order.driver_name}</p>
              <p className="text-sm text-gray-500">{order.vehicle_name_ar} {order.icon}</p>
              {order.driver_phone && (
                <p className="text-xs text-gray-400 mt-0.5">📞 {order.driver_phone}</p>
              )}
            </div>
          </div>
          {/* Action buttons — full width and labeled */}
          <div className="grid grid-cols-2 gap-2">
            <a
              href={`tel:${order.driver_phone}`}
              className="flex items-center justify-center gap-2 py-2.5 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl transition-colors text-sm"
            >
              <Phone size={16} /> اتصال بالسائق
            </a>
            <Link
              to={`/customer/chat/${order.id}`}
              className="flex items-center justify-center gap-2 py-2.5 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-xl transition-colors text-sm"
            >
              <MessageCircle size={16} /> محادثة
            </Link>
          </div>
        </div>
      )}

      {/* ── Driver Cost Estimate Card ────────────────────────────── */}
      {order.estimate_status === 'pending' && order.estimate_items?.length > 0 && (
        <div className="card border-2 border-amber-300 dark:border-amber-700 space-y-3 animate-fade-in">
          <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Receipt size={18} className="text-amber-500" />
            فاتورة التكلفة من السائق
            <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full mr-auto">
              ⏳ تحتاج موافقتك
            </span>
          </h3>

          {/* Items breakdown */}
          <div className="space-y-2">
            {order.estimate_items.map((place, idx) => (
              <div key={idx} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 border border-gray-200 dark:border-gray-700">
                <p className="font-semibold text-sm text-primary-600 dark:text-primary-400 mb-2">🏪 {place.place_name}</p>
                {place.items?.map((item, i) => (
                  <div key={i} className="flex justify-between text-xs text-gray-600 dark:text-gray-300 py-0.5">
                    <span><ShoppingBag size={11} className="inline ml-1" />{item.name} × {item.quantity} {item.unit}</span>
                    <span className="font-medium">{item.total} ج.م</span>
                  </div>
                ))}
                <div className="border-t border-gray-200 dark:border-gray-600 mt-2 pt-1.5 flex justify-between text-xs font-bold">
                  <span>إجمالي المكان</span>
                  <span className="text-primary-600">{place.subtotal} ج.م</span>
                </div>
              </div>
            ))}
          </div>

          {/* Cost breakdown — items and delivery shown separately */}
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 space-y-1.5 border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">🛍 تكلفة المشتريات</span>
              <span className="font-semibold">{order.estimate_total} ج.م</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">🚗 رسوم التوصيل</span>
              <span className="font-semibold">{order.delivery_fee} ج.م</span>
            </div>
            {parseFloat(order.service_fee || 0) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">🔧 رسوم الخدمة</span>
                <span className="font-semibold">{order.service_fee} ج.م</span>
              </div>
            )}
            {parseFloat(order.places_fee || 0) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">🏪 رسوم الأماكن</span>
                <span className="font-semibold">{order.places_fee} ج.م</span>
              </div>
            )}
            {parseFloat(order.promo_discount || 0) > 0 && (
              <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                <span>🎟 خصم</span>
                <span className="font-semibold">- {order.promo_discount} ج.م</span>
              </div>
            )}
            <div className="border-t border-gray-300 dark:border-gray-600 pt-1.5 flex justify-between font-bold">
              <span className="text-gray-900 dark:text-white">الإجمالي</span>
              <span className="text-primary-600 text-lg">
                {(parseFloat(order.estimate_total || 0) + parseFloat(order.delivery_fee || 0) + parseFloat(order.service_fee || 0) + parseFloat(order.places_fee || 0) - parseFloat(order.promo_discount || 0)).toFixed(0)} ج.م
              </span>
            </div>
          </div>

          {/* Approve / Reject */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={() => respondToEstimate(false)}
              disabled={respondingEstimate}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
            >
              <ThumbsDown size={17} /> رفض
            </button>
            <button
              onClick={() => respondToEstimate(true)}
              disabled={respondingEstimate}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-green-500 hover:bg-green-600 text-white font-semibold transition-colors disabled:opacity-50"
            >
              {respondingEstimate
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <><ThumbsUp size={17} /> موافقة</>}
            </button>
          </div>
        </div>
      )}

      {/* Estimate approved banner */}
      {order.estimate_status === 'approved' && (
        <div className="card bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 space-y-2">
          <div className="flex items-center gap-3">
            <CheckCircle size={20} className="text-green-500 flex-shrink-0" />
            <p className="font-semibold text-green-800 dark:text-green-300 text-sm">وافقت على تكلفة المشتريات</p>
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-gray-600 dark:text-gray-400">
              <span>🛍 تكلفة المشتريات</span>
              <span>{order.estimate_total} ج.م</span>
            </div>
            <div className="flex justify-between text-gray-600 dark:text-gray-400">
              <span>🚗 رسوم التوصيل</span>
              <span>{order.delivery_fee} ج.م</span>
            </div>
            {parseFloat(order.service_fee || 0) > 0 && (
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>🔧 رسوم الخدمة</span>
                <span>{order.service_fee} ج.م</span>
              </div>
            )}
            {parseFloat(order.places_fee || 0) > 0 && (
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>🏪 رسوم الأماكن</span>
                <span>{order.places_fee} ج.م</span>
              </div>
            )}
            {parseFloat(order.promo_discount || 0) > 0 && (
              <div className="flex justify-between text-green-600 dark:text-green-400">
                <span>🎟 خصم</span>
                <span>- {order.promo_discount} ج.م</span>
              </div>
            )}
            <div className="flex justify-between font-bold border-t border-green-200 dark:border-green-700 pt-1">
              <span className="text-green-800 dark:text-green-300">الإجمالي</span>
              <span className="text-green-700 dark:text-green-300">
                {(parseFloat(order.estimate_total || 0) + parseFloat(order.delivery_fee || 0) + parseFloat(order.service_fee || 0) + parseFloat(order.places_fee || 0) - parseFloat(order.promo_discount || 0)).toFixed(0)} ج.م
              </span>
            </div>
          </div>
        </div>
      )}



      {/* Rating */}
      {order.status === 'completed' && !order.rating && !showRating && (
        <button onClick={() => setShowRating(true)} className="w-full card text-center text-primary-600 font-bold hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors">
          ⭐ قيّم تجربتك
        </button>
      )}

      {showRating && (
        <div className="card space-y-4">
          <h3 className="font-bold text-gray-900 dark:text-white">تقييم الطلب</h3>
          <div className="flex justify-center gap-2">
            {[1,2,3,4,5].map(star => (
              <button key={star} onClick={() => setRating(star)} className={`text-3xl transition-all ${star <= rating ? 'text-yellow-400 scale-110' : 'text-gray-300'}`}>★</button>
            ))}
          </div>
          <textarea value={review} onChange={(e) => setReview(e.target.value)} className="input-field" rows={2} placeholder="تعليقك (اختياري)" />
          <textarea value={complaint} onChange={(e) => setComplaint(e.target.value)} className="input-field" rows={2} placeholder="شكوى (اختياري)" />
          <button onClick={handleRate} className="btn-primary w-full">إرسال التقييم</button>
        </div>
      )}

      {order.rating && (
        <div className="card">
          <h3 className="font-bold text-gray-900 dark:text-white mb-2">تقييمك</h3>
          <div className="flex gap-1 text-yellow-400 text-xl">
            {[1,2,3,4,5].map(s => <span key={s}>{s <= order.rating ? '★' : '☆'}</span>)}
          </div>
          {order.review && <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">{order.review}</p>}
        </div>
      )}
    </div>
  );
}
