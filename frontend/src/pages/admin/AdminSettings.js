import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { Power, MessageSquare, Save, AlertTriangle, CheckCircle, Shield } from 'lucide-react';
import toast from 'react-hot-toast';

const QUICK_MESSAGES = [
  'وقت الصلاة — سنعود قريباً',
  'الخدمة متوقفة مؤقتاً للصيانة',
  'خارج أوقات العمل حالياً',
  'نحن في استراحة — سنعود قريباً',
  'الخدمة غير متاحة في هذا الوقت',
];

export default function AdminSettings() {
  const [settings, setSettings] = useState({ accepting_orders: true, offline_message: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [account, setAccount] = useState({ phone: '', password: '' });
  const [accountSaving, setAccountSaving] = useState(false);

  useEffect(() => {
    api.get('/admin/settings')
      .then(r => { setSettings(r.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
    api.get('/users/me').then(r => setAccount({ phone: r.data.phone || '', password: '' })).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/admin/settings', settings);
      toast.success(settings.accepting_orders ? '✅ المنصة مفتوحة الآن' : '🔴 تم إيقاف قبول الطلبات');
    } catch {
      toast.error('فشل الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const saveAccount = async (event) => {
    event.preventDefault();
    setAccountSaving(true);
    try {
      const response = await api.put('/admin/account', account);
      setAccount({ phone: response.data.phone, password: '' });
      toast.success('تم تحديث بيانات دخول المشرف');
    } catch (error) {
      toast.error(error.response?.data?.message || 'فشل تحديث بيانات الدخول');
    } finally {
      setAccountSaving(false);
    }
  };

  if (loading) return (
    <div className="card text-center py-12">
      <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
    </div>
  );

  return (
    <div className="animate-fade-in space-y-4 max-w-lg">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">إعدادات المنصة</h1>

      {/* On/Off toggle */}
      <div className={`card border-2 transition-colors ${settings.accepting_orders ? 'border-green-300 dark:border-green-700' : 'border-red-300 dark:border-red-700'}`}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Power size={20} className={settings.accepting_orders ? 'text-green-500' : 'text-red-500'} />
            <h2 className="font-bold text-gray-900 dark:text-white">قبول الطلبات</h2>
          </div>
          {/* Toggle switch */}
          <button
            onClick={() => setSettings(s => ({ ...s, accepting_orders: !s.accepting_orders }))}
            className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${settings.accepting_orders ? 'bg-green-500' : 'bg-red-400'}`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${settings.accepting_orders ? 'translate-x-8' : 'translate-x-1'}`} />
          </button>
        </div>

        <div className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold ${settings.accepting_orders ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'}`}>
          {settings.accepting_orders
            ? <><CheckCircle size={16} /> المنصة مفتوحة — العملاء يمكنهم تقديم طلبات</>
            : <><AlertTriangle size={16} /> المنصة مغلقة — الطلبات الجديدة محجوبة</>
          }
        </div>
      </div>

      {/* Offline message */}
      {!settings.accepting_orders && (
        <div className="card space-y-3 animate-fade-in">
          <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <MessageSquare size={18} className="text-amber-500" />
            رسالة الإيقاف
          </h2>
          <p className="text-xs text-gray-500">هذه الرسالة ستُعرض للعملاء عند محاولة الطلب</p>

          {/* Quick picks */}
          <div className="flex flex-wrap gap-2">
            {QUICK_MESSAGES.map(msg => (
              <button
                key={msg}
                onClick={() => setSettings(s => ({ ...s, offline_message: msg }))}
                className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${settings.offline_message === msg ? 'bg-amber-500 text-white border-amber-500' : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
              >
                {msg}
              </button>
            ))}
          </div>

          <textarea
            rows={3}
            value={settings.offline_message}
            onChange={e => setSettings(s => ({ ...s, offline_message: e.target.value }))}
            placeholder="أو اكتب رسالتك الخاصة..."
            className="input-field resize-none"
          />

          {/* Preview */}
          {settings.offline_message && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
              <p className="text-xs text-red-500 font-semibold mb-1">معاينة ما سيراه العميل:</p>
              <p className="text-sm text-red-700 dark:text-red-300 font-medium">{settings.offline_message}</p>
            </div>
          )}
        </div>
      )}

      <button onClick={save} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
        {saving
          ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> جاري الحفظ...</>
          : <><Save size={16} /> حفظ الإعدادات</>
        }
      </button>

      <form onSubmit={saveAccount} className="card space-y-4">
        <div className="flex items-center gap-2">
          <Shield size={19} className="text-accent" />
          <div><h2 className="font-bold text-gray-900 dark:text-white">بيانات دخول المشرف</h2><p className="text-xs text-gray-500">غيّر رقم الهاتف وكلمة المرور المستخدمة للدخول</p></div>
        </div>
        <div><label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">رقم الهاتف</label><input className="input-field" type="tel" value={account.phone} required onChange={e => setAccount({ ...account, phone: e.target.value })} /></div>
        <div><label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">كلمة المرور الجديدة</label><input className="input-field" type="password" minLength="6" placeholder="اتركها فارغة للإبقاء على القديمة" value={account.password} onChange={e => setAccount({ ...account, password: e.target.value })} /></div>
        <button type="submit" disabled={accountSaving} className="btn-secondary flex w-full items-center justify-center gap-2"><Shield size={16} /> {accountSaving ? 'جاري التحديث...' : 'تحديث بيانات الدخول'}</button>
      </form>
    </div>
  );
}
