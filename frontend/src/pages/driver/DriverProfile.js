import React, { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import {
  User, Phone, Mail, Save, Camera, Trash2,
  Truck, Star, Shield, CreditCard, Award, Lock
} from 'lucide-react';
import toast from 'react-hot-toast';

// Build the image URL: use relative path so React proxy forwards to backend
const getAvatarSrc = (avatarUrl) => {
  if (!avatarUrl) return null;
  if (avatarUrl.startsWith('http')) return avatarUrl;  // external (OAuth etc.)
  return avatarUrl; // already relative e.g. /uploads/avatars/xxx.jpg
};
const InfoRow = ({ icon, label, value }) => (
  <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
    <div className="text-gray-400 flex-shrink-0">{icon}</div>
    <div className="min-w-0">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="font-medium text-gray-900 dark:text-white truncate">{value || '—'}</p>
    </div>
  </div>
);

export default function DriverProfile() {
  const { user, setUser } = useAuth();
  const [profile, setProfile] = useState(null);   // driver row + vehicle join
  const [userInfo, setUserInfo] = useState(null);  // users table row
  const [form, setForm] = useState({ name: '', phone: '' });
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [pwForm, setPwForm]       = useState({ next: '', confirm: '' });
  const [pwSaving, setPwSaving]   = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/auth/me'),
      api.get('/users/me'),
    ]).then(([meRes, userRes]) => {
      setProfile(meRes.data.profile);
      setUserInfo(userRes.data);
      setForm({ name: userRes.data.name, phone: userRes.data.phone });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // ── Save name + phone ────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('الاسم مطلوب'); return; }
    if (!form.phone.trim()) { toast.error('رقم الهاتف مطلوب'); return; }
    setSaving(true);
    try {
      const res = await api.put('/users/profile', { name: form.name, phone: form.phone });
      const updatedUser = { ...user, name: res.data.user.name, phone: res.data.user.phone };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      setUserInfo(prev => ({ ...prev, name: form.name, phone: form.phone }));
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

  const avatarSrc = getAvatarSrc(user?.avatar_url);

  return (
    <div className="animate-fade-in space-y-4">

      {/* ── Avatar + name header ─────────────────────────────────────────── */}
      <div className="card text-center">
        <div className="relative w-28 h-28 mx-auto mb-4">
          {avatarSrc ? (
            <img
              src={avatarSrc}
              alt="صورة السائق"
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
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">{userInfo?.name}</h2>
        <p className="text-sm text-gray-500 mt-0.5">{userInfo?.phone}</p>
        {profile && (
          <div className="flex items-center justify-center gap-3 mt-2 flex-wrap">
            <span className="text-xl">{profile.icon}</span>
            <span className="text-sm text-gray-600 dark:text-gray-400">{profile.name_ar}</span>
            <span className="flex items-center gap-1 text-sm text-yellow-500 font-semibold">
              <Star size={14} className="fill-yellow-400" />
              {parseFloat(profile.rating_avg || 0).toFixed(1)}
              <span className="text-gray-400 text-xs font-normal">({profile.total_ratings || 0} تقييم)</span>
            </span>
          </div>
        )}
        <p className="text-xs text-gray-400 mt-3">اضغط 📷 لتغيير الصورة — JPG، PNG، WEBP (حتى 5 ميجا)</p>
      </div>

      {/* ── Editable: name + phone ───────────────────────────────────────── */}
      <div className="card space-y-4">
        <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Shield size={17} className="text-primary-500" /> تعديل بيانات الحساب
        </h3>

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
            ⚠ تذكّر الرقم الجديد — ستحتاجه عند تسجيل الدخول
          </p>
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

      {/* ── Read-only personal info ──────────────────────────────────────── */}
      <div className="card space-y-3">
        <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <User size={17} className="text-primary-500" /> البيانات الشخصية
        </h3>
        <InfoRow icon={<Mail size={17} />}    label="البريد الإلكتروني"  value={userInfo?.email || 'غير مسجل'} />
        <InfoRow icon={<CreditCard size={17} />} label="الرقم القومي"   value={profile?.national_id} />
      </div>

      {/* ── Read-only vehicle info ───────────────────────────────────────── */}
      <div className="card space-y-3">
        <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Truck size={17} className="text-primary-500" /> بيانات المركبة
        </h3>
        <InfoRow icon={<Truck size={17} />}       label="نوع المركبة"  value={profile ? `${profile.icon} ${profile.name_ar}` : null} />
        <InfoRow icon={<CreditCard size={17} />}  label="رقم اللوحة"  value={profile?.vehicle_plate} />
      </div>

      {/* ── Read-only earnings stats ─────────────────────────────────────── */}
      <div className="card">
        <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
          <Award size={17} className="text-primary-500" /> الإحصائيات
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-primary-50 dark:bg-primary-900/20 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-primary-600">
              {parseFloat(profile?.total_earnings || 0).toFixed(0)}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">إجمالي العمولات ج.م</p>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-green-600">
              {parseFloat(profile?.unpaid_earnings || 0).toFixed(0)}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">رصيد غير مدفوع ج.م</p>
          </div>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-yellow-600 flex items-center justify-center gap-1">
              <Star size={18} className="fill-yellow-400 text-yellow-400" />
              {parseFloat(profile?.rating_avg || 0).toFixed(1)}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">متوسط التقييم</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-blue-600">{profile?.total_ratings || 0}</p>
            <p className="text-xs text-gray-500 mt-0.5">عدد التقييمات</p>
          </div>
        </div>
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
