import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { useSiteStatus } from '../../context/SiteStatusContext';
import {
  ChevronLeft, ChevronRight, MapPin, Package, ShoppingCart, Tag,
  CheckCircle, Plus, Trash2, Navigation, Home, Info, Store, AlertTriangle,
  Truck, User, Box, ArrowLeftRight
} from 'lucide-react';
import toast from 'react-hot-toast';

// Auto-generate store emojis from min_places + is_open_ended
const buildHomeIcons = (minPlaces, isOpenEnded) => {
  const count = Math.min(parseInt(minPlaces) || 1, 5);
  return <span className="inline-flex items-center gap-0.5 text-primary-500" aria-label={`${count} أماكن`}>
    {Array.from({ length: count }, (_, index) => <Home key={index} size={22} strokeWidth={2.2} />)}
    {isOpenEnded && <span className="text-xl font-bold leading-none">+</span>}
  </span>;
};

const emptyPlaceDetail = () => ({ name: '', description: '' });

// ─────────────────────────────────────────────────────────────────────────────
// Steps for مشتريات:  1-vehicle → 2-service → 3-locations → 4-places → 5-type → 6-notes → 7-review
// Steps for delivery:  1-vehicle → 2-service → D1-subtype → D2-pickup → D3-dropoff → D4-review
// We handle this by using a "mode" state and separate step counters per mode
// ─────────────────────────────────────────────────────────────────────────────

export default function CreateOrder() {
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState(null); // null | 'shopping' | 'delivery'
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [locations, setLocations] = useState([]);
  const [pricing, setPricing] = useState(null);
  const [placeOptions, setPlaceOptions] = useState([]);
  const [pricingSettings, setPricingSettings] = useState({});
  const [lookingUpPrice, setLookingUpPrice] = useState(false);
  const navigate = useNavigate();
  const { accepting_orders, offline_message } = useSiteStatus();

  // ── Shopping form state ───────────────────────────────────────────────────
  const [form, setForm] = useState({
    vehicle_id: '',
    service_type: 'ready_items',
    locations: [{ location_id: '', custom_address: '', name: '' }],
    items: [],
    notes: '',
    promo_code: '',
    num_places: null,
    places_fee: 0,
    place_details: [],
    _selected_option_id: null,
  });

  // ── Delivery form state ───────────────────────────────────────────────────
  const [delivery, setDelivery] = useState({
    sub_type: null,           // 'person' | 'package'
    pickup_location_id: '',
    pickup_address: '',
    dropoff_location_id: '',
    dropoff_address: '',
    notes: '',
    promo_code: '',
  });

  useEffect(() => {
    api.get('/locations').then(r => setLocations(r.data)).catch(() => {});
    api.get('/vehicles').then(r => { if (r) setVehicles(r.data); }).catch(() => {});
    api.get('/place-options').then(r => setPlaceOptions(r.data)).catch(() => {});
    api.get('/pricing').then(r => {
      const map = {};
      r.data.forEach(s => { map[s.key] = parseFloat(s.value) || 0; });
      setPricingSettings(map);
    }).catch(() => {});
  }, []);

  // ── Auto-lookup delivery route price when both locations selected ─────────
  useEffect(() => {
    if (!delivery.pickup_location_id || !delivery.dropoff_location_id) {
      setPricing(null);
      return;
    }
    setLookingUpPrice(true);
    api.post('/orders/preview', {
      service_type: 'delivery_service',
      pickup_location_id: delivery.pickup_location_id,
      dropoff_location_id: delivery.dropoff_location_id,
      promo_code: delivery.promo_code
    })
      .then(r => setPricing(r.data))
      .catch(() => setPricing(null))
      .finally(() => setLookingUpPrice(false));
  }, [delivery.pickup_location_id, delivery.dropoff_location_id, delivery.promo_code]);

  // ── Shopping helpers ──────────────────────────────────────────────────────
  const addStop = () => {
    if (form.locations.length < 5)
      setForm({ ...form, locations: [...form.locations, { location_id: '', custom_address: '', name: '' }] });
  };
  const removeStop = (idx) => setForm({ ...form, locations: form.locations.filter((_, i) => i !== idx) });
  const updateStop = (idx, field, value) => {
    const updated = [...form.locations];
    updated[idx] = { ...updated[idx], [field]: value };
    if (field === 'location_id') {
      const loc = locations.find(l => l.id === value);
      updated[idx].name = loc ? loc.name_ar : '';
    }
    setForm({ ...form, locations: updated });
  };
  const selectPlaces = (option) => {
    const fee     = parseFloat(option.price) || 0;
    const count   = option.min_places;
    const details = Array.from({ length: count }, emptyPlaceDetail);
    setForm({ ...form, num_places: count, places_fee: fee, place_details: details, _selected_option_id: option.id });
  };
  const addPlaceDetail = () => setForm({ ...form, place_details: [...form.place_details, emptyPlaceDetail()] });
  const removePlaceDetail = (idx) => {
    if (form.place_details.length <= (selectedPlacesOption?.min_places || 1)) return;
    setForm({ ...form, place_details: form.place_details.filter((_, i) => i !== idx) });
  };
  const updatePlaceDetail = (idx, field, value) => {
    const updated = [...form.place_details];
    updated[idx] = { ...updated[idx], [field]: value };
    setForm({ ...form, place_details: updated });
  };

  // ── Pricing preview (shopping only) ──────────────────────────────────────
  const previewPricing = async () => {
    const locationIds = form.locations.map(l => l.location_id).filter(Boolean);
    if (!locationIds.length) { toast.error('اختر منطقة تسعير واحدة على الأقل'); return; }
    const itemsSubtotal = form.items.reduce((s, i) => s + (parseFloat(i.price) || 0) * (parseInt(i.quantity) || 1), 0);
    try {
      const res = await api.post('/orders/preview', {
        location_ids: locationIds, service_type: form.service_type,
        items_subtotal: itemsSubtotal, promo_code: form.promo_code,
        places_fee: form.places_fee, vehicle_id: form.vehicle_id
      });
      setPricing(res.data);
    } catch { toast.error('فشل حساب السعر'); }
  };

  // ── Step progression ──────────────────────────────────────────────────────
  // SHOPPING steps: 1(vehicle) → 2(service-select) → 3(locations) → 4(places) → 5(type) → 6(notes) → 7(review)
  // DELIVERY steps: 1(vehicle) → 2(service-select) → D1(subtype) → D2(pickup) → D3(dropoff) → D4(review)
  // We encode delivery steps as 10+n so they don't conflict with shopping steps

  const SHOPPING_TOTAL = 7;
  const DELIVERY_STEPS = [10, 11, 12, 13]; // D1..D4

  const isDeliveryStep = step >= 10;
  const isLastStep = mode === 'shopping' ? step === SHOPPING_TOTAL : step === 13;

  // Trigger shopping preview on step 7
  useEffect(() => {
    if (step === 7 && mode === 'shopping' && form.vehicle_id) previewPricing();
  }, [step]); // eslint-disable-line

  const canAdvance = () => {
    if (step === 1) return !!form.vehicle_id;
    if (step === 2) return mode !== null; // must pick shopping or delivery

    // ── Shopping ──
    if (step === 3) {
      return form.locations.some(l => l.location_id) && form.locations.every(l => l.custom_address.trim() !== '');
    }
    if (step === 4) {
      return form.num_places !== null;
    }
    // steps 5,6 always ok

    // ── Delivery ──
    if (step === 10) return delivery.sub_type !== null;
    if (step === 11) return !!delivery.pickup_location_id && delivery.pickup_address.trim() !== '';
    if (step === 12) {
      if (!delivery.dropoff_location_id || delivery.dropoff_address.trim() === '') return false;
      return pricing !== null;
    }

    return true;
  };

  const handleNext = () => {
    if (!canAdvance()) {
      if (step === 2) toast.error('اختر نوع الخدمة أولاً');
      else if (step === 3) {
        if (!form.locations.some(l => l.location_id)) toast.error('اختر منطقة تسعير لكل محطة');
        else toast.error('أدخل عنوان التوصيل التفصيلي لكل محطة');
      } else if (step === 4) {
        if (form.num_places === null) toast.error('اختر عدد الأماكن');
      } else if (step === 10) toast.error('اختر شخص أو طرد');
      else if (step === 11) toast.error('اختر منطقة الاستلام وأدخل العنوان التفصيلي');
      else if (step === 12) {
        if (!delivery.dropoff_location_id || !delivery.dropoff_address.trim()) toast.error('اختر منطقة التسليم وأدخل العنوان');
        else toast.error('لا يوجد سعر محدد لهذا المسار — تواصل مع المشرف');
      }
      return;
    }

    if (step === 2) {
      // Branch into the correct flow
      setStep(mode === 'delivery' ? 10 : 3);
    } else if (isDeliveryStep) {
      if (step === 13) return; // last delivery step — handled by submit
      setStep(step + 1);
    } else {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step === 3 || step === 10) { setStep(2); } // both branch back to service select
    else if (isDeliveryStep) setStep(step - 1);
    else setStep(step - 1);
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setLoading(true);
    try {
      let payload;

      if (mode === 'delivery') {
        payload = {
          vehicle_id: form.vehicle_id,
          service_type: 'delivery_service',
          delivery_sub_type: delivery.sub_type,
          pickup_location_id: delivery.pickup_location_id,
          pickup_address: delivery.pickup_address,
          dropoff_location_id: delivery.dropoff_location_id,
          dropoff_address: delivery.dropoff_address,
          notes: delivery.notes,
          promo_code: delivery.promo_code
        };
      } else {
        const customer_address = form.locations.map(l => l.custom_address).filter(Boolean).join(' | ');
        payload = {
          vehicle_id: form.vehicle_id,
          service_type: form.service_type,
          locations: form.locations.map(l => ({
            location_id: l.location_id || null,
            custom_address: l.custom_address,
            name: l.name
          })),
          items: form.service_type === 'driver_purchase' ? form.items : [],
          customer_address,
          notes: form.notes,
          promo_code: form.promo_code,
          num_places: form.num_places || 1,
          places_fee: form.places_fee,
          place_details: form.place_details
        };
      }

      const res = await api.post('/orders', payload);
      toast.success('تم إنشاء الطلب بنجاح!');
      navigate(`/customer/orders/${res.data.order.id}`);
    } catch (err) {
      const data = err.response?.data;
      if (data?.offline) toast.error(`🔴 ${data.message}`, { duration: 6000 });
      else toast.error(data?.message || 'فشل إنشاء الطلب');
    } finally {
      setLoading(false);
    }
  };

  // ── Step bar config ───────────────────────────────────────────────────────
  const shoppingSteps = [
    { num: 1, title: 'المركبة',  icon: <Package size={14} /> },
    { num: 2, title: 'الخدمة',   icon: <Truck size={14} /> },
    { num: 3, title: 'المواقع',  icon: <MapPin size={14} /> },
    { num: 4, title: 'الأماكن',  icon: <Store size={14} /> },
    { num: 5, title: 'النوع',    icon: <ShoppingCart size={14} /> },
    { num: 6, title: 'التفاصيل', icon: <Tag size={14} /> },
    { num: 7, title: 'المراجعة', icon: <CheckCircle size={14} /> },
  ];
  const deliverySteps = [
    { num: 1,  title: 'المركبة',  icon: <Package size={14} /> },
    { num: 2,  title: 'الخدمة',   icon: <Truck size={14} /> },
    { num: 10, title: 'النوع',    icon: <Box size={14} /> },
    { num: 11, title: 'الاستلام', icon: <MapPin size={14} /> },
    { num: 12, title: 'التسليم',  icon: <Navigation size={14} /> },
    { num: 13, title: 'مراجعة',   icon: <CheckCircle size={14} /> },
  ];

  const activeSteps = mode === 'delivery' ? deliverySteps : shoppingSteps;
  const locationPrice = (id) => { const l = locations.find(x => x.id === id); return l ? parseFloat(l.delivery_price) || 0 : 0; };
  const selectedPlacesOption = placeOptions.find(o => o.id === form._selected_option_id);
  const isOpenEnded = selectedPlacesOption?.is_open_ended || false;
  const pickupArea  = locations.find(l => l.id === delivery.pickup_location_id);
  const dropoffArea = locations.find(l => l.id === delivery.dropoff_location_id);

  return (
    <div className="animate-fade-in">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">طلب جديد</h2>

      {/* Offline block */}
      {!accepting_orders && (
        <div className="card border-2 border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-900/20 text-center py-10 space-y-3">
          <AlertTriangle size={44} className="mx-auto text-red-500" />
          <p className="text-xl font-bold text-red-700 dark:text-red-300">الخدمة متوقفة مؤقتاً</p>
          <p className="text-red-600 dark:text-red-400 max-w-xs mx-auto">{offline_message}</p>
          <button onClick={() => navigate('/customer')} className="btn-secondary mt-2">العودة للرئيسية</button>
        </div>
      )}

      {accepting_orders && (
        <>
          {/* Progress bar */}
          <div className="flex items-center justify-between mb-6 overflow-x-auto pb-1">
            {activeSteps.map((s, i) => {
              const isActive  = step === s.num;
              const isDone    = (mode === 'delivery')
                ? DELIVERY_STEPS.indexOf(step) > DELIVERY_STEPS.indexOf(s.num) || (s.num < 10 && step >= 10 && s.num <= 2)
                : step > s.num;
              return (
                <div key={s.num} className="flex items-center flex-shrink-0">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isActive || isDone ? 'bg-primary-500 text-white shadow-md' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                  }`}>
                    {isDone ? <CheckCircle size={14} /> : s.icon}
                  </div>
                  {i < activeSteps.length - 1 && (
                    <div className={`w-5 h-0.5 mx-0.5 transition-all ${isDone ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* ── STEP 1: Vehicle ───────────────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900 dark:text-white">اختر نوع المركبة</h3>
              {vehicles.map(v => {
                const surcharge = v.type === 'tuk_tuk' ? (pricingSettings['tuk_tuk_surcharge'] || 0)
                                : v.type === 'car'     ? (pricingSettings['car_surcharge']     || 0)
                                : 0;
                return (
                  <button key={v.id} onClick={() => setForm({ ...form, vehicle_id: v.id })}
                    className={`w-full card flex items-center gap-4 text-right transition-all ${form.vehicle_id === v.id ? 'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900/20' : ''}`}>
                    <span className="text-3xl">{v.icon}</span>
                    <div className="flex-1">
                      <p className="font-bold text-gray-900 dark:text-white">{v.name_ar}</p>
                      <p className="text-sm text-gray-500">{v.name_en}</p>
                      {surcharge > 0 ? (
                        <span className="inline-flex items-center gap-1 mt-1 text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 px-2 py-0.5 rounded-full">
                          + {surcharge} ج.م رسوم إضافية على سعر المنطقة
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 mt-1 text-xs font-semibold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 px-2 py-0.5 rounded-full">
                          ✓ لا رسوم إضافية
                        </span>
                      )}
                    </div>
                    {form.vehicle_id === v.id && <CheckCircle size={20} className="text-primary-500 flex-shrink-0" />}
                  </button>
                );
              })}

              {/* Note shown when tuk-tuk or car is selected */}
              {(() => {
                const selected = vehicles.find(v => v.id === form.vehicle_id);
                if (!selected || (selected.type !== 'tuk_tuk' && selected.type !== 'car')) return null;
                const isTukTuk = selected.type === 'tuk_tuk';
                const vehicleName = isTukTuk ? 'توك توك' : 'سيارة';
                const fee = isTukTuk ? '٥' : '١٠';
                return (
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 animate-fade-in">
                    <span className="text-xl flex-shrink-0">⚠️</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                        لطلب {vehicleName} يرجى التواصل مع الإدارة
                      </p>
                      <a href="tel:01019488741" className="inline-block mt-1 text-sm font-bold text-amber-700 dark:text-amber-300 underline">
                        01019488741
                      </a>
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">رسوم إضافية {fee} ج</p>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ── STEP 2: Service type selection ───────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900 dark:text-white">اختر نوع الخدمة</h3>

              {/* مشتريات */}
              <button onClick={() => setMode('shopping')}
                className={`w-full card text-right transition-all ${mode === 'shopping' ? 'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900/20' : ''}`}>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🛒</span>
                  <div className="flex-1">
                    <p className="font-bold text-gray-900 dark:text-white text-lg">مشتريات</p>
                    <p className="text-sm text-gray-500">السائق يشتري أو يستلم طلبات ويوصلها إليك</p>
                  </div>
                  {mode === 'shopping' && <CheckCircle size={20} className="text-primary-500 flex-shrink-0" />}
                </div>
              </button>

              {/* خدمة التوصيل */}
              <button onClick={() => setMode('delivery')}
                className={`w-full card text-right transition-all ${mode === 'delivery' ? 'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900/20' : ''}`}>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🚗</span>
                  <div className="flex-1">
                    <p className="font-bold text-gray-900 dark:text-white text-lg">خدمة التوصيل</p>
                    <p className="text-sm text-gray-500">توصيل شخص أو طرد من مكان لآخر</p>
                    <span className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 px-2 py-0.5 rounded-full">
                      <ArrowLeftRight size={11} /> سعر ثابت بين المناطق
                    </span>
                  </div>
                  {mode === 'delivery' && <CheckCircle size={20} className="text-primary-500 flex-shrink-0" />}
                </div>
              </button>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              SHOPPING STEPS (3–7) — original flow, completely unchanged
          ══════════════════════════════════════════════════════════════════ */}

          {/* ── Step 3: Locations ─────────────────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">محطات التوصيل</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">لكل محطة: اختر المنطقة الأقرب لك (للتسعير)، ثم أدخل عنوانك الدقيق (للتوصيل الفعلي)</p>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl text-sm">
                <Navigation size={15} className="text-blue-500 flex-shrink-0" />
                <span className="text-blue-700 dark:text-blue-300 font-medium">نقطة انطلاق السائق: <strong>السنطة</strong></span>
              </div>
              {form.locations.map((loc, idx) => {
                const selectedLocation = locations.find(l => l.id === loc.location_id);
                return (
                  <div key={idx} className="card space-y-3 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-primary-600 dark:text-primary-400">📍 محطة {idx + 1}</span>
                      {form.locations.length > 1 && (
                        <button onClick={() => removeStop(idx)} className="text-red-400 hover:text-red-600 transition-colors"><Trash2 size={16} /></button>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1"><Tag size={11} /> المنطقة (لتحديد السعر)</label>
                      <select value={loc.location_id} onChange={e => updateStop(idx, 'location_id', e.target.value)} className="input-field text-sm">
                        <option value="">اختر المنطقة الأقرب لك...</option>
                        {locations.map(l => <option key={l.id} value={l.id}>{l.name_ar} — {l.delivery_price} ج.م</option>)}
                      </select>
                      {selectedLocation && (
                        <p className="text-xs text-primary-600 dark:text-primary-400 mt-1 font-semibold">
                          💰 سعر التوصيل لهذه المنطقة: {selectedLocation.delivery_price} ج.م
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1"><Home size={11} /> العنوان التفصيلي (للسائق)</label>
                      <input value={loc.custom_address} onChange={e => updateStop(idx, 'custom_address', e.target.value)}
                        className="input-field text-sm" placeholder="الشارع، المبنى، أقرب معلم..." />
                      <p className="text-[10px] text-gray-400 mt-0.5">هذا هو العنوان الفعلي الذي سيتوجه إليه السائق</p>
                    </div>
                  </div>
                );
              })}
              {form.locations.length < 5 && (
                <button onClick={addStop} className="w-full py-3 border-2 border-dashed border-primary-300 dark:border-primary-700 rounded-xl text-primary-600 dark:text-primary-400 font-semibold flex items-center justify-center gap-2 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors">
                  <Plus size={18} /> إضافة محطة أخرى
                </button>
              )}
              {form.locations.some(l => l.location_id) && (
                <div className="card bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800">
                  <p className="text-sm font-semibold text-primary-700 dark:text-primary-300 mb-2 flex items-center gap-1"><Info size={14} /> تقدير أولي لرسوم التوصيل</p>
                  <div className="space-y-1">
                    {form.locations.filter(l => l.location_id).map((l, i) => {
                      const area = locations.find(x => x.id === l.location_id);
                      return area ? (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-300">{area.name_ar}</span>
                          <span className="font-bold text-primary-600">{parseFloat(area.delivery_price).toFixed(2)} ج.م</span>
                        </div>
                      ) : null;
                    })}
                    <div className="border-t border-primary-200 dark:border-primary-700 pt-1 flex justify-between text-sm font-bold">
                      <span className="text-gray-700 dark:text-gray-200">الإجمالي التقديري</span>
                      <span className="text-primary-600">{form.locations.reduce((s, l) => s + locationPrice(l.location_id), 0).toFixed(2)} ج.م</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Step 4: Number of Places ──────────────────────────────────────── */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2"><Store size={18} className="text-primary-500" /> كم مكاناً يحتاج السائق زيارته؟</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">حدد عدد الأماكن التي يحتاج السائق الذهاب إليها للشراء أو الاستلام</p>
              </div>
              <div className="space-y-2">
                {placeOptions.length === 0 && <div className="card text-center py-6 text-gray-400 text-sm">جاري التحميل...</div>}
                {placeOptions.map(option => {
                  const price = parseFloat(option.price);
                  const isSelected = form._selected_option_id === option.id;
                  return (
                    <button key={option.id} onClick={() => selectPlaces(option)}
                      className={`w-full card flex items-center gap-4 text-right transition-all duration-200 ${isSelected ? 'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-md' : 'hover:border-primary-200 dark:hover:border-primary-800'}`}>
                      <span className="leading-none flex-shrink-0">{buildHomeIcons(option.min_places, option.is_open_ended)}</span>
                      <div className="flex-1 text-right">
                        <p className="font-bold text-gray-900 dark:text-white">{option.label_ar}</p>
                        <p className="text-sm text-primary-600 dark:text-primary-400 font-semibold mt-0.5">{price === 0 ? 'بدون رسوم إضافية' : `+ ${price} ج.م`}</p>
                      </div>
                      {isSelected && <CheckCircle size={20} className="text-primary-500 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
              {form.num_places !== null && (
                <div className="space-y-3 pt-2">
                  {form.places_fee > 0 && (
                    <div className="flex items-center justify-between px-4 py-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl border border-primary-100 dark:border-primary-800">
                      <span className="text-sm font-medium text-primary-700 dark:text-primary-300">رسوم عدد الأماكن</span>
                      <span className="font-bold text-primary-600">+ {form.places_fee} ج.م</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Step 5: Service sub-type (shopping) ──────────────────────────── */}
          {step === 5 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900 dark:text-white">نوع الطلب</h3>
              <button onClick={() => setForm({ ...form, service_type: 'ready_items', items: [] })}
                className={`w-full card text-right transition-all ${form.service_type === 'ready_items' ? 'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900/20' : ''}`}>
                <p className="font-bold text-gray-900 dark:text-white mb-1">📦 الطلبات جاهزة</p>
                <p className="text-sm text-gray-500">السائق يأخذ الطلبات الجاهزة ويوصلها فقط</p>
                {pricingSettings['ready_items_fee'] > 0 ? (
                  <span className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 px-2 py-0.5 rounded-full">
                    + {pricingSettings['ready_items_fee']} ج.م رسوم خدمة
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 px-2 py-0.5 rounded-full">
                    ✓ لا رسوم إضافية
                  </span>
                )}
              </button>
              <button onClick={() => setForm({ ...form, service_type: 'driver_purchase' })}
                className={`w-full card text-right transition-all ${form.service_type === 'driver_purchase' ? 'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900/20' : ''}`}>
                <p className="font-bold text-gray-900 dark:text-white mb-1">🛒 السائق يشتري</p>
                <p className="text-sm text-gray-500">اطلب من السائق شراء المنتجات نيابة عنك</p>
                {pricingSettings['driver_purchase_fee'] > 0 ? (
                  <span className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 px-2 py-0.5 rounded-full">
                    + {pricingSettings['driver_purchase_fee']} ج.م رسوم خدمة شراء
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 px-2 py-0.5 rounded-full">
                    ✓ لا رسوم إضافية
                  </span>
                )}
              </button>
            </div>
          )}

          {/* ── Step 6: Notes & Promo (shopping) ─────────────────────────────── */}
          {step === 6 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">ملاحظات وكوبون الخصم</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ملاحظات (اختياري)</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                  className="input-field" rows={3} placeholder="أي ملاحظات خاصة بالطلب..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">كود الخصم (اختياري)</label>
                <div className="flex gap-2">
                  <input value={form.promo_code} onChange={e => setForm({ ...form, promo_code: e.target.value })}
                    className="input-field flex-1" placeholder="أدخل الكود" />
                  <button onClick={previewPricing} className="btn-secondary whitespace-nowrap">تطبيق</button>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 7: Shopping Review ──────────────────────────────────────── */}
          {step === 7 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">مراجعة الطلب</h3>
              <div className="card flex items-center gap-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
                <Navigation size={18} className="text-blue-500 flex-shrink-0" />
                <div>
                  <p className="text-xs text-blue-500 font-medium">نقطة انطلاق السائق</p>
                  <p className="font-bold text-blue-700 dark:text-blue-300">السنطة</p>
                </div>
              </div>
              <div className="card space-y-3">
                <h4 className="font-semibold text-gray-800 dark:text-white text-sm border-b border-gray-100 dark:border-gray-700 pb-2">محطات التوصيل</h4>
                {form.locations.map((loc, idx) => {
                  const area = locations.find(l => l.id === loc.location_id);
                  return (
                    <div key={idx} className="space-y-1">
                      <p className="text-xs font-bold text-primary-600">📍 محطة {idx + 1}</p>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 flex items-center gap-1"><Tag size={11} /> المنطقة:</span>
                        <span className="font-medium text-gray-800 dark:text-gray-200">{area ? area.name_ar : '—'}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 flex items-center gap-1"><Home size={11} /> العنوان:</span>
                        <span className="font-medium text-gray-800 dark:text-gray-200 text-right max-w-[55%]">{loc.custom_address || '—'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {selectedPlacesOption && (
                <div className="card space-y-2">
                  <h4 className="font-semibold text-gray-800 dark:text-white text-sm border-b border-gray-100 dark:border-gray-700 pb-2 flex items-center gap-2"><Store size={14} className="text-primary-500" /> عدد الأماكن للشراء</h4>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      <span className="inline-flex items-center gap-2 align-middle">{buildHomeIcons(selectedPlacesOption.min_places, selectedPlacesOption.is_open_ended)} {selectedPlacesOption.label_ar}</span>
                    </span>
                    <span className="text-sm font-bold text-primary-600">{form.places_fee === 0 ? 'بدون رسوم إضافية' : `+ ${form.places_fee} ج.م`}</span>
                  </div>
                </div>
              )}
              {pricing ? (
                <div className="card space-y-2">
                  <h4 className="font-semibold text-gray-800 dark:text-white text-sm border-b border-gray-100 dark:border-gray-700 pb-2">تفصيل الأسعار</h4>
                  {pricing.locationBreakdown?.map(loc => (
                    <div key={loc.id} className="flex justify-between text-sm">
                      <span className="text-gray-500">توصيل ({loc.name_ar})</span>
                      <span className="font-semibold">{loc.delivery_price} ج.م</span>
                    </div>
                  ))}
                  {pricing.vehicleSurcharge > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">🚗 رسوم المركبة</span>
                      <span className="font-semibold">{pricing.vehicleSurcharge} ج.م</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">رسوم الخدمة</span>
                    <span className="font-semibold">{pricing.serviceFee} ج.م</span>
                  </div>
                  {pricing.placesFee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 flex items-center gap-1"><Store size={11} /> رسوم عدد الأماكن ({selectedPlacesOption?.label_ar})</span>
                      <span className="font-semibold">{pricing.placesFee} ج.م</span>
                    </div>
                  )}
                  {pricing.itemsSubtotal > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">قيمة المشتريات</span>
                      <span className="font-semibold">{pricing.itemsSubtotal} ج.م</span>
                    </div>
                  )}
                  {pricing.promoDiscount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-green-600">خصم الكوبون</span>
                      <span className="font-semibold text-green-600">-{pricing.promoDiscount} ج.م</span>
                    </div>
                  )}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-2 flex justify-between">
                    <span className="font-bold text-gray-900 dark:text-white">اجمالي سعر التوصيل</span>
                    <span className="font-bold text-xl text-primary-600">{pricing.finalTotal} ج.م</span>
                  </div>
                </div>
              ) : (
                <div className="card text-center py-6">
                  <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-sm text-gray-500">جاري حساب السعر...</p>
                </div>
              )}
              <div className="card bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800">
                <p className="text-sm text-primary-700 dark:text-primary-300">✅ بالضغط على "تأكيد الطلب"، أنت توافق على الشروط والأحكام</p>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              DELIVERY STEPS (10–13)
          ══════════════════════════════════════════════════════════════════ */}

          {/* ── D1 (step 10): Person or Package ──────────────────────────────── */}
          {step === 10 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900 dark:text-white">ماذا تريد توصيل؟</h3>
              <button onClick={() => setDelivery({ ...delivery, sub_type: 'person' })}
                className={`w-full card flex items-center gap-4 text-right transition-all ${delivery.sub_type === 'person' ? 'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900/20' : ''}`}>
                <span className="text-4xl">🧑</span>
                <div className="flex-1">
                  <p className="font-bold text-gray-900 dark:text-white text-lg">شخص</p>
                  <p className="text-sm text-gray-500">توصيل شخص من مكان إلى آخر</p>
                </div>
                {delivery.sub_type === 'person' && <CheckCircle size={20} className="text-primary-500 flex-shrink-0" />}
              </button>
              <button onClick={() => setDelivery({ ...delivery, sub_type: 'package' })}
                className={`w-full card flex items-center gap-4 text-right transition-all ${delivery.sub_type === 'package' ? 'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900/20' : ''}`}>
                <span className="text-4xl">📦</span>
                <div className="flex-1">
                  <p className="font-bold text-gray-900 dark:text-white text-lg">طرد / بضاعة /اوردر </p>
                  <p className="text-sm text-gray-500">توصيل طرد أو بضاعة من مكان لآخر</p>
                </div>
                {delivery.sub_type === 'package' && <CheckCircle size={20} className="text-primary-500 flex-shrink-0" />}
              </button>
            </div>
          )}

          {/* ── D2 (step 11): Pickup location ────────────────────────────────── */}
          {step === 11 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                  <MapPin size={18} className="text-green-500" />
                  {delivery.sub_type === 'person' ? 'أين الشخص الآن؟' : 'أين الطرد الآن؟'}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">اختر المنطقة الأقرب ثم أدخل العنوان التفصيلي</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1"><Tag size={11} /> المنطقة</label>
                <select value={delivery.pickup_location_id}
                  onChange={e => setDelivery({ ...delivery, pickup_location_id: e.target.value })}
                  className="input-field">
                  <option value="">اختر المنطقة...</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name_ar}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1"><Home size={11} /> العنوان التفصيلي</label>
                <input value={delivery.pickup_address}
                  onChange={e => setDelivery({ ...delivery, pickup_address: e.target.value })}
                  className="input-field" placeholder="الشارع، المبنى، أقرب معلم..." />
              </div>
            </div>
          )}

          {/* ── D3 (step 12): Dropoff location ───────────────────────────────── */}
          {step === 12 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                  <Navigation size={18} className="text-red-500" />
                  {delivery.sub_type === 'person' ? 'إلى أين يريد الذهاب؟' : 'إلى أين يُوصَّل الطرد؟'}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">اختر المنطقة الأقرب ثم أدخل العنوان التفصيلي</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1"><Tag size={11} /> المنطقة</label>
                <select value={delivery.dropoff_location_id}
                  onChange={e => setDelivery({ ...delivery, dropoff_location_id: e.target.value })}
                  className="input-field">
                  <option value="">اختر المنطقة...</option>
                  {locations.filter(l => l.id !== delivery.pickup_location_id).map(l => (
                    <option key={l.id} value={l.id}>{l.name_ar}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1"><Home size={11} /> العنوان التفصيلي</label>
                <input value={delivery.dropoff_address}
                  onChange={e => setDelivery({ ...delivery, dropoff_address: e.target.value })}
                  className="input-field" placeholder="الشارع، المبنى، أقرب معلم..." />
              </div>

              {/* Route price preview */}
              {delivery.pickup_location_id && delivery.dropoff_location_id && (
                <div className={`card border-2 text-center ${pricing !== null ? 'border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/20' : 'border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20'}`}>
                  {lookingUpPrice ? (
                    <div className="flex items-center justify-center gap-2 py-2">
                      <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm text-gray-500">جاري حساب السعر...</span>
                    </div>
                  ) : pricing !== null ? (
                    <>
                      <p className="text-xs text-primary-600 dark:text-primary-400 font-medium mb-1">
                        {pickupArea?.name_ar} → {dropoffArea?.name_ar}
                      </p>
                      <p className="text-3xl font-bold text-primary-600">{pricing.deliveryFee} ج.م</p>
                      <p className="text-xs text-gray-500 mt-1">السعر الإجمالي لهذا المسار</p>
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={24} className="mx-auto text-amber-500 mb-1" />
                      <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">لم يتم تحديد سعر لهذا المسار بعد</p>
                      <p className="text-xs text-amber-600 dark:text-amber-400">تواصل مع المشرف لإضافة هذا المسار </p>
                      <p className="text-xs text-amber-600 dark:text-amber-400">01019488741</p>
                    </>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ملاحظات (اختياري)</label>
                <textarea value={delivery.notes} onChange={e => setDelivery({ ...delivery, notes: e.target.value })}
                  className="input-field mb-3" rows={2} placeholder="أي ملاحظات للسائق..." />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">كود خصم (إن وجد)</label>
                <div className="relative">
                  <input value={delivery.promo_code} onChange={e => setDelivery({ ...delivery, promo_code: e.target.value })}
                    className="input-field pr-10 uppercase" placeholder="أدخل كود الخصم" />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🎟</span>
                </div>
              </div>
            </div>
          )}

          {/* ── D4 (step 13): Delivery Review & Confirm ──────────────────────── */}
          {step === 13 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">مراجعة وتأكيد الطلب</h3>

              <div className="card space-y-3 border-2 border-primary-200 dark:border-primary-800">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-700">
                  {delivery.sub_type === 'person'
                    ? <><User size={18} className="text-primary-500" /><span className="font-bold text-gray-900 dark:text-white">توصيل شخص</span></>
                    : <><Box size={18} className="text-primary-500" /><span className="font-bold text-gray-900 dark:text-white">توصيل طرد</span></>}
                </div>

                <div className="space-y-2">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <MapPin size={12} className="text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 font-medium">{delivery.sub_type === 'person' ? 'موقع الشخص' : 'موقع الطرد'}</p>
                      <p className="font-semibold text-gray-900 dark:text-white">{pickupArea?.name_ar}</p>
                      <p className="text-sm text-gray-500">{delivery.pickup_address}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Navigation size={12} className="text-red-500" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 font-medium">الوجهة</p>
                      <p className="font-semibold text-gray-900 dark:text-white">{dropoffArea?.name_ar}</p>
                      <p className="text-sm text-gray-500">{delivery.dropoff_address}</p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-300 font-medium">سعر التوصيل</span>
                    <span className="font-bold text-gray-900 dark:text-white">{pricing?.deliveryFee} ج.م</span>
                  </div>
                  {pricing?.promoDiscount > 0 && (
                    <div className="flex justify-between items-center text-green-600 mt-1">
                      <span className="text-sm font-medium">خصم الكود</span>
                      <span className="font-bold">-{pricing?.promoDiscount} ج.م</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                    <span className="font-bold text-gray-900 dark:text-white">الإجمالي</span>
                    <span className="text-2xl font-bold text-primary-600">{pricing?.finalTotal} ج.م</span>
                  </div>
                </div>
              </div>

              {delivery.notes && (
                <div className="card bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
                  <p className="text-xs text-amber-600 font-medium mb-1">🗒 ملاحظات</p>
                  <p className="text-sm text-amber-800 dark:text-amber-300">{delivery.notes}</p>
                </div>
              )}

              <div className="card bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800">
                <p className="text-sm text-primary-700 dark:text-primary-300">✅ بالضغط على "تأكيد الطلب"، أنت توافق على الشروط والأحكام</p>
              </div>
            </div>
          )}

          {/* ── Navigation buttons ────────────────────────────────────────────── */}
          <div className="flex items-center justify-between mt-6">
            {step > 1 ? (
              <button onClick={handleBack} className="btn-secondary flex items-center gap-1">
                <ChevronRight size={18} /> السابق
              </button>
            ) : <div />}

            {!isLastStep ? (
              <button onClick={handleNext} className="btn-primary flex items-center gap-1">
                التالي <ChevronLeft size={18} />
              </button>
            ) : (
              <button onClick={handleSubmit}
                disabled={loading || (mode === 'shopping' && !pricing) || (mode === 'delivery' && !pricing)}
                className="btn-primary flex items-center gap-2 disabled:opacity-60">
                {loading
                  ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <><CheckCircle size={18} /> تأكيد الطلب</>}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
