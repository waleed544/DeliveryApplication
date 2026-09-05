import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../utils/api';
import {
  ArrowLeft, Wallet, TrendingDown, TrendingUp, Settings,
  Clock, Package, AlertTriangle, Plus, DollarSign
} from 'lucide-react';
import toast from 'react-hot-toast';

const typeConfig = {
  deposit:    { label: 'إيداع',    icon: TrendingUp,   color: 'text-green-600 dark:text-green-400',  bg: 'bg-green-100 dark:bg-green-900/30'  },
  deduction:  { label: 'خصم',     icon: TrendingDown, color: 'text-red-600 dark:text-red-400',     bg: 'bg-red-100 dark:bg-red-900/30'     },
  adjustment: { label: 'تعديل',   icon: Settings,     color: 'text-blue-600 dark:text-blue-400',  bg: 'bg-blue-100 dark:bg-blue-900/30'   },
};

export default function AdminDriverBalance() {
  const { id } = useParams();
  const [data, setData]             = useState(null);
  const [loading, setLoading]       = useState(true);
  // Add balance inline form
  const [showForm, setShowForm]     = useState(false);
  const [form, setForm]             = useState({ amount: '', type: 'deposit', description: '' });
  const [saving, setSaving]         = useState(false);
  // Renewal form
  const [renewalAmt, setRenewalAmt] = useState('');
  const [savingRen, setSavingRen]   = useState(false);

  useEffect(() => { fetchData(); }, [id]); // eslint-disable-line

  const fetchData = () => {
    setLoading(true);
    api.get(`/admin/drivers/${id}/balance-transactions`)
      .then(r => { setData(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  const submitBalance = async () => {
    const amt = parseFloat(form.amount);
    if (!amt || amt === 0) { toast.error('أدخل مبلغاً صحيحاً'); return; }
    setSaving(true);
    try {
      await api.post(`/admin/drivers/${id}/balance`, form);
      toast.success('✅ تم تحديث الرصيد');
      setShowForm(false);
      setForm({ amount: '', type: 'deposit', description: '' });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل');
    } finally { setSaving(false); }
  };

  const submitRenewal = async () => {
    const amt = parseFloat(renewalAmt);
    if (!amt || amt <= 0) { toast.error('أدخل مبلغاً صحيحاً'); return; }
    setSavingRen(true);
    try {
      await api.put(`/admin/drivers/${id}/renewal-amount`, { renewal_amount: amt });
      toast.success('✅ تم تحديث مبلغ التجديد');
      setRenewalAmt('');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل');
    } finally { setSavingRen(false); }
  };

  if (loading) return (
    <div className="card text-center py-12">
      <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
    </div>
  );
  if (!data) return (
    <div className="card text-center py-12 text-gray-500">فشل تحميل البيانات</div>
  );

  const balance   = data.prepaid_balance;
  const renewal   = data.balance_renewal_amount;
  const pct       = renewal > 0 ? (balance / renewal) * 100 : 0;
  const depleted  = balance <= 0;
  const low       = !depleted && pct < 20;

  // Summary stats
  const totalDeposited  = data.transactions.filter(t => t.type === 'deposit').reduce((s, t) => s + t.amount, 0);
  const totalDeducted   = data.transactions.filter(t => t.type === 'deduction').reduce((s, t) => s + t.amount, 0);
  const totalAdjusted   = data.transactions.filter(t => t.type === 'adjustment').reduce((s, t) => s + t.amount, 0);

  return (
    <div className="animate-fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/admin/drivers" className="p-2 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">سجل رصيد: {data.driver_name}</h1>
          <p className="text-sm text-gray-500">{data.transactions.length} معاملة</p>
        </div>
      </div>

      {/* Balance overview */}
      <div className={`card border-2 ${
        depleted ? 'border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-900/10' :
        low      ? 'border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/10' :
                   'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/10'
      }`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Wallet size={22} className={depleted ? 'text-red-500' : low ? 'text-amber-500' : 'text-green-600'} />
            <span className="font-bold text-gray-900 dark:text-white">الرصيد الحالي</span>
          </div>
          <span className={`text-3xl font-extrabold ${
            depleted ? 'text-red-600 dark:text-red-400' :
            low      ? 'text-amber-600 dark:text-amber-400' :
                       'text-green-700 dark:text-green-400'
          }`}>{balance.toFixed(2)} ج.م</span>
        </div>

        {/* Progress */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-3">
          <div
            className={`h-3 rounded-full transition-all ${depleted ? 'bg-red-500' : low ? 'bg-amber-400' : 'bg-green-500'}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>مبلغ التجديد المعياري: <strong>{renewal.toFixed(2)} ج.م</strong></span>
          <span>{pct.toFixed(0)}% متبقي</span>
        </div>

        {depleted && (
          <div className="mt-3 flex items-center gap-2 text-red-600 dark:text-red-400 text-sm font-semibold">
            <AlertTriangle size={16} /> الرصيد نفد — السائق محجوب عن قبول الطلبات
          </div>
        )}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center">
          <TrendingUp size={18} className="text-green-500 mx-auto mb-1" />
          <p className="text-lg font-bold text-green-600">{totalDeposited.toFixed(2)}</p>
          <p className="text-xs text-gray-500">إجمالي الإيداع</p>
        </div>
        <div className="card text-center">
          <TrendingDown size={18} className="text-red-500 mx-auto mb-1" />
          <p className="text-lg font-bold text-red-600">{totalDeducted.toFixed(2)}</p>
          <p className="text-xs text-gray-500">إجمالي الخصم</p>
        </div>
        <div className="card text-center">
          <DollarSign size={18} className="text-blue-500 mx-auto mb-1" />
          <p className="text-lg font-bold text-blue-600">{totalAdjusted.toFixed(2)}</p>
          <p className="text-xs text-gray-500">تعديلات</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 flex-wrap">
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold text-sm transition-colors"
        >
          <Plus size={16} /> إضافة رصيد
        </button>
        <div className="flex items-center gap-2">
          <input
            type="number"
            step="50"
            placeholder="مبلغ التجديد الجديد"
            value={renewalAmt}
            onChange={e => setRenewalAmt(e.target.value)}
            className="input-field w-44 text-sm"
          />
          <button
            onClick={submitRenewal}
            disabled={savingRen || !renewalAmt}
            className="px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-50 transition-colors"
          >
            {savingRen ? '...' : 'تعيين التجديد'}
          </button>
        </div>
      </div>

      {/* Add balance form */}
      {showForm && (
        <div className="card border-2 border-green-300 dark:border-green-700 space-y-3">
          <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Wallet size={18} className="text-green-500" /> إضافة / تعديل رصيد
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">نوع العملية</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="input-field w-full">
                <option value="deposit">إيداع</option>
                <option value="adjustment">تعديل</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">المبلغ (ج.م)</label>
              <input
                type="number" step="0.01"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder={form.type === 'adjustment' ? 'مثال: -500 أو 500' : 'مثال: 500'}
                className="input-field w-full"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ملاحظة</label>
            <input
              type="text"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="مثال: تجديد شهر أكتوبر"
              className="input-field w-full"
            />
          </div>
          <div className="flex gap-3">
            <button onClick={submitBalance} disabled={saving} className="btn-primary flex-1">
              {saving ? 'جاري الحفظ...' : 'حفظ'}
            </button>
            <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">إلغاء</button>
          </div>
        </div>
      )}

      {/* Transaction history */}
      <div className="card">
        <h2 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Clock size={18} className="text-primary-500" /> سجل المعاملات
        </h2>

        {data.transactions.length === 0 ? (
          <p className="text-center text-gray-400 py-8">لا توجد معاملات بعد</p>
        ) : (
          <div className="space-y-2">
            {data.transactions.map(tx => {
              const cfg = typeConfig[tx.type] || typeConfig.deposit;
              const Icon = cfg.icon;
              return (
                <div key={tx.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/40 rounded-xl">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                    <Icon size={16} className={cfg.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                      {tx.order_number && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Package size={11} /> {tx.order_number}
                        </span>
                      )}
                      {tx.created_by_name && (
                        <span className="text-xs text-gray-400">بواسطة: {tx.created_by_name}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{tx.description || '—'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(tx.created_at).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`font-bold ${tx.type === 'deduction' || tx.amount < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                      {tx.type === 'deduction' || tx.amount < 0 ? '-' : '+'}{Math.abs(tx.amount).toFixed(2)} ج.م
                    </p>
                    <p className="text-xs text-gray-400">رصيد: {tx.balance_after.toFixed(2)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
