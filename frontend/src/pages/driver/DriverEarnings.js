import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { DollarSign, TrendingUp, Wallet, ArrowDownLeft, ArrowUpRight, Settings, Clock } from 'lucide-react';

export default function DriverEarnings() {
  const [data, setData] = useState({ earnings: [], balanceHistory: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/drivers/earnings'), api.get('/drivers/balance-history')]).then(([earningsResponse, balanceResponse]) => {
      setData({ earnings: earningsResponse.data.earnings || [], balanceHistory: balanceResponse.data });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const totalEarnings = data.earnings.reduce((s, e) => s + parseFloat(e.amount), 0);
  const balance = data.balanceHistory?.prepaid_balance || 0;
  const transactions = data.balanceHistory?.transactions || [];
  const typeConfig = {
    deposit: { label: 'إضافة من الإدارة', icon: ArrowUpRight, color: 'text-green-600 dark:text-green-400' },
    deduction: { label: 'خصم حصة الإدارة', icon: ArrowDownLeft, color: 'text-red-600 dark:text-red-400' },
    adjustment: { label: 'تعديل من الإدارة', icon: Settings, color: 'text-blue-600 dark:text-blue-400' }
  };

  if (loading) return <div className="card text-center py-12"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>;

  return (
    <div className="animate-fade-in space-y-4">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">الأرباح</h2>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800">
          <DollarSign size={20} className="text-primary-600 mb-1" />
          <p className="text-2xl font-bold text-primary-600">{totalEarnings.toFixed(2)}</p>
          {/* 'عمولتي' = my commission on delivery+service fees only — NOT purchases */}
          <p className="text-xs text-gray-700 dark:text-gray-300 font-semibold">عمولتي الكلية</p>
          <p className="text-[10px] text-gray-400 mt-0.5">نسبتك من رسوم التوصيل والخدمة فقط</p>
        </div>
        <div className="card bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
          <Wallet size={20} className="text-green-600 mb-1" />
          <p className="text-2xl font-bold text-green-600">{balance.toFixed(2)}</p>
          <p className="text-xs text-gray-700 dark:text-gray-300 font-semibold">الرصيد المستحق</p>
          <p className="text-[10px] text-gray-400 mt-0.5">عمولتك الكلية ناقص ما استلمته</p>
        </div>
      </div>

      {/* Earnings History */}
      <div className="card">
        <h3 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <TrendingUp size={18} className="text-primary-500" /> سجل الأرباح
        </h3>
        {data.earnings.length === 0 ? (
          <p className="text-gray-500 text-center py-4">لا توجد أرباح مسجلة</p>
        ) : (
          <div className="space-y-2">
            {data.earnings.map(e => (
              <div key={e.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">طلب #{e.order_number}</p>
                  <p className="text-xs text-gray-500">{new Date(e.created_at).toLocaleDateString('ar-EG')}</p>
                </div>
                <div className="flex items-center gap-1 text-green-600 font-bold">
                  <ArrowUpRight size={14} /> +{e.amount} ج.م
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Balance History */}
      <div className="card">
        <h3 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <Clock size={18} className="text-primary-500" /> سجل حركة الرصيد
        </h3>
        {transactions.length === 0 ? (
          <p className="text-gray-500 text-center py-4">لا توجد معاملات رصيد مسجلة</p>
        ) : (
          <div className="space-y-2">
            {transactions.map(transaction => {
              const config = typeConfig[transaction.type] || typeConfig.adjustment;
              const Icon = config.icon;
              return <div key={transaction.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{config.label}</p>
                  <p className="text-xs text-gray-500">{transaction.description || '—'} · {new Date(transaction.created_at).toLocaleDateString('ar-EG')}</p>
                </div>
                <div className={`flex items-center gap-1 font-bold ${transaction.type === 'deduction' || transaction.amount < 0 ? 'text-red-600 dark:text-red-400' : config.color}`}>
                  <Icon size={14} /> {transaction.type === 'deduction' || transaction.amount < 0 ? '-' : '+'}{Math.abs(transaction.amount).toFixed(2)} ج.م
                </div>
              </div>;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
