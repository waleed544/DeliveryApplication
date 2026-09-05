import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { MapPin, Plus, Trash2, Edit3, Save, X, Navigation, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminLocations() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [form, setForm] = useState({ name_ar: '', name_en: '', delivery_price: '', sort_order: 0 });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchLocations(); }, []);

  const fetchLocations = () => {
    api.get('/locations/all')
      .then(r => { setLocations(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  // ── Add new location ──────────────────────────────────────────────────────
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.name_ar || !form.delivery_price) { toast.error('أدخل الاسم والسعر'); return; }
    setSaving(true);
    try {
      await api.post('/locations', { ...form, delivery_price: parseFloat(form.delivery_price) });
      toast.success('تم إضافة الموقع');
      setShowForm(false);
      setForm({ name_ar: '', name_en: '', delivery_price: '', sort_order: 0 });
      fetchLocations();
    } catch { toast.error('فشل الإضافة'); }
    finally { setSaving(false); }
  };

  // ── Inline edit ───────────────────────────────────────────────────────────
  const startEdit = (loc) => {
    setEditingId(loc.id);
    setEditValues({
      name_ar: loc.name_ar,
      name_en: loc.name_en,
      delivery_price: loc.delivery_price,
      sort_order: loc.sort_order,
      is_active: loc.is_active
    });
  };

  const cancelEdit = () => { setEditingId(null); setEditValues({}); };

  const saveEdit = async (id) => {
    setSaving(true);
    try {
      await api.put(`/locations/${id}`, editValues);
      toast.success('تم التحديث');
      setEditingId(null);
      fetchLocations();
    } catch { toast.error('فشل التحديث'); }
    finally { setSaving(false); }
  };

  // ── Toggle active/inactive ────────────────────────────────────────────────
  const toggleActive = async (loc) => {
    try {
      await api.put(`/locations/${loc.id}`, { ...loc, is_active: !loc.is_active });
      toast.success(loc.is_active ? 'تم إيقاف الموقع' : 'تم تفعيل الموقع');
      fetchLocations();
    } catch { toast.error('فشل التغيير'); }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const deleteLocation = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الموقع؟')) return;
    try {
      await api.delete(`/locations/${id}`);
      toast.success('تم الحذف');
      fetchLocations();
    } catch { toast.error('فشل الحذف'); }
  };

  // Total delivery price sum (informational)
  const activeCount = locations.filter(l => l.is_active).length;

  return (
    <div className="animate-fade-in space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">أسعار التوصيل</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{activeCount} منطقة فعّالة</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setForm({ name_ar: '', name_en: '', delivery_price: '', sort_order: locations.length }); }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={18} /> إضافة منطقة
        </button>
      </div>

      {/* Driver start point notice */}
      <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl">
        <Navigation size={18} className="text-blue-500 flex-shrink-0" />
        <div>
          <p className="text-sm font-bold text-blue-700 dark:text-blue-300">نقطة انطلاق السائق دائماً: السنطة 📍</p>
          <p className="text-xs text-blue-500 dark:text-blue-400">جميع رحلات التوصيل تبدأ من السنطة — الأسعار أدناه تُحسب من هذه النقطة</p>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleAdd} className="card space-y-3 border-2 border-primary-200 dark:border-primary-800">
          <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2"><Plus size={16} className="text-primary-500" /> منطقة جديدة</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">اسم المنطقة (عربي) *</label>
              <input value={form.name_ar} onChange={e => setForm({ ...form, name_ar: e.target.value })}
                className="input-field" placeholder="مثال: طنطا" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Location Name (English)</label>
              <input value={form.name_en} onChange={e => setForm({ ...form, name_en: e.target.value })}
                className="input-field" placeholder="e.g. Tanta" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">سعر التوصيل (ج.م) *</label>
              <input type="number" min="0" step="0.5" value={form.delivery_price}
                onChange={e => setForm({ ...form, delivery_price: e.target.value })}
                className="input-field" placeholder="0" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">الترتيب</label>
              <input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: parseInt(e.target.value) })}
                className="input-field" placeholder="0" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Save size={15} /> حفظ</>}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex items-center gap-2"><X size={15} /> إلغاء</button>
          </div>
        </form>
      )}

      {/* Pricing table */}
      {loading ? (
        <div className="card text-center py-12"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
                <th className="text-right px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">المنطقة</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 w-36">سعر التوصيل</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 w-24">الحالة</th>
                <th className="px-4 py-3 w-28"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {locations.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-10 text-gray-400">
                    <MapPin size={32} className="mx-auto mb-2 opacity-30" />
                    لا توجد مناطق مضافة بعد
                  </td>
                </tr>
              )}
              {locations.map(loc => (
                <tr key={loc.id} className={`transition-colors ${!loc.is_active ? 'opacity-50' : ''} hover:bg-gray-50 dark:hover:bg-gray-800/40`}>

                  {/* Name cell */}
                  <td className="px-4 py-3">
                    {editingId === loc.id ? (
                      <div className="space-y-1">
                        <input value={editValues.name_ar}
                          onChange={e => setEditValues({ ...editValues, name_ar: e.target.value })}
                          className="input-field py-1 text-sm" placeholder="اسم عربي" />
                        <input value={editValues.name_en}
                          onChange={e => setEditValues({ ...editValues, name_en: e.target.value })}
                          className="input-field py-1 text-sm" placeholder="English name" />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <MapPin size={16} className="text-primary-400 flex-shrink-0" />
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white">{loc.name_ar}</p>
                          {loc.name_en && <p className="text-xs text-gray-400">{loc.name_en}</p>}
                        </div>
                      </div>
                    )}
                  </td>

                  {/* Price cell */}
                  <td className="px-4 py-3 text-center">
                    {editingId === loc.id ? (
                      <input
                        type="number" min="0" step="0.5"
                        value={editValues.delivery_price}
                        onChange={e => setEditValues({ ...editValues, delivery_price: parseFloat(e.target.value) })}
                        className="input-field py-1 text-sm text-center w-28 mx-auto"
                      />
                    ) : (
                      <span className="inline-flex items-center gap-1 font-bold text-primary-600 dark:text-primary-400 text-base">
                        {loc.delivery_price}
                        <span className="text-xs font-normal text-gray-500">ج.م</span>
                      </span>
                    )}
                  </td>

                  {/* Status cell */}
                  <td className="px-4 py-3 text-center">
                    {editingId === loc.id ? (
                      <label className="flex items-center justify-center gap-1 cursor-pointer">
                        <input type="checkbox" checked={editValues.is_active}
                          onChange={e => setEditValues({ ...editValues, is_active: e.target.checked })}
                          className="w-4 h-4 accent-primary-500" />
                        <span className="text-xs">{editValues.is_active ? 'فعّال' : 'موقوف'}</span>
                      </label>
                    ) : (
                      <button onClick={() => toggleActive(loc)} title={loc.is_active ? 'إيقاف' : 'تفعيل'}>
                        {loc.is_active
                          ? <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full font-medium"><CheckCircle size={11} /> فعّال</span>
                          : <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-500 rounded-full font-medium">موقوف</span>
                        }
                      </button>
                    )}
                  </td>

                  {/* Actions cell */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {editingId === loc.id ? (
                        <>
                          <button onClick={() => saveEdit(loc.id)} disabled={saving}
                            className="p-1.5 rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-colors" title="حفظ">
                            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={15} />}
                          </button>
                          <button onClick={cancelEdit}
                            className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" title="إلغاء">
                            <X size={15} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(loc)}
                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors" title="تعديل">
                            <Edit3 size={15} />
                          </button>
                          <button onClick={() => deleteLocation(loc.id)}
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="حذف">
                            <Trash2 size={15} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>

            {/* Footer summary */}
            {locations.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 dark:bg-gray-800/60 border-t border-gray-200 dark:border-gray-700">
                  <td className="px-4 py-2 text-xs text-gray-400 font-medium" colSpan={4}>
                    {locations.length} منطقة إجمالاً — {activeCount} فعّالة — أسعار تبدأ من {Math.min(...locations.map(l => l.delivery_price))} ج.م
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
