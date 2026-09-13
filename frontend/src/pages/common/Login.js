import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Phone, Lock } from 'lucide-react';
import BrandLogo from '../../components/common/BrandLogo';
import toast from 'react-hot-toast';

export default function Login() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await login(phone, password);
      toast.success('أهلاً بك!');
      navigate(`/${data.user.role}`);
    } catch (err) {
      const status = err.response?.status;
      const msg    = err.response?.data?.message || '';
      if (status === 401) {
        toast.error('رقم الهاتف أو كلمة المرور غير صحيحة');
      } else if (status === 403 && err.response?.data?.commercial_pending) {
        toast.error('🏪 حسابك التجاري قيد المراجعة — سيتم تفعيله بعد موافقة المشرف');
      } else if (status === 403 && msg.includes('pending')) {
        toast.error('حسابك قيد المراجعة — سيتواصل معك المشرف قريباً');
      } else if (status === 403 && msg.includes('deactivated')) {
        toast.error('تم تعطيل حسابك — تواصل مع الإدارة');
      } else {
        toast.error(msg || 'فشل تسجيل الدخول');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-green-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <BrandLogo size="lg" className="mx-auto mb-4 border-white/20 shadow-[0_12px_32px_rgba(0,0,0,0.32)]" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">خدمة التوصيل</h1>
          <p className="text-gray-500 dark:text-gray-400">سجل دخولك للمتابعة</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">رقم الهاتف</label>
              <div className="relative">
                <Phone size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="input-field pr-10" placeholder="01XXXXXXXXX" required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">كلمة المرور</label>
              <div className="relative">
                <Lock size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input-field pr-10" placeholder="••••••••" required />
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'تسجيل الدخول'}
            </button>
          </form>
          <div className="mt-6 text-center">
            <p className="text-gray-500 dark:text-gray-400 text-sm">ليس لديك حساب؟ <Link to="/register" className="text-primary-600 dark:text-primary-400 font-semibold hover:underline">إنشاء حساب</Link></p>
          </div>
        </div>
      </div>
    </div>
  );
}
