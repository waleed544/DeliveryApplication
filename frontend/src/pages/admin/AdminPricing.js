import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { DollarSign, Save, Percent, Store, Plus, Power } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminPricing() {
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [promoCodes, setPromoCodes] = useState([]);
  const [promo, setPromo] = useState({ code: '', discount_value: '', max_uses: '', min_order_amount: '', expires_at: '' });
  const [promoSaving, setPromoSaving] = useState(false);

  useEffect(() => {
    api.get('/pricing').then(r => { setSettings(r.data); setLoading(false); }).catch(() => setLoading(false));
    api.get('/settings/promo-codes').then(r => setPromoCodes(r.data)).catch(() => {});
  }, []);

  const updateSetting = (key, value) => {
    setSettings(settings.map(s => s.key === key ? { ...s, value: parseFloat(value) } : s));
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      for (const s of settings) {
        await api.put(`/pricing/${s.key}`, { value: s.value, description: s.description });
      }
      toast.success('تم حفظ جميع الأسعار');
    } catch {
      toast.error('فشل الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const addPromoCode = async (e) => {
    e.preventDefault();
    setPromoSaving(true);
    try {
      const response = await api.post('/settings/promo-codes', promo);
      setPromoCodes([response.data, ...promoCodes]);
      setPromo({ code: '', discount_value: '', max_uses: '', min_order_amount: '', expires_at: '' });
      toast.success('تمت إضافة كود الخصم');
    } catch (error) {
      toast.error(error.response?.data?.message || 'فشل إضافة كود الخصم');
    } finally {
      setPromoSaving(false);
    }
  };

  const togglePromo = async (item) => {
    try {
      await api.put(`/settings/promo-codes/${item.id}`, { is_active: !item.is_active });
      setPromoCodes(promoCodes.map(code => code.id === item.id ? { ...code, is_active: !code.is_active } : code));
    } catch {
      toast.error('فشل تحديث كود الخصم');
    }
  };

  // Legacy keys that are no longer used (system now uses per-location pricing)
  const HIDDEN_KEYS = ['motorcycle_base', 'tuk_tuk_base', 'car_base', 'additional_location'];

  const labels = {
    tuk_tuk_surcharge: 'توك توك — رسوم إضافية (فوق سعر المنطقة)',
    car_surcharge:     'سيارة — رسوم إضافية (فوق سعر المنطقة)',
    ready_items_fee:   'رسوم الطلبات الجاهزة',
    driver_purchase_fee: 'رسوم شراء السائق',
    driver_percentage: 'نسبة السائق %',
    owner_percentage:  'نسبة المالك %',
    min_order_amount:  'الحد الأدنى للطلب (يُستخدم عند عدم اختيار منطقة)',
    places_1:          'مكان واحد (1 مكان)',
    places_2:          'مكانان (2 أماكن)',
    places_3:          'ثلاثة أماكن (3)',
    places_4:          'أربعة أماكن (4)',
    places_5_plus:     'خمسة أماكن فأكثر (5+)',
  };

  const placesKeys     = ['places_1', 'places_2', 'places_3', 'places_4', 'places_5_plus'];
  const surchargeKeys  = ['tuk_tuk_surcharge', 'car_surcharge'];
  // Filter out hidden legacy keys from all groups
  const visibleSettings   = settings.filter(s => !HIDDEN_KEYS.includes(s.key));
  const generalSettings   = visibleSettings.filter(s => !placesKeys.includes(s.key) && !surchargeKeys.includes(s.key));
  const surchargeSettings = visibleSettings.filter(s =>  surchargeKeys.includes(s.key));

  if (loading) return <div className="card text-center py-12"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>;

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">إدارة الأسعار</h1>
        <button onClick={saveAll} disabled={saving} className="btn-primary flex items-center gap-2">
          {saving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Save size={18} /> حفظ الكل</>}
        </button>
      </div>

      {/* ── Vehicle surcharges ───────────────────────────────────────────── */}
      {surchargeSettings.length > 0 && (
        <div className="card border-2 border-amber-200 dark:border-amber-800 space-y-3">
          <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span>🚗</span> رسوم نوع المركبة
            <span className="text-xs font-normal text-gray-400 mr-auto">تُضاف فوق سعر المنطقة — الدراجة = 0 إضافة</span>
          </h2>
          <div className="grid gap-3">
            {surchargeSettings.map(s => (
              <div key={s.key}>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-medium text-gray-900 dark:text-white">{labels[s.key] || s.key}</label>
                  <span className="text-xs text-gray-400">{s.description}</span>
                </div>
                <div className="relative">
                  <input type="number" value={s.value}
                    onChange={(e) => updateSetting(s.key, e.target.value)}
                    className="input-field pr-12" />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><DollarSign size={16} /></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── General pricing settings ──────────────────────────────────── */}
      <div className="grid gap-4">
        {generalSettings.map(s => (
          <div key={s.key} className="card">
            <div className="flex items-center justify-between mb-2">
              <label className="font-medium text-gray-900 dark:text-white">{labels[s.key] || s.key}</label>
              <span className="text-xs text-gray-400">{s.description}</span>
            </div>
            <div className="relative">
              <input
                type="number"
                value={s.value}
                onChange={(e) => updateSetting(s.key, e.target.value)}
                className="input-field pr-12"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                {s.key.includes('percentage') ? <Percent size={16} /> : <DollarSign size={16} />}
              </span>
            </div>
          </div>
        ))}
      </div>

      <section className="card space-y-4">
        <div className="flex items-center gap-2">
          <Store size={20} className="text-accent" />
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white">أكواد الخصم</h2>
            <p className="text-xs text-gray-400">خصم ثابت بالجنيه المصري، وليس نسبة مئوية</p>
          </div>
        </div>
        <form onSubmit={addPromoCode} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input className="input-field" placeholder="الكود" value={promo.code} required
            onChange={e => setPromo({ ...promo, code: e.target.value.toUpperCase() })} />
          <input className="input-field" type="number" min="1" step="0.01" placeholder="الخصم بالجنيه" value={promo.discount_value} required
            onChange={e => setPromo({ ...promo, discount_value: e.target.value })} />
          <input className="input-field" type="number" min="0" placeholder="الحد الأقصى للاستخدام" value={promo.max_uses}
            onChange={e => setPromo({ ...promo, max_uses: e.target.value })} />
          <input className="input-field" type="number" min="0" step="0.01" placeholder="الحد الأدنى للطلب" value={promo.min_order_amount}
            onChange={e => setPromo({ ...promo, min_order_amount: e.target.value })} />
          <button className="btn-primary gap-2" disabled={promoSaving}><Plus size={17} /> إضافة الكود</button>
        </form>
        <div className="space-y-2">
          {promoCodes.length === 0 && <p className="text-sm text-gray-400">لا توجد أكواد خصم حتى الآن</p>}
          {promoCodes.map(item => (
            <div key={item.id} className="flex items-center justify-between gap-3 border border-gray-100 dark:border-gray-700 rounded-xl px-3 py-2">
              <div>
                <span className="font-bold text-gray-900 dark:text-white">{item.code}</span>
                <span className="text-sm text-accent mr-3">-{item.discount_value} ج.م</span>
              </div>
              <button type="button" onClick={() => togglePromo(item)} className={item.is_active ? 'btn-secondary text-xs gap-1' : 'btn-danger text-xs gap-1'}>
                <Power size={14} /> {item.is_active ? 'فعال' : 'متوقف'}
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
