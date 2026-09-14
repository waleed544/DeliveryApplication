import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { Trash2, Plus, Route, ArrowLeftRight, Save, Edit2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminDeliveryPrices() {
  const [prices, setPrices]       = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [search, setSearch]       = useState('');
  const [fromSearch, setFromSearch] = useState('');
  const [toSearch, setToSearch] = useState('');
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);
  const [form, setForm] = useState({ from_location_id: '', to_location_id: '', price: '', sort_order: '' });

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
    setSaving(true);
    try {
      const res = await api.post('/delivery-prices', form);
      setPrices(prev => {
        // upsert
        const exists = prev.find(p => p.id === res.data.id);
        if (exists) return prev.map(p => p.id === res.data.id ? { ...p, ...res.data } : p).sort((a, b) => a.sort_order - b.sort_order);
        return [res.data, ...prev].sort((a, b) => a.sort_order - b.sort_order);
      });
      setForm({ from_location_id: '', to_location_id: '', price: '', sort_order: '' });
      setFromSearch('');
      setToSearch('');
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

  const handleEditClick = (p) => {
    setForm({
      from_location_id: p.from_location_id,
      to_location_id: p.to_location_id,
      price: p.price,
      sort_order: p.sort_order
    });
    setFromSearch(p.from_name_ar);
    setToSearch(p.to_name_ar);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  const handleOrderChange = async (id, newOrder) => {
    try {
      await api.put(`/delivery-prices/${id}`, { sort_order: parseInt(newOrder, 10) });
      fetchAll(); // Fetch all to get the correct new order and shifts
      toast.success('تم تحديث الترتيب');
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

  const filteredPrices = prices.filter(p => 
    p.from_name_ar.toLowerCase().includes(search.toLowerCase()) || 
    p.to_name_ar.toLowerCase().includes(search.toLowerCase()) ||
    (p.from_name_en && p.from_name_en.toLowerCase().includes(search.toLowerCase())) ||
    (p.to_name_en && p.to_name_en.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center gap-3">
        <Route size={24} className="text-primary-500" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">أسعار التوصيل بين المناطق</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">حدد سعر التوصيل لكل مسار (من منطقة → إلى منطقة)</p>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input-field pr-10"
          placeholder="ابحث عن مسار (مثال: طنطا)..."
          autoComplete="new-password"
          autoCorrect="off"
          spellCheck="false"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
      </div>

      {/* ── Add form ─────────────────────────────────────────────────────── */}
      <form onSubmit={handleAdd} className="card border-2 border-primary-200 dark:border-primary-800 space-y-4">
        <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Plus size={18} className="text-primary-500" /> إضافة مسار جديد
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">من (نقطة الاستلام)</label>
            <div className="relative">
              <input
                type="text"
                value={fromSearch}
                onChange={e => { setFromSearch(e.target.value); setForm({ ...form, from_location_id: '' }); setFromOpen(true); }}
                onFocus={() => setFromOpen(true)}
                onBlur={() => setTimeout(() => setFromOpen(false), 150)}
                className="input-field"
                placeholder="ابحث واختر..."
                autoComplete="new-password"
                autoCorrect="off"
                spellCheck="false"
              />
              {fromOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {activeLocations.filter(l => !fromSearch || l.name_ar.toLowerCase().includes(fromSearch.toLowerCase())).length === 0 ? (
                    <p className="text-center text-sm text-gray-400 py-3">لم يتم العثور</p>
                  ) : activeLocations.filter(l => !fromSearch || l.name_ar.toLowerCase().includes(fromSearch.toLowerCase())).map(l => (
                    <button key={l.id} type="button"
                      onMouseDown={() => { setForm({ ...form, from_location_id: l.id }); setFromSearch(l.name_ar); setFromOpen(false); }}
                      className="w-full text-right px-4 py-2 text-sm hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                    >
                      {l.name_ar}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <ArrowLeftRight size={14} className="inline ml-1" />
              إلى (نقطة التسليم)
            </label>
            <div className="relative">
              <input
                type="text"
                value={toSearch}
                onChange={e => { setToSearch(e.target.value); setForm({ ...form, to_location_id: '' }); setToOpen(true); }}
                onFocus={() => setToOpen(true)}
                onBlur={() => setTimeout(() => setToOpen(false), 150)}
                className="input-field"
                placeholder="ابحث واختر..."
                autoComplete="new-password"
                autoCorrect="off"
                spellCheck="false"
              />
              {toOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {activeLocations.filter(l => !toSearch || l.name_ar.toLowerCase().includes(toSearch.toLowerCase())).length === 0 ? (
                    <p className="text-center text-sm text-gray-400 py-3">لم يتم العثور</p>
                  ) : activeLocations.filter(l => !toSearch || l.name_ar.toLowerCase().includes(toSearch.toLowerCase())).map(l => (
                    <button key={l.id} type="button"
                      onMouseDown={() => { setForm({ ...form, to_location_id: l.id }); setToSearch(l.name_ar); setToOpen(false); }}
                      className="w-full text-right px-4 py-2 text-sm hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                    >
                      {l.name_ar}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">الترتيب</label>
            <input
              type="number"
              value={form.sort_order}
              onChange={e => setForm({ ...form, sort_order: e.target.value })}
              className="input-field"
              placeholder="تلقائي (الأخير)"
            />
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
      {filteredPrices.length === 0 ? (
        <div className="card text-center py-10">
          <Route size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 font-bold text-lg">
            {search.trim() ? 'لم يتم العثور' : 'لا توجد مسارات بعد — أضف أول مسار من النموذج أعلاه'}
          </p>
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm" style={{ minWidth: '580px' }}>
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-300 w-16">الترتيب</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">من</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">إلى</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">السعر (ج.م)</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-300">الحالة</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-300">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {filteredPrices.map(p => (
                <tr key={p.id} className={`transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/30 ${!p.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 text-center">
                    <OrderCell order={p.sort_order} onSave={(v) => handleOrderChange(p.id, v)} />
                  </td>
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
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => handleEditClick(p)} className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors" title="تعديل">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(p.id)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors" title="حذف">
                        <Trash2 size={16} />
                      </button>
                    </div>
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
      className="flex items-center gap-1 font-bold text-primary-600 dark:text-primary-400 hover:text-primary-700 transition-colors group"
      title="انقر لتعديل السعر"
    >
      <span>{parseFloat(price).toFixed(2)} ج.م</span>
      <Edit2 size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

// Inline-editable order cell
function OrderCell({ order, onSave }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(order || 0);

  const commit = () => {
    setEditing(false);
    if (parseInt(val, 10) !== parseInt(order, 10)) onSave(val);
  };

  if (editing) {
    return (
      <input
        type="number"
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
        className="input-field py-1 w-16 text-center text-sm mx-auto"
        autoFocus
      />
    );
  }
  return (
    <button
      onClick={() => setEditing(true)}
      className="flex items-center justify-center gap-1 font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors group w-full"
      title="انقر لتعديل الترتيب"
    >
      <span>#{order || 0}</span>
      <Edit2 size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}
