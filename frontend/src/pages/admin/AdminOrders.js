import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../utils/api';
import { Package, MapPin, Phone, Eye, X } from 'lucide-react';

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [searchParams] = useSearchParams();
  const financialView = searchParams.get('financial');

  useEffect(() => { fetchOrders(); }, []);

  useEffect(() => {
    setFilter(searchParams.get('status') || '');
  }, [searchParams]);

  const fetchOrders = () => {
    api.get('/admin/orders').then(r => { setOrders(r.data); setLoading(false); }).catch(() => setLoading(false));
  };

  const statusLabels = {
    requested: 'تم الطلب', finding_driver: 'جاري البحث', driver_assigned: 'تم التعيين',
    driver_accepted: 'قبول السائق', going_to_location: 'في الطريق', arrived_at_location: 'وصل',
    items_collected: 'تم الجمع', delivering: 'جاري التوصيل', completed: 'مكتمل', cancelled: 'ملغي'
  };

  const filtered = filter ? orders.filter(o => o.status === filter) : orders;

  return (
    <div className="animate-fade-in space-y-4">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        {financialView === 'service' ? 'إيرادات الخدمة' : financialView === 'owner' ? 'أرباح المالك' : filter === 'cancelled' ? 'الطلبات الملغية' : 'إدارة الطلبات'}
      </h1>

      <div className="flex gap-2 overflow-x-auto pb-2">
        <button onClick={() => setFilter('')} className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${!filter ? 'bg-primary-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600'}`}>الكل</button>
        {Object.keys(statusLabels).map(s => (
          <button key={s} onClick={() => setFilter(s)} className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${filter === s ? 'bg-primary-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600'}`}>{statusLabels[s]}</button>
        ))}
      </div>

      {loading ? <div className="card text-center py-12"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" /></div> : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-right text-sm text-gray-500 border-b border-gray-200 dark:border-gray-700">
                <th className="pb-3 pr-4">الرقم</th>
                <th className="pb-3">العميل</th>
                <th className="pb-3">السائق</th>
                <th className="pb-3">الحالة</th>
                <th className="pb-3">المبلغ</th>
                <th className="pb-3">التاريخ</th>
                <th className="pb-3 pl-4">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(order => (
                <tr key={order.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="py-3 pr-4 text-sm font-mono">{order.order_number}</td>
                  <td className="py-3 text-sm">{order.customer_name}</td>
                  <td className="py-3 text-sm">{order.driver_name || '—'}</td>
                  <td className="py-3"><span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">{statusLabels[order.status]}</span></td>
                  <td className="py-3 text-sm font-bold text-primary-600">{order.final_total} ج.م</td>
                  <td className="py-3 text-sm text-gray-500">{new Date(order.created_at).toLocaleDateString('ar-EG')}</td>
                  <td className="py-3 pl-4">
                    <button onClick={() => api.get(`/admin/orders/${order.id}`).then(r => setSelectedOrder(r.data))} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg">
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">تفاصيل الطلب</h3>
              <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-sm"><span className="text-gray-500">رقم الطلب</span><span className="font-mono">{selectedOrder.order_number}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">العميل</span><span>{selectedOrder.customer_name}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">السائق</span><span>{selectedOrder.driver_name || '—'}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">الحالة</span><span>{statusLabels[selectedOrder.status]}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">العنوان</span><span>{selectedOrder.customer_address}</span></div>
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-gray-500">التوصيل</span><span>{selectedOrder.delivery_fee} ج.م</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">الخدمة</span><span>{selectedOrder.service_fee} ج.م</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">المشتريات</span><span>{selectedOrder.items_subtotal} ج.م</span></div>
                {parseFloat(selectedOrder.promo_discount || 0) > 0 && (
                  <div className="flex justify-between text-sm text-green-600"><span>الخصم</span><span>-{selectedOrder.promo_discount} ج.م</span></div>
                )}
                <div className="flex justify-between font-bold"><span>الإجمالي</span><span className="text-primary-600">{selectedOrder.final_total} ج.م</span></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
