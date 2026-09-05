import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { Phone, Lock, User, MapPin } from 'lucide-react';
import BrandLogo from '../../components/common/BrandLogo';
import toast from 'react-hot-toast';

export default function Register() {
  const [role, setRole] = useState('customer');
  const [loading, setLoading] = useState(false);
  const { setUser } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '', phone: '', password: '', address: '',
    vehicle_id: '', vehicle_plate: '', national_id: ''
  });
  const [vehicles, setVehicles] = useState([]);

  useEffect(() => {
    api.get('/vehicles').then(r => setVehicles(r.data)).catch(() => {});
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const endpoint = role === 'customer' ? '/auth/register/customer' : '/auth/register/driver';
      const payload = role === 'customer'
        ? { name: form.name, phone: form.phone, password: form.password, address: form.address }
        : { name: form.name, phone: form.phone, password: form.password, vehicle_id: form.vehicle_id, vehicle_plate: form.vehicle_plate, national_id: form.national_id };
      const res = await api.post(endpoint, payload);

      if (role === 'customer') {
        // Update AuthContext so route guard passes immediately
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        setUser(res.data.user);
        toast.success('مرحباً بك! تم إنشاء حسابك بنجاح ❤️');
        navigate('/customer/home');
      } else {
        // Driver: needs admin approval first — send to login with info message
        toast.success('تم تسجيل طلبك — سيتم تفعيل حسابك بعد موافقة المشرف');
        navigate('/login');
      }
    } catch (err) {
      // Parse meaningful error messages
      const msg = err.response?.data?.message || '';
      if (msg.toLowerCase().includes('phone') || msg.includes('هاتف') || msg.includes('already')) {
        toast.error('رقم الهاتف مسجل مسبقاً — جرّب تسجيل الدخول');
      } else if (err.response?.data?.errors) {
        // express-validator array format
        toast.error(err.response.data.errors[0]?.msg || 'تحقق من بياناتك');
      } else {
        toast.error(msg || 'فشل إنشاء الحساب');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-green-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <BrandLogo size="md" className="mx-auto mb-3 border-white/20 shadow-[0_10px_28px_rgba(0,0,0,0.28)]" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">إنشاء حساب جديد</h1>
        </div>
        <div className="card">
          <div className="flex rounded-xl bg-gray-100 dark:bg-gray-700 p-1 mb-6">
            <button onClick={() => setRole('customer')} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${role === 'customer' ? 'bg-white dark:bg-gray-600 shadow-sm text-primary-600' : 'text-gray-500'}`}>عميل</button>
            <button onClick={() => setRole('driver')} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${role === 'driver' ? 'bg-white dark:bg-gray-600 shadow-sm text-primary-600' : 'text-gray-500'}`}>سائق</button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">الاسم الكامل</label><div className="relative"><User size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" /><input name="name" value={form.name} onChange={handleChange} className="input-field pr-10" placeholder="محمد أحمد" required /></div></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">رقم الهاتف</label><div className="relative"><Phone size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" /><input name="phone" value={form.phone} onChange={handleChange} className="input-field pr-10" placeholder="01XXXXXXXXX" required /></div></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">كلمة المرور</label><div className="relative"><Lock size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" /><input name="password" type="password" value={form.password} onChange={handleChange} className="input-field pr-10" placeholder="••••••••" required minLength={6} /></div></div>
            {role === 'customer' && (
              <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">العنوان</label><div className="relative"><MapPin size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" /><input name="address" value={form.address} onChange={handleChange} className="input-field pr-10" placeholder="طنطا، الغربية" /></div></div>
            )}
            {role === 'driver' && (
              <>
                <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">نوع المركبة</label><select name="vehicle_id" value={form.vehicle_id} onChange={handleChange} className="input-field" required><option value="">اختر المركبة</option>{vehicles.map(v => <option key={v.id} value={v.id}>{v.icon} {v.name_ar}</option>)}</select></div>
                <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">رقم اللوحة</label><input name="vehicle_plate" value={form.vehicle_plate} onChange={handleChange} className="input-field" placeholder="م ن ا 1234" /></div>
                <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">الرقم القومي</label><input name="national_id" value={form.national_id} onChange={handleChange} className="input-field" placeholder="12345678901234" /></div>
              </>
            )}
            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">{loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'إنشاء الحساب'}</button>
          </form>
          <div className="mt-4 text-center"><p className="text-gray-500 dark:text-gray-400 text-sm">لديك حساب بالفعل؟ <Link to="/login" className="text-primary-600 dark:text-primary-400 font-semibold hover:underline">تسجيل الدخول</Link></p></div>
        </div>
      </div>
    </div>
  );
}
