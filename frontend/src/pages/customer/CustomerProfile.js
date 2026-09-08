import React, { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { User, Phone, Mail, MapPin, Save, Camera, Trash2, Lock } from 'lucide-react';
import toast from 'react-hot-toast';

// Use relative URL — React proxy forwards /uploads/* to backend automatically
const getAvatarSrc = (avatarUrl) => {
  if (!avatarUrl) return null;
  if (avatarUrl.startsWith('http')) return avatarUrl;
  return avatarUrl; // relative e.g. /uploads/avatars/xxx.jpg
};

export default function CustomerProfile() {
  const { user, setUser } = useAuth();
  const [profile, setProfile]     = useState(null);
  const [form, setForm]           = useState({ name: '', phone: '', email: '', default_address: '' });
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [pwForm, setPwForm]       = useState({ next: '', confirm: '' });
  const [pwSaving, setPwSaving]   = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/customers/profile'),
      api.get('/users/me'),
    ]).then(([profileRes, userRes]) => {
      const p = profileRes.data;
      setProfile(p);
      setForm({
        name:            userRes.data.name    || '',
        phone:           userRes.data.phone   || '',
        email:           p.email              || '',
        default_address: p.default_address    || '',
      });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // ── Save all editable fields ─────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.name.trim())  { toast.error('الاسم مطلوب'); return; }
    if (!form.phone.trim()) { toast.error('رقم الهاتف مطلوب'); return; }
    setSaving(true);
    try {
      // 1. Update name + phone on users table
      const userRes = await api.put('/users/profile', { name: form.name, phone: form.phone });
      // 2. Update email + address on customers table
      await api.put('/customers/profile', {
        name:            form.name,
        email:           form.email || null,
        default_address: form.default_address || null,
        addresses:       profile?.addresses || [],
      });
      const updatedUser = { ...user, name: userRes.data.user.name, phone: userRes.data.user.phone };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      toast.success('✅ تم حفظ التغييرات');
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (pwForm.next.length < 6)  { toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return; }
    if (pwForm.next !== pwForm.confirm) { toast.error('كلمة المرور الجديدة غير متطابقة'); return; }
    setPwSaving(true);
    try {
      await api.put('/users/change-password', { new_password: pwForm.next });
      toast.success('✅ تم تغيير كلمة المرور بنجاح');
      setPwForm({ next: '', confirm: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل تغيير كلمة المرور');
    } finally {
      setPwSaving(false);
    }
  };

  // ── Avatar upload ────────────────────────────────────────────────────────────
  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('avatar', file);
    try {
      const res = await api.post('/users/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const updatedUser = { ...user, avatar_url: res.data.avatar_url };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      toast.success('✅ تم رفع الصورة');
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل رفع الصورة');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user?.avatar_url) return;
    try {
      await api.delete('/users/avatar');
      const updatedUser = { ...user, avatar_url: null };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      toast.success('تم حذف الصورة');
    } catch {
      toast.error('فشل حذف الصورة');
    }
  };

  if (loading) return (
    <div className="card text-center py-12">
      <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
    </div>
  );
  if (!profile) return (
    <div className="card text-center py-12 text-gray-500">لم يتم العثور على الملف الشخصي</div>
  );

  const avatarSrc = getAvatarSrc(user?.avatar_url);

  return (
    <div className="animate-fade-in space-y-4">

      {/* ── Avatar + name header ─────────────────────────────────────────── */}
      <div className="card text-center">
        <div className="relative w-28 h-28 mx-auto mb-4">
          {avatarSrc ? (
            <img
              src={avatarSrc}
              alt="صورة المستخدم"
              className="w-28 h-28 rounded-full object-cover border-4 border-primary-200 dark:border-primary-800 shadow-lg"
              onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
            />
          ) : null}
          <div
            className="w-28 h-28 bg-primary-100 dark:bg-primary-900/30 rounded-full items-center justify-center border-4 border-primary-200 dark:border-primary-800 shadow-lg"
            style={{ display: avatarSrc ? 'none' : 'flex' }}
          >
            <User size={44} className="text-primary-500" />
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="absolute bottom-0 right-0 w-9 h-9 bg-primary-500 hover:bg-primary-600 text-white rounded-full flex items-center justify-center shadow-lg transition-colors disabled:opacity-60"
          >
            {uploading
              ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <Camera size={16} />}
          </button>
          {avatarSrc && !uploading && (
            <button
              onClick={handleRemoveAvatar}
              className="absolute bottom-0 left-0 w-9 h-9 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg transition-colors"
            >
              <Trash2 size={14} />
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">{form.name}</h2>
        <p className="text-sm text-gray-500 mt-0.5">{form.phone}</p>
        <p className="text-xs text-gray-400 mt-3">اضغط 📷 لتغيير الصورة — JPG، PNG، WEBP (حتى 5 ميجا)</p>
      </div>

      {/* ── All editable fields ──────────────────────────────────────────── */}
      <div className="card space-y-4">
        <h3 className="font-bold text-gray-900 dark:text-white">بيانات الحساب</h3>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            الاسم الكامل <span className="text-primary-500">*</span>
          </label>
          <div className="relative">
            <User size={17} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input-field pr-10"
              placeholder="محمد أحمد"
            />
          </div>
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            رقم الهاتف <span className="text-primary-500">*</span>
          </label>
          <div className="relative">
            <Phone size={17} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="input-field pr-10"
              placeholder="01XXXXXXXXX"
              dir="ltr"
            />
          </div>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            ⚠ تأكد من الرقم — ستحتاجه عند تسجيل الدخول
          </p>
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            البريد الإلكتروني
          </label>
          <div className="relative">
            <Mail size={17} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input-field pr-10"
              placeholder="example@email.com"
              type="email"
            />
          </div>
        </div>

        {/* Default address */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            العنوان الافتراضي
          </label>
          <div className="relative">
            <MapPin size={17} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={form.default_address}
              onChange={(e) => setForm({ ...form, default_address: e.target.value })}
              className="input-field pr-10"
              placeholder="مثال: طنطا، شارع النيل"
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          {saving
            ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <><Save size={17} /> حفظ التغييرات</>}
        </button>
      </div>
      {/* ── Change password ─────────────────────────────────────────────── */}
      <div className="card space-y-4">
        <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Lock size={17} className="text-primary-500" /> تغيير كلمة المرور
        </h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">كلمة المرور الجديدة</label>
          <div className="relative">
            <Lock size={17} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="password" value={pwForm.next} onChange={e => setPwForm({ ...pwForm, next: e.target.value })}
              className="input-field pr-10" placeholder="6 أحرف على الأقل" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">تأكيد كلمة المرور الجديدة</label>
          <div className="relative">
            <Lock size={17} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="password" value={pwForm.confirm} onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })}
              className="input-field pr-10" placeholder="••••••" />
          </div>
        </div>
        <button onClick={handleChangePassword} disabled={pwSaving}
          className="btn-primary w-full flex items-center justify-center gap-2">
          {pwSaving
            ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <><Lock size={17} /> تغيير كلمة المرور</>}
        </button>
      </div>

    </div>
  );
}
