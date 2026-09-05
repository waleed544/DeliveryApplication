import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import {
  User, Phone, Truck, Star, CheckCircle, Clock,
  DollarSign, Shield, ShieldOff, Save, Trash2, AlertTriangle,
  Wallet, Plus, History
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminDrivers() {
  const [drivers, setDrivers]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [showModal, setShowModal]       = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting]         = useState(false);
  // Balance modal state
  const [balanceTarget, setBalanceTarget] = useState(null);
  const [balanceForm, setBalanceForm]     = useState({ amount: '', type: 'deposit', description: '' });
  const [savingBalance, setSavingBalance] = useState(false);
  // Renewal amount edit
  const [renewalTarget, setRenewalTarget] = useState(null);
  const [renewalAmount, setRenewalAmount] = useState('');
  const [savingRenewal, setSavingRenewal] = useState(false);

  useEffect(() => { fetchDrivers(); }, []);

  const fetchDrivers = () => {
    api.get('/admin/drivers')
      .then(r => { setDrivers(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  const approveDriver = async (id) => {
    try { await api.put(`/admin/drivers/${id}/approve`); toast.success('تم الموافقة'); fetchDrivers(); }
    catch { toast.error('فشل'); }
  };

  const toggleDriver = async (id) => {
    try { await api.put(`/admin/drivers/${id}/toggle`); toast.success('تم التحديث'); fetchDrivers(); }
    catch { toast.error('فشل'); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/drivers/${deleteTarget.id}`);
      toast.success(`تم حذف السائق ${deleteTarget.name} نهائياً`);
      setDeleteTarget(null);
      fetchDrivers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل الحذف');
    } finally {
      setDeleting(false);
    }
  };

  const saveShifts = async () => {
    try {
      await api.put(`/admin/drivers/${selectedDriver.id}/shifts`, { shifts: selectedDriver.shifts });
      toast.success('تم حفظ المواعيد');
      setShowModal(false);
      fetchDrivers();
    } catch { toast.error('فشل'); }
  };

  const submitBalance = async () => {
    const amt = parseFloat(balanceForm.amount);
    if (!amt || amt === 0) { toast.error('أدخل مبلغاً صحيحاً'); return; }
    setSavingBalance(true);
    try {
      await api.post(`/admin/drivers/${balanceTarget.id}/balance`, balanceForm);
      toast.success('✅ تم تحديث الرصيد');
      setBalanceTarget(null);
      setBalanceForm({ amount: '', type: 'deposit', description: '' });
      fetchDrivers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل');
    } finally {
      setSavingBalance(false);
    }
  };

  const submitRenewal = async () => {
    const amt = parseFloat(renewalAmount);
    if (!amt || amt <= 0) { toast.error('أدخل مبلغاً صحيحاً'); return; }
    setSavingRenewal(true);
    try {
      await api.put(`/admin/drivers/${renewalTarget.id}/renewal-amount`, { renewal_amount: amt });
      toast.success('✅ تم تحديث مبلغ التجديد');
      setRenewalTarget(null);
      setRenewalAmount('');
      fetchDrivers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل');
    } finally {
      setSavingRenewal(false);
    }
  };

  const openShiftModal = (driver) => {
    const shiftsMap = {};
    (driver.shifts || []).forEach(s => { shiftsMap[s.day_of_week] = s; });
    const fullShifts = Array(7).fill(null).map((_, i) =>
      shiftsMap[i] || { day_of_week: i, start_time: '09:00', end_time: '17:00', is_active: false }
    );
    setSelectedDriver({ ...driver, shifts: fullShifts });
    setShowModal(true);
  };

  const updateShift = (idx, field, value) => {
    const newShifts = [...selectedDriver.shifts];
    newShifts[idx] = { ...newShifts[idx], [field]: value };
    setSelectedDriver({ ...selectedDriver, shifts: newShifts });
  };

  const days = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];

  if (loading) return (
    <div className="card text-center py-12">
      <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
    </div>
  );

  return (
    <div className="animate-fade-in space-y-4">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">إدارة السائقين</h1>

      <div className="grid gap-4">
        {drivers.map(driver => {
          const balance  = driver.prepaid_balance != null ? driver.prepaid_balance : 0;
          const renewal  = driver.balance_renewal_amount || 1000;
          const negative = balance < 0;
          const depleted = balance <= 0;
          const pct      = !depleted && renewal > 0 ? (balance / renewal) * 100 : 0;
          const low      = !depleted && pct < 20;

          return (
            <div key={driver.id} className={`card ${!driver.is_approved ? 'border-2 border-yellow-300 dark:border-yellow-700' : ''}`}>
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center text-2xl">
                    {driver.icon || <User size={22} className="text-primary-500" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-gray-900 dark:text-white">{driver.name}</p>
                      {!driver.is_approved && (
                        <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full">بانتظار الموافقة</span>
                      )}
                      {!driver.user_active && (
                        <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full">معطل</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                      <span className="flex items-center gap-1"><Phone size={12} /> {driver.phone}</span>
                      <span className="flex items-center gap-1"><Truck size={12} /> {driver.vehicle_name_ar}</span>
                      <span className="flex items-center gap-1"><Star size={12} className="text-yellow-400 fill-yellow-400" /> {driver.rating_avg}</span>
                    </div>
                  </div>
                </div>

                {/* Balance indicator */}
                <div className={`flex flex-col items-center px-4 py-2 rounded-xl min-w-[120px] ${
                  depleted ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' :
                  low      ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800' :
                             'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                }`}>
                  <Wallet size={14} className={depleted ? 'text-red-500' : low ? 'text-amber-500' : 'text-green-600'} />
                  <p className={`text-lg font-extrabold ${depleted ? 'text-red-600' : low ? 'text-amber-600' : 'text-green-700 dark:text-green-400'}`}>
                    {balance.toFixed(0)} ج.م
                  </p>
                  <p className="text-xs text-gray-500">رصيد / {renewal.toFixed(0)}</p>
                  {/* Mini progress bar — 0% when negative */}
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1 mt-1">
                    <div
                      className={`h-1 rounded-full ${depleted ? 'bg-red-500' : low ? 'bg-amber-400' : 'bg-green-500'}`}
                      style={{ width: `${Math.max(Math.min(pct, 100), 0)}%` }}
                    />
                  </div>
                  {negative && <span className="text-xs text-red-500 font-semibold mt-0.5">سالب ⚠</span>}
                  {depleted && !negative && <span className="text-xs text-red-500 font-semibold mt-0.5">نفد ⚠</span>}
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <div className="text-center px-3">
                    <p className="font-bold text-green-600">{driver.completed_orders || 0}</p>
                    <p className="text-xs text-gray-500">مكتمل</p>
                  </div>
                  <div className="text-center px-3">
                    <p className="font-bold text-gray-900 dark:text-white">{parseFloat(driver.total_earnings || 0).toFixed(0)}</p>
                    <p className="text-xs text-gray-500">اجمالي الربح  </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Add balance button */}
                  <button
                    onClick={() => { setBalanceTarget(driver); setBalanceForm({ amount: '', type: 'deposit', description: '' }); }}
                    className="flex items-center gap-1 px-3 py-2 bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 rounded-lg text-sm font-semibold transition-colors"
                    title="إضافة رصيد"
                  >
                    <Plus size={15} /> رصيد
                  </button>
                  {/* Balance history link */}
                  <Link
                    to={`/admin/drivers/${driver.id}/balance`}
                    className="flex items-center gap-1 px-3 py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg text-sm font-semibold transition-colors"
                    title="سجل الرصيد"
                  >
                    <History size={15} />
                  </Link>

                  {!driver.is_approved && (
                    <button onClick={() => approveDriver(driver.id)} className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600" title="موافقة">
                      <CheckCircle size={18} />
                    </button>
                  )}
                  <button
                    onClick={() => toggleDriver(driver.id)}
                    className={`p-2 rounded-lg ${driver.user_active ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-green-100 text-green-600 hover:bg-green-200'}`}
                    title={driver.user_active ? 'تعطيل' : 'تفعيل'}
                  >
                    {driver.user_active ? <ShieldOff size={18} /> : <Shield size={18} />}
                  </button>
                  <button onClick={() => openShiftModal(driver)} className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200" title="مواعيد العمل">
                    <Clock size={18} />
                  </button>
                  <a href={`tel:${driver.phone}`} className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200" title="اتصال">
                    <Phone size={18} />
                  </a>
                  <button
                    onClick={() => setDeleteTarget(driver)}
                    className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                    title="حذف نهائي"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Add Balance Modal ─────────────────────────────────────────── */}
      {balanceTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <Wallet size={20} className="text-green-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">إدارة رصيد السائق</h3>
                <p className="text-sm text-gray-500">{balanceTarget.name} — الرصيد الحالي: <strong>{parseFloat(balanceTarget.prepaid_balance || 0).toFixed(2)} ج.م</strong></p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">نوع العملية</label>
                <select
                  value={balanceForm.type}
                  onChange={e => setBalanceForm(f => ({ ...f, type: e.target.value }))}
                  className="input-field w-full"
                >
                  <option value="deposit">إيداع (إضافة رصيد)</option>
                  <option value="adjustment">تعديل (يمكن أن يكون سالباً)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  المبلغ (ج.م) {balanceForm.type === 'adjustment' && '— يمكن إدخال قيمة سالبة للخصم'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={balanceForm.amount}
                  onChange={e => setBalanceForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="مثال: 1000"
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ملاحظة (اختياري)</label>
                <input
                  type="text"
                  value={balanceForm.description}
                  onChange={e => setBalanceForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="مثال: تجديد شهر سبتمبر"
                  className="input-field w-full"
                />
              </div>

              {/* Renewal amount quick-set */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                <p className="text-xs text-gray-500 mb-2">مبلغ التجديد المعياري: <strong>{parseFloat(balanceTarget.balance_renewal_amount || 1000).toFixed(0)} ج.م</strong></p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="50"
                    placeholder="تغيير مبلغ التجديد"
                    className="input-field flex-1 text-sm"
                    value={renewalAmount}
                    onChange={e => { setRenewalAmount(e.target.value); setRenewalTarget(balanceTarget); }}
                  />
                  <button
                    onClick={submitRenewal}
                    disabled={savingRenewal || !renewalAmount}
                    className="px-3 py-2 bg-blue-500 text-white rounded-xl text-sm font-semibold hover:bg-blue-600 disabled:opacity-50"
                  >
                    {savingRenewal ? '...' : 'تعيين'}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={submitBalance} disabled={savingBalance} className="btn-primary flex-1 flex items-center justify-center gap-2">
                {savingBalance ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <DollarSign size={16} />}
                {savingBalance ? 'جاري الحفظ...' : 'حفظ'}
              </button>
              <button onClick={() => { setBalanceTarget(null); setRenewalAmount(''); setRenewalTarget(null); }} className="btn-secondary flex-1">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Shift Modal ──────────────────────────────────────────────── */}
      {showModal && selectedDriver && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">مواعيد عمل: {selectedDriver.name}</h3>
            <div className="space-y-3">
              {days.map((day, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <input
                    type="checkbox"
                    checked={selectedDriver.shifts[idx]?.is_active !== false}
                    onChange={e => updateShift(idx, 'is_active', e.target.checked)}
                    className="w-5 h-5 rounded"
                  />
                  <span className="w-20 text-sm font-medium">{day}</span>
                  <input type="time" value={selectedDriver.shifts[idx]?.start_time || '09:00'} onChange={e => updateShift(idx, 'start_time', e.target.value)} className="input-field text-sm w-28" />
                  <span className="text-gray-400">-</span>
                  <input type="time" value={selectedDriver.shifts[idx]?.end_time || '17:00'} onChange={e => updateShift(idx, 'end_time', e.target.value)} className="input-field text-sm w-28" />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={saveShifts} className="btn-primary flex-1 flex items-center justify-center gap-2"><Save size={18} /> حفظ</button>
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={24} className="text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">حذف السائق نهائياً</h3>
                <p className="text-sm text-gray-500">هذا الإجراء لا يمكن التراجع عنه</p>
              </div>
            </div>

            <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 text-sm text-red-700 dark:text-red-300 space-y-1">
              <p className="font-semibold">سيتم حذف:</p>
              <p>• حساب السائق <strong>{deleteTarget.name}</strong></p>
              <p>• جميع مواعيد العمل والأرباح وسجل الرصيد</p>
              <p>• سيتم الاحتفاظ بسجل الطلبات للمراجعة</p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="btn-secondary flex-1" disabled={deleting}>إلغاء</button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Trash2 size={16} />
                }
                {deleting ? 'جاري الحذف...' : 'حذف نهائياً'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
