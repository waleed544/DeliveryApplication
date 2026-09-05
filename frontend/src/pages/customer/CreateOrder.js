import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { useSiteStatus } from '../../context/SiteStatusContext';
import { ChevronLeft, ChevronRight, MapPin, Package, ShoppingCart, Tag, CheckCircle, Plus, Trash2, Navigation, Home, Info, Store, AlertTriangle } from 'lucide-react';
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

export default function CreateOrder() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [locations, setLocations] = useState([]);   // predefined pricing areas
  const [pricing, setPricing] = useState(null);
  const [placeOptions, setPlaceOptions] = useState([]); // dynamic from API
  const [pricingSettings, setPricingSettings] = useState({}); // key→value map
  const navigate = useNavigate();
  const { accepting_orders, offline_message } = useSiteStatus();

  const [form, setForm] = useState({
    vehicle_id: '',
    service_type: 'ready_items',
    // Each delivery stop has:
    //   location_id    → pricing area (predefined)
    //   custom_address → actual street address the driver goes to
    //   name           → display name
    locations: [{ location_id: '', custom_address: '', name: '' }],
    items: [],
    customer_phone: '',
    notes: '',
    promo_code: '',
    // ── New: Number of Places ──
    num_places: null,          // selected tier
    places_fee: 0,             // price for selected tier
    place_details: [],         // [{ name, description }]
    _selected_option_id: null, // tracks which option card is highlighted
  });

  useEffect(() => {
    api.get('/locations').then(r => setLocations(r.data)).catch(() => {});
    api.get('/vehicles').then(r => { if (r) setVehicles(r.data); }).catch(() => {});
    // Fetch dynamic place-count options from admin-managed table
    api.get('/place-options').then(r => setPlaceOptions(r.data)).catch(() => {});
    // Fetch live pricing settings so we can show surcharges inline on vehicle/service cards
    api.get('/pricing').then(r => {
      const map = {};
      r.data.forEach(s => { map[s.key] = parseFloat(s.value) || 0; });
      setPricingSettings(map);
    }).catch(() => {});
  }, []);

  // ── Location helpers ────────────────────────────────────────────────────────
  const addStop = () => {
    if (form.locations.length < 5) {
      setForm({ ...form, locations: [...form.locations, { location_id: '', custom_address: '', name: '' }] });
    }
  };

  const removeStop = (idx) => {
    setForm({ ...form, locations: form.locations.filter((_, i) => i !== idx) });
  };

  const updateStop = (idx, field, value) => {
    const updated = [...form.locations];
    updated[idx] = { ...updated[idx], [field]: value };
    if (field === 'location_id') {
      const loc = locations.find(l => l.id === value);
      updated[idx].name = loc ? loc.name_ar : '';
    }
    setForm({ ...form, locations: updated });
  };

  // ── Places helpers ──────────────────────────────────────────────────────────────
  const selectPlaces = (option) => {
    const fee = parseFloat(option.price) || 0;
    const count = option.min_places;
    // Build initial place_details array for the chosen count
    const details = Array.from({ length: count }, emptyPlaceDetail);
    setForm({ ...form, num_places: count, places_fee: fee, place_details: details, _selected_option_id: option.id });
  };

  const addPlaceDetail = () => {
    setForm({ ...form, place_details: [...form.place_details, emptyPlaceDetail()] });
  };

  const removePlaceDetail = (idx) => {
    if (form.place_details.length <= (selectedPlacesOption?.min_places || 1)) return;
    setForm({ ...form, place_details: form.place_details.filter((_, i) => i !== idx) });
  };

  const updatePlaceDetail = (idx, field, value) => {
    const updated = [...form.place_details];
    updated[idx] = { ...updated[idx], [field]: value };
    setForm({ ...form, place_details: updated });
  };

  // ── Items helpers ───────────────────────────────────────────────────────────
  const addItem = () => setForm({ ...form, items: [...form.items, { name: '', quantity: 1, unit: 'piece', price: 0 }] });
  const removeItem = (idx) => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });
  const updateItem = (idx, field, value) => {
    const updated = [...form.items];
    updated[idx] = { ...updated[idx], [field]: value };
    setForm({ ...form, items: updated });
  };

  // ── Pricing preview ─────────────────────────────────────────────────────────
  const previewPricing = async () => {
    const locationIds = form.locations.map(l => l.location_id).filter(Boolean);
    if (!locationIds.length) { toast.error('اختر منطقة تسعير واحدة على الأقل'); return; }
    const itemsSubtotal = form.items.reduce((s, i) => s + (parseFloat(i.price) || 0) * (parseInt(i.quantity) || 1), 0);
    try {
      const res = await api.post('/orders/preview', {
        location_ids: locationIds,
        service_type: form.service_type,
        items_subtotal: itemsSubtotal,
        promo_code: form.promo_code,
        places_fee: form.places_fee,
        vehicle_id: form.vehicle_id        // needed for vehicle surcharge
      });
      setPricing(res.data);
    } catch {
      toast.error('فشل حساب السعر');
    }
  };

  useEffect(() => {
    if (step === 6 && form.vehicle_id) previewPricing();
  }, [step]); // eslint-disable-line

  // ── Validation per step ─────────────────────────────────────────────────────
  const canAdvance = () => {
    if (step === 1) return !!form.vehicle_id;
    if (step === 2) {
      const hasPricing = form.locations.some(l => l.location_id);
      const hasAddress = form.locations.every(l => l.custom_address.trim() !== '');
      return hasPricing && hasAddress;
    }
    if (step === 3) {
      if (form.num_places === null) return false;
      return form.place_details.every(p => p.name.trim() !== '');
    }
    if (step === 5) return form.customer_phone.trim() !== '';
    return true;
  };

  const handleNext = () => {
    if (!canAdvance()) {
      if (step === 2) {
        const hasPricing = form.locations.some(l => l.location_id);
        if (!hasPricing) { toast.error('اختر منطقة تسعير لكل محطة'); return; }
        toast.error('أدخل عنوان التوصيل التفصيلي لكل محطة');
      } else if (step === 3) {
        if (form.num_places === null) { toast.error('اختر عدد الأماكن'); return; }
        toast.error('أدخل اسم كل مكان');
      } else if (step === 5) {
        toast.error('أدخل رقم الهاتف');
      }
      return;
    }
    setStep(step + 1);
  };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Compose customer_address from all stop addresses (comma-separated)
      const customer_address = form.locations.map(l => l.custom_address).filter(Boolean).join(' | ');
      const payload = {
        vehicle_id: form.vehicle_id,
        service_type: form.service_type,
        locations: form.locations.map(l => ({
          location_id: l.location_id || null,
          custom_address: l.custom_address,
          name: l.name
        })),
        items: form.service_type === 'driver_purchase' ? form.items : [],
        customer_address,
        customer_phone: form.customer_phone,
        notes: form.notes,
        promo_code: form.promo_code,
        // ── Places data ──
        num_places: form.num_places || 1,
        places_fee: form.places_fee,
        place_details: form.place_details
      };
      const res = await api.post('/orders', payload);
      toast.success('تم إنشاء الطلب بنجاح!');
      navigate(`/customer/orders/${res.data.order.id}`);
    } catch (err) {
      const data = err.response?.data;
      if (data?.offline) {
        toast.error(`🔴 ${data.message}`, { duration: 6000 });
      } else {
        toast.error(data?.message || 'فشل إنشاء الطلب');
      }
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { num: 1, title: 'المركبة',    icon: <Package size={16} /> },
    { num: 2, title: 'المواقع',    icon: <MapPin size={16} /> },
    { num: 3, title: 'الأماكن',    icon: <Store size={16} /> },
    { num: 4, title: 'الخدمة',     icon: <ShoppingCart size={16} /> },
    { num: 5, title: 'التفاصيل',   icon: <Tag size={16} /> },
    { num: 6, title: 'المراجعة',   icon: <CheckCircle size={16} /> },
  ];

  // Helper to get price for a location id — parseFloat because PostgreSQL returns DECIMAL as string
  const locationPrice = (id) => {
    const l = locations.find(x => x.id === id);
    return l ? parseFloat(l.delivery_price) || 0 : 0;
  };

  // Which places option is currently selected
  const selectedPlacesOption = placeOptions.find(o => o.id === form._selected_option_id);
  const isOpenEnded = selectedPlacesOption?.is_open_ended || false;

  return (
    <div className="animate-fade-in">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">طلب توصيل جديد</h2>

      {/* Offline block — shown instead of the whole order form */}
      {!accepting_orders && (
        <div className="card border-2 border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-900/20 text-center py-10 space-y-3">
          <AlertTriangle size={44} className="mx-auto text-red-500" />
          <p className="text-xl font-bold text-red-700 dark:text-red-300">الخدمة متوقفة مؤقتاً</p>
          <p className="text-red-600 dark:text-red-400 max-w-xs mx-auto">{offline_message}</p>
          <button onClick={() => navigate('/customer')} className="btn-secondary mt-2">العودة للرئيسية</button>
        </div>
      )}

      {/* Only show the order form when platform is open */}
      {accepting_orders && (
        <>
      <div className="flex items-center justify-between mb-6 overflow-x-auto pb-1">
        {steps.map((s, i) => (
          <div key={s.num} className="flex items-center flex-shrink-0">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${step >= s.num ? 'bg-primary-500 text-white shadow-md shadow-primary-200 dark:shadow-primary-900' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
              {step > s.num ? <CheckCircle size={16} /> : s.icon}
            </div>
            {i < steps.length - 1 && <div className={`w-6 h-0.5 mx-0.5 transition-all ${step > s.num ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-700'}`} />}
          </div>
        ))}
      </div>

      {/* ── Step 1: Vehicle ─────────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-900 dark:text-white">اختر نوع المركبة</h3>
          {vehicles.map(v => {
            // Compute the surcharge for this vehicle type from live pricing settings
            const surcharge = v.type === 'tuk_tuk' ? (pricingSettings['tuk_tuk_surcharge'] || 0)
                            : v.type === 'car'     ? (pricingSettings['car_surcharge']     || 0)
                            : 0; // motorcycle = no surcharge
            return (
              <button key={v.id} onClick={() => setForm({ ...form, vehicle_id: v.id })}
                className={`w-full card flex items-center gap-4 text-right transition-all ${form.vehicle_id === v.id ? 'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900/20' : ''}`}>
                <span className="text-3xl">{v.icon}</span>
                <div className="flex-1">
                  <p className="font-bold text-gray-900 dark:text-white">{v.name_ar}</p>
                  <p className="text-sm text-gray-500">{v.name_en}</p>
                  {/* Surcharge badge */}
                  {surcharge > 0 ? (
                    <span className="inline-flex items-center gap-1 mt-1 text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 px-2 py-0.5 rounded-full">
                      + {surcharge} ج.م رسوم إضافية على سعر المنطقة
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 mt-1 text-xs font-semibold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 px-2 py-0.5 rounded-full">
                      ✓ لا رسوم إضافية على المركبة
                    </span>
                  )}
                </div>
                {form.vehicle_id === v.id && <CheckCircle size={20} className="text-primary-500 flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Step 2: Locations (dual concept) ───────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">محطات التوصيل</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">لكل محطة: اختر المنطقة الأقرب لك (للتسعير)، ثم أدخل عنوانك الدقيق (للتوصيل الفعلي)</p>
          </div>

          {/* Driver start point badge */}
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl text-sm">
            <Navigation size={15} className="text-blue-500 flex-shrink-0" />
            <span className="text-blue-700 dark:text-blue-300 font-medium">نقطة انطلاق السائق: <strong>السنطة</strong></span>
          </div>

          {form.locations.map((loc, idx) => {
            const selectedLocation = locations.find(l => l.id === loc.location_id);
            return (
              <div key={idx} className="card space-y-3 border border-gray-200 dark:border-gray-700">
                {/* Stop header */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
                    📍 محطة {idx + 1}
                  </span>
                  {form.locations.length > 1 && (
                    <button onClick={() => removeStop(idx)} className="text-red-400 hover:text-red-600 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                {/* A — Pricing area */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                    <Tag size={11} /> المنطقة (لتحديد السعر)
                  </label>
                  <select
                    value={loc.location_id}
                    onChange={e => updateStop(idx, 'location_id', e.target.value)}
                    className="input-field text-sm"
                  >
                    <option value="">اختر المنطقة الأقرب لك...</option>
                    {locations.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.name_ar} — {l.delivery_price} ج.م
                      </option>
                    ))}
                  </select>
                  {selectedLocation && (
                    <p className="text-xs text-primary-600 dark:text-primary-400 mt-1 font-semibold">
                      💰 سعر التوصيل لهذه المنطقة: {selectedLocation.delivery_price} ج.م
                    </p>
                  )}
                </div>

                {/* B — Actual delivery address */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                    <Home size={11} /> العنوان التفصيلي (للسائق)
                  </label>
                  <input
                    value={loc.custom_address}
                    onChange={e => updateStop(idx, 'custom_address', e.target.value)}
                    className="input-field text-sm"
                    placeholder="الشارع، المبنى، أقرب معلم..."
                  />
                  <p className="text-[10px] text-gray-400 mt-0.5">هذا هو العنوان الفعلي الذي سيتوجه إليه السائق</p>
                </div>
              </div>
            );
          })}

          {form.locations.length < 5 && (
            <button onClick={addStop}
              className="w-full py-3 border-2 border-dashed border-primary-300 dark:border-primary-700 rounded-xl text-primary-600 dark:text-primary-400 font-semibold flex items-center justify-center gap-2 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors">
              <Plus size={18} /> إضافة محطة أخرى
            </button>
          )}

          {/* Live price estimate */}
          {form.locations.some(l => l.location_id) && (
            <div className="card bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800">
              <p className="text-sm font-semibold text-primary-700 dark:text-primary-300 mb-2 flex items-center gap-1">
                <Info size={14} /> تقدير أولي لرسوم التوصيل
              </p>
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
                  <span className="text-primary-600">
                    {form.locations.reduce((s, l) => s + locationPrice(l.location_id), 0).toFixed(2)} ج.م
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Step 3: Number of Places (NEW) ─────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
              <Store size={18} className="text-primary-500" /> كم مكاناً يحتاج السائق زيارته؟
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              حدد عدد الأماكن التي يحتاج السائق الذهاب إليها للشراء أو الاستلام
            </p>
          </div>

          {/* Places option cards */}
          <div className="space-y-2">
            {placeOptions.length === 0 && (
              <div className="card text-center py-6 text-gray-400 text-sm">جاري التحميل...</div>
            )}
            {placeOptions.map(option => {
              const price = parseFloat(option.price);
              const isSelected = form._selected_option_id === option.id;
              return (
                <button
                  key={option.id}
                  onClick={() => selectPlaces(option)}
                  className={`w-full card flex items-center gap-4 text-right transition-all duration-200 ${
                    isSelected
                      ? 'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-md'
                      : 'hover:border-primary-200 dark:hover:border-primary-800'
                  }`}
                >
                  <span className="leading-none flex-shrink-0">{buildHomeIcons(option.min_places, option.is_open_ended)}</span>
                  <div className="flex-1 text-right">
                    <p className="font-bold text-gray-900 dark:text-white">{option.label_ar}</p>
                    <p className="text-sm text-primary-600 dark:text-primary-400 font-semibold mt-0.5">
                      {price === 0 ? 'بدون رسوم إضافية' : `+ ${price} ج.م`}
                    </p>
                  </div>
                  {isSelected && <CheckCircle size={20} className="text-primary-500 flex-shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Dynamic place details */}
          {form.num_places !== null && (
            <div className="space-y-3 pt-2">
              <h4 className="font-semibold text-gray-900 dark:text-white text-sm flex items-center gap-2">
                <Info size={14} className="text-primary-500" />
                تفاصيل الأماكن
              </h4>

              {form.place_details.map((place, idx) => (
                <div key={idx} className="card space-y-2 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
                      🏪 مكان {idx + 1}
                    </span>
                    {/* Show remove only for open-ended mode when more than min_places inputs */}
                    {isOpenEnded && form.place_details.length > (selectedPlacesOption?.min_places || 1) && (
                      <button onClick={() => removePlaceDetail(idx)} className="text-red-400 hover:text-red-600 transition-colors">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                      اسم المكان / المحل
                    </label>
                    <input
                      value={place.name}
                      onChange={e => updatePlaceDetail(idx, 'name', e.target.value)}
                      className="input-field text-sm"
                      placeholder="مثال: سوبرماركت النيل، صيدلية الشفاء..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                      ما يحتاج السائق شراؤه / أخذه
                    </label>
                    <textarea
                      value={place.description}
                      onChange={e => updatePlaceDetail(idx, 'description', e.target.value)}
                      className="input-field text-sm"
                      rows={2}
                      placeholder="اكتب المنتجات أو الأشياء المطلوبة من هذا المكان..."
                    />
                  </div>
                </div>
              ))}

              {/* Add more button — only for open-ended mode */}
              {isOpenEnded && (
                <button
                  onClick={addPlaceDetail}
                  className="w-full py-3 border-2 border-dashed border-primary-300 dark:border-primary-700 rounded-xl text-primary-600 dark:text-primary-400 font-semibold flex items-center justify-center gap-2 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                >
                  <Plus size={18} /> إضافة مكان آخر
                </button>
              )}

              {/* Places fee summary */}
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

      {/* ── Step 4: Service type ────────────────────────────────────────────── */}
      {step === 4 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-900 dark:text-white">نوع الخدمة</h3>

          {/* Ready items */}
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

          {/* Driver purchase */}
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

          {form.service_type === 'driver_purchase' && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-gray-900 dark:text-white">المنتجات المطلوبة</h4>
                <button onClick={addItem} className="text-sm text-primary-600 flex items-center gap-1"><Plus size={14} /> إضافة</button>
              </div>
              {form.items.map((item, idx) => (
                <div key={idx} className="card mb-2 space-y-2">
                  <div className="flex gap-2">
                    <input value={item.name} onChange={e => updateItem(idx, 'name', e.target.value)} className="input-field flex-1" placeholder="اسم المنتج" />
                    <button onClick={() => removeItem(idx)} className="text-red-500 p-2"><Trash2 size={16} /></button>
                  </div>
                  <div className="flex gap-2">
                    <input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value))} className="input-field w-20" placeholder="الكمية" />
                    <input value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} className="input-field w-24" placeholder="الوحدة" />
                    <input type="number" value={item.price} onChange={e => updateItem(idx, 'price', parseFloat(e.target.value))} className="input-field w-24" placeholder="السعر" />
                  </div>
                </div>
              ))}
              {form.items.length === 0 && <p className="text-sm text-gray-400 text-center py-4">يمكنك إضافة المنتجات لاحقاً أيضاً</p>}
            </div>
          )}
        </div>
      )}

      {/* ── Step 5: Contact details ─────────────────────────────────────────── */}
      {step === 5 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">تفاصيل التواصل</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">رقم الهاتف للتواصل</label>
            <input value={form.customer_phone} onChange={e => setForm({ ...form, customer_phone: e.target.value })}
              className="input-field" placeholder="01XXXXXXXXX" required />
          </div>
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

      {/* ── Step 6: Review ─────────────────────────────────────────────────── */}
      {step === 6 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">مراجعة الطلب</h3>

          {/* Driver start point */}
          <div className="card flex items-center gap-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
            <Navigation size={18} className="text-blue-500 flex-shrink-0" />
            <div>
              <p className="text-xs text-blue-500 font-medium">نقطة انطلاق السائق</p>
              <p className="font-bold text-blue-700 dark:text-blue-300">السنطة</p>
            </div>
          </div>

          {/* Delivery stops */}
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

          {/* Places summary */}
          {selectedPlacesOption && (
            <div className="card space-y-2">
              <h4 className="font-semibold text-gray-800 dark:text-white text-sm border-b border-gray-100 dark:border-gray-700 pb-2 flex items-center gap-2">
                <Store size={14} className="text-primary-500" /> عدد الأماكن للشراء
              </h4>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  <span className="inline-flex items-center gap-2 align-middle">
                    {buildHomeIcons(selectedPlacesOption.min_places, selectedPlacesOption.is_open_ended)}
                    {selectedPlacesOption.label_ar}
                  </span>
                </span>
                <span className="text-sm font-bold text-primary-600">
                  {form.places_fee === 0 ? 'بدون رسوم إضافية' : `+ ${form.places_fee} ج.م`}
                </span>
              </div>
              {form.place_details.length > 0 && (
                <div className="space-y-1 mt-1">
                  {form.place_details.map((p, i) => (
                    <p key={i} className="text-xs text-gray-500 dark:text-gray-400">
                      🏪 <span className="font-medium text-gray-700 dark:text-gray-300">{p.name || `مكان ${i + 1}`}</span>
                      {p.description && ` — ${p.description}`}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Pricing breakdown */}
          {pricing ? (
            <div className="card space-y-2">
              <h4 className="font-semibold text-gray-800 dark:text-white text-sm border-b border-gray-100 dark:border-gray-700 pb-2">تفصيل الأسعار</h4>

              {/* Per-location delivery fee breakdown */}
              {pricing.locationBreakdown && pricing.locationBreakdown.map(loc => (
                <div key={loc.id} className="flex justify-between text-sm">
                  <span className="text-gray-500">توصيل ({loc.name_ar})</span>
                  <span className="font-semibold">{loc.delivery_price} ج.م</span>
                </div>
              ))}

              {/* Vehicle surcharge row — only shown when non-zero */}
              {pricing.vehicleSurcharge > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 flex items-center gap-1">
                    🚗 رسوم المركبة
                  </span>
                  <span className="font-semibold">{pricing.vehicleSurcharge} ج.م</span>
                </div>
              )}

              <div className="flex justify-between text-sm">
                <span className="text-gray-500">رسوم الخدمة</span>
                <span className="font-semibold">{pricing.serviceFee} ج.م</span>
              </div>

              {/* Places fee line */}
              {pricing.placesFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 flex items-center gap-1">
                    <Store size={11} /> رسوم عدد الأماكن ({selectedPlacesOption?.label_ar})
                  </span>
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

      {/* ── Navigation buttons ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mt-6">
        {step > 1 ? (
          <button onClick={() => setStep(step - 1)} className="btn-secondary flex items-center gap-1">
            <ChevronRight size={18} /> السابق
          </button>
        ) : <div />}

        {step < 6 ? (
          <button onClick={handleNext} className="btn-primary flex items-center gap-1">
            التالي <ChevronLeft size={18} />
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={loading || !pricing} className="btn-primary flex items-center gap-2 disabled:opacity-60">
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
