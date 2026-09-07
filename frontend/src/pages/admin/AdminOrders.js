import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../utils/api';
import { Eye, X, MapPin, Package, ShoppingCart } from 'lucide-react';

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [searchParams] = useSearchParams();
  const financialView = searchParams.get('financial');

  useEffect(() => { fetchOrders(); }, []);

  useEffect(() => {
    setFilter(searchParams.get('status') || '');
  }, [searchParams]);

  const fetchOrders = () => {
    api.get('/admin/orders').then(r => { setOrders(r.data); setLoading(false); }).catch(() => setLoading(false));
  };

  const openOrderDetail = (orderId) => {
    setLoadingDetail(true);
    setSelectedOrder({ _loading: true });
    api.get(`/admin/orders/${orderId}`)
      .then(r => { setSelectedOrder(r.data); })
      .catch(() => setSelectedOrder(null))
      .finally(() => setLoadingDetail(false));
  };

  const statusLabels = {
    requested: 'تم الطلب', finding_driver: 'جاري البحث', driver_assigned: 'تم التعيين',
    driver_accepted: 'قبول السائق', going_to_location: 'في الطريق', arrived_at_location: 'وصل',
    items_collected: 'تم الجمع', delivering: 'جاري التوصيل', completed: 'مكتمل', cancelled: 'ملغي'
  };

  const serviceTypeLabels = {
    ready_items: 'توصيل جاهز',
    driver_purchase: 'شراء بالوكالة'
  };

  const locationStatusLabels = {
    pending: 'في الانتظار',
    arrived: 'وصل',
    completed: 'مكتمل'
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
                    <button
                      onClick={() => openOrderDetail(order.id)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                      title="عرض التفاصيل"
                    >
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setSelectedOrder(null); }}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">

            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">تفاصيل الطلب</h3>
              <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><X size={20} /></button>
            </div>

            {selectedOrder._loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-5">

                {/* Basic Info */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-gray-500">رقم الطلب</span><span className="font-mono font-bold">{selectedOrder.order_number}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-500">العميل</span><span>{selectedOrder.customer_name}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-500">هاتف العميل</span><span className="font-mono">{selectedOrder.customer_phone}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-500">السائق</span><span>{selectedOrder.driver_name || '—'}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-500">الحالة</span><span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs">{statusLabels[selectedOrder.status]}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-500">نوع الخدمة</span><span>{serviceTypeLabels[selectedOrder.service_type] || selectedOrder.service_type}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-500">العنوان الأساسي</span><span className="text-left max-w-xs">{selectedOrder.customer_address}</span></div>
                  {selectedOrder.notes && (
                    <div className="flex justify-between text-sm"><span className="text-gray-500">ملاحظات</span><span className="text-left max-w-xs">{selectedOrder.notes}</span></div>
                  )}
                  <div className="flex justify-between text-sm"><span className="text-gray-500">التاريخ</span><span>{new Date(selectedOrder.created_at).toLocaleString('ar-EG')}</span></div>
                </div>

                {/* Delivery Locations */}
                {selectedOrder.locations && selectedOrder.locations.length > 0 && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <MapPin size={16} className="text-primary-500" />
                      <h4 className="font-semibold text-gray-800 dark:text-white text-sm">مناطق التوصيل ({selectedOrder.locations.length})</h4>
                    </div>
                    <div className="space-y-2">
                      {selectedOrder.locations.map((loc, idx) => (
                        <div key={loc.id} className="flex items-start gap-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
                          <span className="flex-shrink-0 w-6 h-6 bg-primary-500 text-white rounded-full text-xs flex items-center justify-center font-bold">
                            {idx + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 dark:text-white">
                              {loc.name_ar || loc.location_name || loc.custom_address || 'موقع غير محدد'}
                            </p>
                            {loc.custom_address && loc.name_ar && (
                              <p className="text-xs text-gray-500 mt-0.5">{loc.custom_address}</p>
                            )}
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                            loc.status === 'completed' ? 'bg-green-100 text-green-700' :
                            loc.status === 'arrived' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {locationStatusLabels[loc.status] || loc.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Order Items */}
                {selectedOrder.items && selectedOrder.items.length > 0 && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <div className="flex items-center gap-2 mb-3">
                      {selectedOrder.service_type === 'driver_purchase' ? <ShoppingCart size={16} className="text-orange-500" /> : <Package size={16} className="text-blue-500" />}
                      <h4 className="font-semibold text-gray-800 dark:text-white text-sm">
                        {selectedOrder.service_type === 'driver_purchase' ? 'قائمة المشتريات' : 'الأصناف'} ({selectedOrder.items.length})
                      </h4>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                          <tr className="text-right">
                            <th className="py-2 px-3 text-gray-500 font-medium">الصنف</th>
                            <th className="py-2 px-3 text-gray-500 font-medium text-center">الكمية</th>
                            <th className="py-2 px-3 text-gray-500 font-medium text-left">السعر</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                          {selectedOrder.items.map(item => (
                            <tr key={item.id} className="bg-white dark:bg-gray-800">
                              <td className="py-2 px-3">
                                <span className="font-medium text-gray-800 dark:text-white">{item.name}</span>
                                {item.is_purchased && <span className="mr-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">تم الشراء</span>}
                              </td>
                              <td className="py-2 px-3 text-center text-gray-600 dark:text-gray-300">{item.quantity} {item.unit || ''}</td>
                              <td className="py-2 px-3 text-left font-bold text-primary-600">{item.total} ج.م</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Financial Summary */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-2">
                  <h4 className="font-semibold text-gray-800 dark:text-white text-sm mb-3">ملخص مالي</h4>
                  <div className="flex justify-between text-sm"><span className="text-gray-500">رسوم التوصيل</span><span>{selectedOrder.delivery_fee} ج.م</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-500">رسوم الخدمة</span><span>{selectedOrder.service_fee} ج.م</span></div>
                  {parseFloat(selectedOrder.places_fee || 0) > 0 && (
                    <div className="flex justify-between text-sm"><span className="text-gray-500">رسوم المناطق ({selectedOrder.num_places} مناطق)</span><span>{selectedOrder.places_fee} ج.م</span></div>
                  )}
                  {parseFloat(selectedOrder.items_subtotal || 0) > 0 && (
                    <div className="flex justify-between text-sm"><span className="text-gray-500">إجمالي المشتريات</span><span>{selectedOrder.items_subtotal} ج.م</span></div>
                  )}
                  {parseFloat(selectedOrder.promo_discount || 0) > 0 && (
                    <div className="flex justify-between text-sm text-green-600"><span>الخصم</span><span>-{selectedOrder.promo_discount} ج.م</span></div>
                  )}
                  <div className="flex justify-between font-bold text-base border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                    <span>الإجمالي</span>
                    <span className="text-primary-600">{selectedOrder.final_total} ج.م</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-500 mt-1"><span>أرباح السائق</span><span>{selectedOrder.driver_earnings} ج.م</span></div>
                  <div className="flex justify-between text-sm text-gray-500"><span>أرباح المالك</span><span>{selectedOrder.owner_earnings} ج.م</span></div>
                </div>

                {/* Estimate / Receipt */}
                {selectedOrder.estimate_items && selectedOrder.estimate_items.length > 0 && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <h4 className="font-semibold text-gray-800 dark:text-white text-sm mb-3">إيصال السائق (تقدير الشراء)</h4>
                    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                          <tr className="text-right">
                            <th className="py-2 px-3 text-gray-500 font-medium">الصنف</th>
                            <th className="py-2 px-3 text-gray-500 font-medium text-center">الكمية</th>
                            <th className="py-2 px-3 text-gray-500 font-medium text-left">السعر</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                          {selectedOrder.estimate_items.map((item, idx) => (
                            <tr key={idx} className="bg-white dark:bg-gray-800">
                              <td className="py-2 px-3 text-gray-800 dark:text-white">{item.name}</td>
                              <td className="py-2 px-3 text-center text-gray-600 dark:text-gray-300">{item.qty || item.quantity || 1}</td>
                              <td className="py-2 px-3 text-left font-bold text-orange-600">{item.price || item.total} ج.م</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex justify-between font-bold mt-2 text-sm">
                      <span>إجمالي الإيصال</span>
                      <span className="text-orange-600">{selectedOrder.estimate_total} ج.م</span>
                    </div>
                  </div>
                )}

                {/* Rating & Review */}
                {selectedOrder.rating && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-1">
                    <div className="flex justify-between text-sm"><span className="text-gray-500">التقييم</span><span>{'⭐'.repeat(selectedOrder.rating)}</span></div>
                    {selectedOrder.review && <div className="flex justify-between text-sm"><span className="text-gray-500">التعليق</span><span className="text-left max-w-xs">{selectedOrder.review}</span></div>}
                  </div>
                )}

              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
