import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import {
  Users, Phone, ShoppingBag, CheckCircle, XCircle,
  DollarSign, Clock, Search, Trash2, AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminCustomers() {
  const [customers, setCustomers]       = useState([]);
  const [filtered, setFiltered]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting]         = useState(false);

  useEffect(() => {
    api.get('/admin/customers')
      .then(r => { setCustomers(r.data); setFiltered(r.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const q = search.trim().toLowerCase();
    setFiltered(q
      ? customers.filter(c =>
          c.name?.toLowerCase().includes(q) ||
          c.phone?.includes(q) ||
          c.email?.toLowerCase().includes(q)
        )
      : customers
    );
  }, [search, customers]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/customers/${deleteTarget.id}`);
      toast.success(`تم حذف العميل ${deleteTarget.name} نهائياً`);
      setCustomers(prev => prev.filter(c => c.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل الحذف');
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (d) => d
    ? new Date(d).toLocaleDateString('ar-EG', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

  if (loading) return (
    <div className="card text-center py-12">
      <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
    </div>
  );

  const totalSpent  = customers.reduce((s, c) => s + parseFloat(c.total_spent  || 0), 0);
  const totalOrders = customers.reduce((s, c) => s + parseInt(c.total_orders   || 0), 0);

  return (
    <div className="animate-fade-in space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Users size={24} className="text-primary-500" /> العملاء
          <span className="text-sm font-normal text-gray-400">({customers.length})</span>
        </h1>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center">
          <p className="text-2xl font-bold text-primary-600">{customers.length}</p>
          <p className="text-xs text-gray-500 mt-1">إجمالي العملاء</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-green-600">{totalOrders}</p>
          <p className="text-xs text-gray-500 mt-1">إجمالي الطلبات</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-purple-600">{totalSpent.toFixed(0)}</p>
          <p className="text-xs text-gray-500 mt-1">إجمالي الإيرادات ج.م</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="بحث بالاسم أو الهاتف أو البريد..."
          className="input-field pr-9"
        />
      </div>

      {/* Customers list */}
      {filtered.length === 0 ? (
        <div className="card text-center py-10 text-gray-400">
          <Users size={40} className="mx-auto mb-3 opacity-30" />
          <p>لا يوجد عملاء</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => (
            <div key={c.id} className="card">
              <div className="flex items-start justify-between gap-3">
                {/* Avatar + info */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="font-bold text-primary-600 text-sm">{c.name?.charAt(0) || '?'}</span>
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 dark:text-white text-sm">{c.name}</p>
                    <a href={`tel:${c.phone}`} className="text-xs text-primary-500 flex items-center gap-1 hover:underline">
                      <Phone size={11} /> {c.phone}
                    </a>
                    {c.email && <p className="text-xs text-gray-400">{c.email}</p>}
                  </div>
                </div>

                {/* Right side: status + delete */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs px-2 py-1 rounded-full ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                    {c.is_active ? 'نشط' : 'موقوف'}
                  </span>
                  <button
                    onClick={() => setDeleteTarget(c)}
                    className="p-1.5 bg-red-100 text-red-500 rounded-lg hover:bg-red-200 transition-colors"
                    title="حذف نهائي"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                <div className="text-center">
                  <p className="font-bold text-gray-800 dark:text-white text-sm">{c.total_orders}</p>
                  <p className="text-xs text-gray-400 flex items-center justify-center gap-0.5"><ShoppingBag size={10} /> الكل</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-green-600 text-sm">{c.completed_orders}</p>
                  <p className="text-xs text-gray-400 flex items-center justify-center gap-0.5"><CheckCircle size={10} /> مكتمل</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-red-500 text-sm">{c.cancelled_orders}</p>
                  <p className="text-xs text-gray-400 flex items-center justify-center gap-0.5"><XCircle size={10} /> ملغي</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-primary-600 text-sm">{parseFloat(c.total_spent).toFixed(0)}</p>
                  <p className="text-xs text-gray-400 flex items-center justify-center gap-0.5"><DollarSign size={10} /> ج.م</p>
                </div>
              </div>

              {/* Last order */}
              <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                <Clock size={11} />
                آخر طلب: {formatDate(c.last_order_at)}
                &nbsp;·&nbsp; انضم: {formatDate(c.created_at)}
              </p>
            </div>
          ))}
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
                <h3 className="font-bold text-gray-900 dark:text-white">حذف العميل نهائياً</h3>
                <p className="text-sm text-gray-500">هذا الإجراء لا يمكن التراجع عنه</p>
              </div>
            </div>

            <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 text-sm text-red-700 dark:text-red-300 space-y-1">
              <p className="font-semibold">سيتم حذف:</p>
              <p>• حساب العميل <strong>{deleteTarget.name}</strong></p>
              <p>• جميع طلباته ({deleteTarget.total_orders} طلب)</p>
              <p>• جميع المحادثات والبيانات المرتبطة</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="btn-secondary flex-1"
                disabled={deleting}
              >
                إلغاء
              </button>
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
