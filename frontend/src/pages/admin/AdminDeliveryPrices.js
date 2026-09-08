import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { Trash2, Plus, Route, ArrowLeftRight, Save } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminDeliveryPrices() {
  const [prices, setPrices]       = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [form, setForm] = useState({ from_location_id: '', to_location_id: '', price: '' });

  const fetchAll = () => {
    Promise.all([
      api.get('/delivery-prices/admin'),
      api.get('/locations')
    ]).then(([pr, lr]) => {
      setPrices(pr.data);
      setLocations(lr.data);
    }).catch(() => toast.error('فشل التحميل'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.from_location_id || !form.to_location_id || form.price === '') {
      toast.error('اختر موقع الانطلاق والوصول وأدخل السعر');
      return;
    }
    if (form.from_location_id === form.to_location_id) {
      toast.error('نقطة الانطلاق والوصول لا يمكن أن تكونا نفس الموقع');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/delivery-prices', form);
      setPrices(prev => {
        // upsert
        const exists = prev.find(p => p.id === res.data.id);
        if (exists) return prev.map(p => p.id === res.data.id ? { ...p, ...res.data } : p);
        return [res.data, ...prev];
      });
      setForm({ from_location_id: '', to_location_id: '', price: '' });
      toast.success('تم إضافة/تحديث المسار');
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('حذف هذا المسار؟')) return;
    try {
      await api.delete(`/delivery-prices/${id}`);
      setPrices(prev => prev.filter(p => p.id !== id));
      toast.success('تم الحذف');
    } catch {
      toast.error('فشل الحذف');
    }
  };

  const handlePriceChange = async (id, newPrice) => {
    try {
      await api.put(`/delivery-prices/${id}`, { price: parseFloat(newPrice) });
      setPrices(prev => prev.map(p => p.id === id ? { ...p, price: newPrice } : p));
      toast.success('تم تحديث السعر');
    } catch {
      toast.error('فشل التحديث');
    }
  };

  const toggleActive = async (item) => {
    try {
      await api.put(`/delivery-prices/${item.id}`, { is_active: !item.is_active });
      setPrices(prev => prev.map(p => p.id === item.id ? { ...p, is_active: !p.is_active } : p));
    } catch {
      toast.error('فشل التحديث');
    }
  };

  if (loading) return (
    <div className="card text-center py-12">
      <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
    </div>
  );

  const activeLocations = locations.filter(l => l.is_active !== false);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center gap-3">
        <Route size={24} className="text-primary-500" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">أسعار التوصيل بين المناطق</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">حدد سعر التوصيل لكل مسار (من منطقة → إلى منطقة)</p>
        </div>
      </div>

      {/* ── Add form ─────────────────────────────────────────────────────── */}
      <form onSubmit={handleAdd} className="card border-2 border-primary-200 dark:border-primary-800 space-y-4">
        <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Plus size={18} className="text-primary-500" /> إضافة مسار جديد
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">من (نقطة الاستلام)</label>
            <select
              value={form.from_location_id}
              onChange={e => setForm({ ...form, from_location_id: e.target.value })}
              className="input-field"
            >
              <option value="">اختر المنطقة</option>
              {activeLocations.map(l => (
                <option key={l.id} value={l.id}>{l.name_ar}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <ArrowLeftRight size={14} className="inline ml-1" />
              إلى (نقطة التسليم)
            </label>
            <select
              value={form.to_location_id}
              onChange={e => setForm({ ...form, to_location_id: e.target.value })}
              className="input-field"
            >
              <option value="">اختر المنطقة</option>
              {activeLocations.map(l => (
                <option key={l.id} value={l.id}>{l.name_ar}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">السعر (ج.م)</label>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                step="0.5"
                value={form.price}
                onChange={e => setForm({ ...form, price: e.target.value })}
                className="input-field flex-1"
                placeholder="0.00"
              />
              <button type="submit" disabled={saving} className="btn-primary flex items-center gap-1 px-4 whitespace-nowrap">
                {saving
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <><Save size={15} /> حفظ</>}
              </button>
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-400">
          💡 إذا كان المسار موجوداً بالفعل سيتم تحديث سعره. السعر يُطبَّق على الاتجاهين تلقائياً (أ→ب = ب→أ).
        </p>
      </form>

      {/* ── Prices table ─────────────────────────────────────────────────── */}
      {prices.length === 0 ? (
        <div className="card text-center py-10">
          <Route size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500">لا توجد مسارات بعد — أضف أول مسار من النموذج أعلاه</p>
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm" style={{ minWidth: '580px' }}>
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">من</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">إلى</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">السعر (ج.م)</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-300">الحالة</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-300">حذف</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {prices.map(p => (
                <tr key={p.id} className={`transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/30 ${!p.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                    📍 {p.from_name_ar}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    🏁 {p.to_name_ar}
                  </td>
                  <td className="px-4 py-3">
                    <PriceCell price={p.price} onSave={(v) => handlePriceChange(p.id, v)} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleActive(p)}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                        p.is_active
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200'
                      }`}
                    >
                      {p.is_active ? 'فعال' : 'متوقف'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => handleDelete(p.id)} className="text-red-400 hover:text-red-600 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Inline-editable price cell
function PriceCell({ price, onSave }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(price);

  const commit = () => {
    setEditing(false);
    if (parseFloat(val) !== parseFloat(price)) onSave(val);
  };

  if (editing) {
    return (
      <input
        type="number" min="0" step="0.5"
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
        className="input-field py-1 w-28 text-sm"
        autoFocus
      />
    );
  }
  return (
    <button
      onClick={() => setEditing(true)}
      className="font-bold text-primary-600 dark:text-primary-400 hover:underline"
    >
      {parseFloat(price).toFixed(2)} ج.م
    </button>
  );
}
