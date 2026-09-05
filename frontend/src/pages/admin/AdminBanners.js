import React, { useEffect, useState } from 'react';
import { ImagePlus, Trash2, Power, Upload } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';

const apiAsset = (url) => `${(process.env.REACT_APP_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '')}${url}`;

export default function AdminBanners() {
  const [banners, setBanners] = useState([]);
  const [form, setForm] = useState({ title: '', audience: 'both', sort_order: 0, image: null });
  const [saving, setSaving] = useState(false);

  const load = () => api.get('/admin/banners').then(response => setBanners(response.data)).catch(() => toast.error('فشل تحميل الإعلانات'));
  useEffect(() => { load(); }, []);

  const addBanner = async (event) => {
    event.preventDefault();
    if (!form.image) return toast.error('اختر صورة للإعلان');
    const data = new FormData();
    data.append('image', form.image);
    data.append('title', form.title);
    data.append('audience', form.audience);
    data.append('sort_order', form.sort_order);
    setSaving(true);
    try {
      const response = await api.post('/admin/banners', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      setBanners([...banners, response.data]);
      setForm({ title: '', audience: 'both', sort_order: 0, image: null });
      event.target.reset();
      toast.success('تمت إضافة الإعلان');
    } catch (error) { toast.error(error.response?.data?.message || 'فشل رفع الإعلان'); }
    finally { setSaving(false); }
  };

  const toggle = async (banner) => {
    try {
      await api.put(`/admin/banners/${banner.id}`, { is_active: !banner.is_active });
      setBanners(banners.map(item => item.id === banner.id ? { ...item, is_active: !item.is_active } : item));
    } catch { toast.error('فشل تغيير حالة الإعلان'); }
  };

  const remove = async (banner) => {
    if (!window.confirm('هل تريد حذف هذا الإعلان؟')) return;
    try { await api.delete(`/admin/banners/${banner.id}`); setBanners(banners.filter(item => item.id !== banner.id)); toast.success('تم حذف الإعلان'); }
    catch { toast.error('فشل حذف الإعلان'); }
  };

  return (
    <div className="animate-fade-in space-y-4">
      <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">إعلانات التطبيق</h1><p className="text-sm text-gray-500 mt-1">تحكم في الصور الظاهرة أعلى تطبيق العميل والسائق</p></div>
      <form onSubmit={addBanner} className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input className="input-field" placeholder="عنوان اختياري" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
        <select className="input-field" value={form.audience} onChange={e => setForm({ ...form, audience: e.target.value })}><option value="both">العميل والسائق</option><option value="customer">العميل فقط</option><option value="driver">السائق فقط</option></select>
        <input className="input-field" type="number" placeholder="الترتيب" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: e.target.value })} />
        <label className="input-field flex cursor-pointer items-center gap-2"><ImagePlus size={18} className="text-accent" /><span className="truncate">{form.image?.name || 'اختر صورة'}</span><input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => setForm({ ...form, image: e.target.files[0] })} /></label>
        <button className="btn-primary gap-2 sm:col-span-2 lg:col-span-4" disabled={saving}><Upload size={17} /> {saving ? 'جاري الرفع...' : 'رفع الإعلان'}</button>
      </form>
      <div className="grid gap-4 sm:grid-cols-2">
        {banners.map(banner => <article key={banner.id} className="card overflow-hidden p-0"><div className="aspect-[16/7] w-full bg-[#05142B]"><img src={apiAsset(banner.image_url)} alt={banner.title || 'إعلان'} className="h-full w-full object-contain p-1" /></div><div className="flex items-center justify-between gap-2 p-3"><div><p className="font-bold text-gray-900 dark:text-white">{banner.title || 'بدون عنوان'}</p><p className="text-xs text-gray-500">{banner.audience === 'both' ? 'العميل والسائق' : banner.audience === 'customer' ? 'العميل' : 'السائق'}</p></div><div className="flex gap-1"><button type="button" onClick={() => toggle(banner)} className="btn-secondary p-2" title="تفعيل أو إيقاف"><Power size={16} className={banner.is_active ? 'text-accent' : 'text-gray-400'} /></button><button type="button" onClick={() => remove(banner)} className="btn-danger p-2" title="حذف"><Trash2 size={16} /></button></div></div></article>)}
      </div>
      {!banners.length && <div className="card py-12 text-center text-sm text-gray-500">لا توجد إعلانات مضافة بعد</div>}
    </div>
  );
}