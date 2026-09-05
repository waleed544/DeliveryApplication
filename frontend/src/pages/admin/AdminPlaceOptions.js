import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { Plus, Trash2, Save, X, Store, Home, Edit2, ToggleLeft, ToggleRight, ArrowUp, ArrowDown } from 'lucide-react';
import toast from 'react-hot-toast';

const emptyOption = () => ({
  label_ar: '',
  min_places: '',
  is_open_ended: false,
  price: '',
  sort_order: '',
  is_active: true,
});

// Generate home icons based on min_places and open-ended flag
const buildHomeIcons = (minPlaces, isOpenEnded) => {
  const count = Math.min(parseInt(minPlaces) || 1, 5);
  return <span className="inline-flex items-center gap-0.5 text-primary-500" aria-label={`${count} أماكن`}>
    {Array.from({ length: count }, (_, index) => <Home key={index} size={20} strokeWidth={2.2} />)}
    {isOpenEnded && <span className="text-lg font-bold leading-none">+</span>}
  </span>;
};

export default function AdminPlaceOptions() {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null); // null = not editing, 'new' = adding
  const [editForm, setEditForm] = useState(emptyOption());
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/place-options/all');
      setOptions(r.data);
    } catch {
      toast.error('فشل تحميل خيارات الأماكن');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const startEdit = (opt) => {
    setEditingId(opt.id);
    setEditForm({
      label_ar: opt.label_ar,
      min_places: opt.min_places,
      is_open_ended: opt.is_open_ended,
      price: opt.price,
      sort_order: opt.sort_order,
      is_active: opt.is_active,
    });
  };

  const startAdd = () => {
    const nextOrder = options.length > 0 ? Math.max(...options.map(o => o.sort_order)) + 1 : 1;
    setEditingId('new');
    setEditForm({ ...emptyOption(), sort_order: nextOrder, min_places: nextOrder });
  };

  const cancelEdit = () => { setEditingId(null); setEditForm(emptyOption()); };

  const saveEdit = async () => {
    if (!editForm.label_ar.trim()) { toast.error('أدخل اسم الخيار'); return; }
    if (editForm.min_places === '' || isNaN(parseInt(editForm.min_places))) { toast.error('أدخل عدد الأماكن'); return; }
    if (editForm.price === '' || isNaN(parseFloat(editForm.price))) { toast.error('أدخل السعر'); return; }

    setSaving(true);
    try {
      if (editingId === 'new') {
        await api.post('/place-options', editForm);
        toast.success('تمت إضافة الخيار');
      } else {
        await api.put(`/place-options/${editingId}`, editForm);
        toast.success('تم تحديث الخيار');
      }
      cancelEdit();
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const deleteOption = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الخيار؟')) return;
    setDeletingId(id);
    try {
      await api.delete(`/place-options/${id}`);
      toast.success('تم الحذف');
      load();
    } catch {
      toast.error('فشل الحذف');
    } finally {
      setDeletingId(null);
    }
  };

  const toggleActive = async (opt) => {
    try {
      await api.put(`/place-options/${opt.id}`, { ...opt, is_active: !opt.is_active });
      load();
    } catch {
      toast.error('فشل التحديث');
    }
  };

  const moveOrder = async (opt, direction) => {
    const newOrder = opt.sort_order + direction;
    if (newOrder < 1) return;
    try {
      await api.put(`/place-options/${opt.id}`, { ...opt, sort_order: newOrder });
      load();
    } catch {
      toast.error('فشل التحديث');
    }
  };

  if (loading) return (
    <div className="card text-center py-12">
      <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
    </div>
  );

  return (
    <div className="animate-fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Store size={22} className="text-primary-500" /> إدارة خيارات عدد الأماكن
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            الخيارات التي يراها العميل عند اختيار كم مكاناً يحتاج السائق زيارته
          </p>
        </div>
        <button onClick={startAdd} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> إضافة خيار
        </button>
      </div>

      {/* Add form */}
      {editingId === 'new' && (
        <div className="card border-2 border-primary-300 dark:border-primary-700 space-y-4">
          <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Plus size={16} className="text-primary-500" /> خيار جديد
          </h3>
          <OptionForm form={editForm} setForm={setEditForm} />
          <div className="flex gap-2 justify-end">
            <button onClick={cancelEdit} className="btn-secondary flex items-center gap-1"><X size={16} /> إلغاء</button>
            <button onClick={saveEdit} disabled={saving} className="btn-primary flex items-center gap-2">
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Save size={16} /> حفظ</>}
            </button>
          </div>
        </div>
      )}

      {/* Options list */}
      {options.length === 0 ? (
        <div className="card text-center py-12">
          <Store size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500">لا توجد خيارات بعد — أضف خياراً جديداً</p>
        </div>
      ) : (
        <div className="space-y-3">
          {options.map((opt) => (
            <div key={opt.id}>
              {/* Edit form inline */}
              {editingId === opt.id ? (
                <div className="card border-2 border-primary-300 dark:border-primary-700 space-y-4">
                  <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Edit2 size={14} className="text-primary-500" /> تعديل الخيار
                  </h3>
                  <OptionForm form={editForm} setForm={setEditForm} />
                  <div className="flex gap-2 justify-end">
                    <button onClick={cancelEdit} className="btn-secondary flex items-center gap-1"><X size={16} /> إلغاء</button>
                    <button onClick={saveEdit} disabled={saving} className="btn-primary flex items-center gap-2">
                      {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Save size={16} /> حفظ</>}
                    </button>
                  </div>
                </div>
              ) : (
                <div className={`card flex items-center gap-4 transition-all ${!opt.is_active ? 'opacity-50' : ''}`}>
                  {/* Emoji preview */}
                  <span className="text-xl flex-shrink-0 leading-none">
                    {buildHomeIcons(opt.min_places, opt.is_open_ended)}
                  </span>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 dark:text-white truncate">{opt.label_ar}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5 flex-wrap">
                      <span>🔢 {opt.min_places}{opt.is_open_ended ? '+' : ''} أماكن</span>
                      <span>💰 {parseFloat(opt.price) === 0 ? 'بدون رسوم' : `${opt.price} ج.م`}</span>
                      <span className={`px-1.5 py-0.5 rounded-full font-medium ${opt.is_open_ended ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                        {opt.is_open_ended ? 'مفتوح النهاية' : 'عدد محدد'}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded-full font-medium ${opt.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'}`}>
                        {opt.is_active ? 'مفعّل' : 'معطّل'}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* Sort order arrows */}
                    <button onClick={() => moveOrder(opt, -1)} title="رفع ترتيب" className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                      <ArrowUp size={15} />
                    </button>
                    <button onClick={() => moveOrder(opt, 1)} title="خفض ترتيب" className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                      <ArrowDown size={15} />
                    </button>
                    {/* Toggle active */}
                    <button onClick={() => toggleActive(opt)} title={opt.is_active ? 'تعطيل' : 'تفعيل'} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                      {opt.is_active
                        ? <ToggleRight size={20} className="text-green-500" />
                        : <ToggleLeft size={20} className="text-gray-400" />}
                    </button>
                    {/* Edit */}
                    <button onClick={() => startEdit(opt)} className="p-1.5 rounded-lg text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors">
                      <Edit2 size={16} />
                    </button>
                    {/* Delete */}
                    <button onClick={() => deleteOption(opt.id)} disabled={deletingId === opt.id} className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Info box */}
      <div className="card bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
        <p className="text-sm text-blue-700 dark:text-blue-300 font-medium mb-1">💡 ملاحظات</p>
        <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1 list-disc list-inside">
          <li><strong>عدد الأماكن</strong>: الرقم الذي يظهر في العد (مثال: 3 = ثلاثة أماكن)</li>
          <li><strong>مفتوح النهاية</strong>: يمكّن زر "إضافة مكان آخر" بلا حد أقصى (استخدمه لخيار 5+)</li>
          <li><strong>الترتيب</strong>: يحدد ترتيب ظهور الخيارات للعميل</li>
          <li><strong>المعطّل</strong>: لا يظهر للعميل لكن لا يُحذف من قاعدة البيانات</li>
        </ul>
      </div>
    </div>
  );
}

// ── Reusable form fields ───────────────────────────────────────────────────────
function OptionForm({ form, setForm }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {/* Label */}
      <div className="sm:col-span-2">
        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
          الاسم بالعربي *
        </label>
        <input
          value={form.label_ar}
          onChange={e => setForm({ ...form, label_ar: e.target.value })}
          className="input-field"
          placeholder="مثال: ثلاثة أماكن"
        />
      </div>

      {/* Min places */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
          عدد الأماكن * <span className="text-gray-400 font-normal">(رقم يُعرض في الأيقونات)</span>
        </label>
        <input
          type="number"
          min="1"
          value={form.min_places}
          onChange={e => setForm({ ...form, min_places: e.target.value })}
          className="input-field"
          placeholder="مثال: 3"
        />
      </div>

      {/* Price */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
          السعر الإضافي (ج.م) *
        </label>
        <input
          type="number"
          min="0"
          step="0.5"
          value={form.price}
          onChange={e => setForm({ ...form, price: e.target.value })}
          className="input-field"
          placeholder="0"
        />
      </div>

      {/* Sort order */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
          ترتيب العرض
        </label>
        <input
          type="number"
          min="1"
          value={form.sort_order}
          onChange={e => setForm({ ...form, sort_order: e.target.value })}
          className="input-field"
          placeholder="1"
        />
      </div>

      {/* Preview */}
      <div className="flex items-center justify-center bg-gray-50 dark:bg-gray-800 rounded-xl">
        <span>{buildHomeIcons(form.min_places || 1, form.is_open_ended)}</span>
        {form.is_open_ended && <span className="text-lg font-bold text-gray-500">+</span>}
      </div>

      {/* Toggles */}
      <div className="sm:col-span-2 flex items-center gap-6 pt-1">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.is_open_ended}
            onChange={e => setForm({ ...form, is_open_ended: e.target.checked })}
            className="w-4 h-4 accent-primary-500 rounded"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">مفتوح النهاية (5+ / يُضاف عدد غير محدود)</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={e => setForm({ ...form, is_active: e.target.checked })}
            className="w-4 h-4 accent-primary-500 rounded"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">مفعّل (يظهر للعميل)</span>
        </label>
      </div>
    </div>
  );
}
