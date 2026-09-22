import React, { useState } from 'react';
import { AlertTriangle, Trash2, Shield, CheckCircle, Eye, EyeOff } from 'lucide-react';
import api from '../../utils/api';

export default function DeleteAccount() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState('form'); // 'form' | 'confirm' | 'done'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (step === 'form') {
      setStep('confirm');
      return;
    }
    // step === 'confirm' — execute deletion
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/delete-account', { phone, password });
      setStep('done');
    } catch (err) {
      setError(err.response?.data?.message || 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.');
      setStep('form');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)' }}
      dir="rtl"
    >
      {/* Card */}
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 p-6 text-white text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <Trash2 size={32} />
          </div>
          <h1 className="text-2xl font-bold">حذف الحساب</h1>
          <p className="text-red-100 text-sm mt-1">بكليك — طلب حذف الحساب</p>
        </div>

        {/* Body */}
        <div className="p-6">
          {step === 'done' ? (
            /* ── Success state ── */
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle size={36} className="text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">تم حذف الحساب بنجاح</h2>
              <p className="text-gray-500 text-sm leading-relaxed">
                تم حذف حسابك وجميع بياناتك الشخصية من نظامنا بشكل نهائي. نأسف لمغادرتك!
              </p>
              <p className="text-xs text-gray-400 mt-2 bg-gray-50 rounded-xl p-3 border">
                إذا كنت بحاجة للتواصل معنا، يرجى مراسلتنا عبر البريد الإلكتروني أو وسائل التواصل الاجتماعي.
              </p>
            </div>
          ) : step === 'confirm' ? (
            /* ── Confirmation state ── */
            <div className="space-y-5">
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex gap-3">
                <AlertTriangle size={22} className="text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-red-700 text-sm">تحذير: هذا الإجراء لا يمكن التراجع عنه!</p>
                  <p className="text-red-600 text-xs mt-1 leading-relaxed">
                    سيتم حذف حسابك وجميع بياناتك الشخصية نهائياً من النظام بما في ذلك:
                  </p>
                  <ul className="text-red-600 text-xs mt-2 space-y-0.5 list-disc list-inside">
                    <li>معلوماتك الشخصية (الاسم، رقم الهاتف)</li>
                    <li>سجل طلباتك</li>
                    <li>سجل محادثاتك</li>
                    <li>أي بيانات مرتبطة بحسابك</li>
                  </ul>
                </div>
              </div>

              <div className="text-center text-sm text-gray-600 bg-gray-50 rounded-xl p-3">
                سيتم حذف الحساب المرتبط بالرقم:<br />
                <span className="font-bold text-gray-900 text-base mt-1 block">{phone}</span>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep('form')}
                  className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors"
                >
                  إلغاء، احتفظ بحسابي
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading
                    ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <><Trash2 size={16} /> نعم، احذف حسابي</>}
                </button>
              </div>
            </div>
          ) : (
            /* ── Form state ── */
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Info box */}
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex gap-3">
                <Shield size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-blue-700 text-xs leading-relaxed">
                  لتأكيد هويتك وحماية حسابك، يرجى إدخال رقم هاتفك وكلمة مرورك. سيتم حذف جميع بياناتك بشكل نهائي.
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3 flex items-center gap-2">
                  <AlertTriangle size={16} />
                  {error}
                </div>
              )}

              {/* Phone */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">رقم الهاتف</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  required
                  placeholder="01xxxxxxxxx"
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-400 transition-colors"
                  dir="ltr"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">كلمة المرور</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="••••••••"
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 pl-12 text-sm focus:outline-none focus:border-red-400 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-base transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 size={18} /> طلب حذف الحساب
              </button>

              <p className="text-center text-xs text-gray-400 leading-relaxed">
                إذا نسيت كلمة المرور، يرجى التواصل مع الدعم قبل طلب الحذف.
              </p>
            </form>
          )}
        </div>
      </div>

      {/* Footer note */}
      <p className="text-gray-500 text-xs text-center mt-6 max-w-sm">
        هذه الصفحة متاحة للعموم وفقاً لسياسة متجر جوجل بلاي لحماية حقوق المستخدمين.
      </p>
    </div>
  );
}
