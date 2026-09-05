import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import { useSiteStatus } from '../../context/SiteStatusContext';
import { Plus, Package, Clock, CheckCircle, MapPin, Truck, AlertTriangle } from 'lucide-react';

export default function CustomerHome() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const { accepting_orders, offline_message } = useSiteStatus();

  useEffect(() => {
    api.get('/customers/orders').then(r => {
      setOrders(r.data.slice(0, 3));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const statusLabels = {
    requested: 'تم الطلب', finding_driver: 'جاري البحث عن سائق',
    driver_assigned: 'تم تعيين السائق', driver_accepted: 'قبول السائق',
    going_to_location: 'في الطريق', arrived_at_location: 'وصل للموقع',
    items_collected: 'تم جمع الطلبات', delivering: 'جاري التوصيل',
    completed: 'تم التسليم', cancelled: 'ملغي'
  };
  const statusColors = {
    requested: 'bg-blue-100 text-blue-700', finding_driver: 'bg-yellow-100 text-yellow-700',
    driver_accepted: 'bg-green-100 text-green-700', going_to_location: 'bg-purple-100 text-purple-700',
    delivering: 'bg-orange-100 text-orange-700', completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700'
  };

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Offline banner */}
      {!accepting_orders && (
        <div className="card border-2 border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-900/20 flex items-start gap-3">
          <AlertTriangle size={22} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-red-700 dark:text-red-300">الخدمة متوقفة مؤقتاً</p>
            <p className="text-sm text-red-600 dark:text-red-400 mt-0.5">{offline_message}</p>
          </div>
        </div>
      )}

      {/* Welcome card */}
      <div className={`card text-white border-0 ${accepting_orders ? 'bg-gradient-to-br from-primary-500 to-green-500' : 'bg-gradient-to-br from-gray-400 to-gray-500'}`}>
        <h2 className="text-xl font-bold mb-2">مرحباً بك! 👋</h2>
        <p className="text-white/80 mb-4">اطلب توصيلاً جديداً الآن وسنوصله لك في أسرع وقت</p>
        {accepting_orders ? (
          <Link to="/customer/order/new" className="inline-flex items-center gap-2 bg-white text-primary-600 font-bold py-2.5 px-6 rounded-xl hover:bg-gray-100 transition-all">
            <Plus size={18} /> طلب توصيل جديد
          </Link>
        ) : (
          <span className="inline-flex items-center gap-2 bg-white/30 text-white/80 font-bold py-2.5 px-6 rounded-xl cursor-not-allowed">
            <Plus size={18} /> الطلب متوقف مؤقتاً
          </span>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center py-4">
          <Package size={24} className="mx-auto text-primary-500 mb-1" />
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{orders.length}</p>
          <p className="text-xs text-gray-500">طلباتي</p>
        </div>
        <div className="card text-center py-4">
          <Clock size={24} className="mx-auto text-orange-500 mb-1" />
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{orders.filter(o => !['completed','cancelled'].includes(o.status)).length}</p>
          <p className="text-xs text-gray-500">نشطة</p>
        </div>
        <div className="card text-center py-4">
          <CheckCircle size={24} className="mx-auto text-green-500 mb-1" />
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{orders.filter(o => o.status === 'completed').length}</p>
          <p className="text-xs text-gray-500">مكتملة</p>
        </div>
      </div>

      {/* Recent Orders */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-lg text-gray-900 dark:text-white">آخر الطلبات</h3>
          <Link to="/customer/orders" className="text-sm text-primary-600 dark:text-primary-400">عرض الكل</Link>
        </div>
        {loading ? (
          <div className="card text-center py-8"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : orders.length === 0 ? (
          <div className="card text-center py-8">
            <Truck size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">لا توجد طلبات بعد</p>
            {accepting_orders && (
              <Link to="/customer/order/new" className="text-primary-600 font-semibold text-sm mt-2 inline-block">اطلب الآن</Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map(order => (
              <Link key={order.id} to={`/customer/orders/${order.id}`} className="card block hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-mono text-gray-500">{order.order_number}</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${statusColors[order.status] || 'bg-gray-100'}`}>{statusLabels[order.status]}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <MapPin size={14} />
                  <span>{order.customer_address?.substring(0, 40)}...</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="font-bold text-primary-600">{order.final_total} ج.م</span>
                  <span className="text-xs text-gray-400">{new Date(order.created_at).toLocaleDateString('ar-EG')}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
