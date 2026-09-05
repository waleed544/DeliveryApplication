import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { CreditCard, DollarSign, CheckCircle, User, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminPayouts() {
  const [drivers, setDrivers] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [amount, setAmount] = useState('');

  useEffect(() => { fetchData(); }, []);

  const fetchData = () => {
    api.get('/admin/drivers').then(r => { setDrivers(r.data); });
    api.get('/admin/payouts').then(r => { setPayouts(r.data); setLoading(false); }).catch(() => setLoading(false));
  };

  const processPayout = async () => {
    if (!selectedDriver || !amount) return;
    try {
      await api.post('/admin/payouts', { driver_id: selectedDriver, amount: parseFloat(amount) });
      toast.success('تمت الدفعة بنجاح');
      setSelectedDriver(null);
      setAmount('');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل الدفع');
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">المدفوعات</h1>

      {/* Process Payout */}
      <div className="card">
        <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <CreditCard size={20} className="text-primary-500" /> دفع أرباح سائق
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <select value={selectedDriver || ''} onChange={(e) => setSelectedDriver(e.target.value)} className="input-field">
            <option value="">اختر السائق</option>
            {drivers.filter(d => parseFloat(d.unpaid_earnings) > 0).map(d => (
              <option key={d.id} value={d.id}>{d.name} — {parseFloat(d.unpaid_earnings).toFixed(0)} ج.م</option>
            ))}
          </select>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="input-field" placeholder="المبلغ" />
          <button onClick={processPayout} disabled={!selectedDriver || !amount} className="btn-primary flex items-center justify-center gap-2">
            <CheckCircle size={16} /> تأكيد الدفع
          </button>
        </div>
      </div>

      {/* Payout History */}
      <div className="card">
        <h3 className="font-bold text-gray-900 dark:text-white mb-4">سجل المدفوعات</h3>
        {loading ? <div className="text-center py-8"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" /></div> : payouts.length === 0 ? (
          <p className="text-gray-500 text-center py-8">لا توجد مدفوعات مسجلة</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="text-right text-sm text-gray-500 border-b border-gray-200 dark:border-gray-700"><th className="pb-3 pr-4">السائق</th><th className="pb-3">المبلغ</th><th className="pb-3">تم الدفع بواسطة</th><th className="pb-3 pl-4">التاريخ</th></tr></thead>
              <tbody>
                {payouts.map(p => (
                  <tr key={p.id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-3 pr-4 text-sm font-medium">{p.driver_name}</td>
                    <td className="py-3 text-sm font-bold text-green-600">{p.amount} ج.م</td>
                    <td className="py-3 text-sm text-gray-500">{p.processed_by_name}</td>
                    <td className="py-3 pl-4 text-sm text-gray-500">{new Date(p.created_at).toLocaleDateString('ar-EG')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
