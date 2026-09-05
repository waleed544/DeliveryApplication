import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import { Package, MapPin, Clock, ChevronLeft } from 'lucide-react';

export default function CustomerOrders() {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/customers/orders').then(r => {
      setOrders(r.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const statusLabels = {
    requested: 'تم الطلب', finding_driver: 'جاري البحث', driver_accepted: 'قبول السائق',
    going_to_location: 'في الطريق', arrived_at_location: 'وصل', items_collected: 'تم الجمع',
    delivering: 'جاري التوصيل', completed: 'مكتمل', cancelled: 'ملغي'
  };

  const filtered = filter === 'all' ? orders : orders.filter(o => 
    filter === 'active' ? !['completed','cancelled'].includes(o.status) : o.status === filter
  );

  return (
    <div className="animate-fade-in">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">طلباتي</h2>

      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {['all','active','completed','cancelled'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${filter === f ? 'bg-primary-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
            {f === 'all' ? 'الكل' : f === 'active' ? 'نشطة' : f === 'completed' ? 'مكتملة' : 'ملغية'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card text-center py-12"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12">
          <Package size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">لا توجد طلبات</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(order => (
            <Link key={order.id} to={`/customer/orders/${order.id}`} className="card block hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-mono text-gray-500">{order.order_number}</span>
                <span className={`text-xs px-2 py-1 rounded-full ${order.status === 'completed' ? 'bg-green-100 text-green-700' : order.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{statusLabels[order.status]}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 mb-1">
                <MapPin size={14} /><span>{order.customer_address?.substring(0, 45)}...</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-primary-600">{order.final_total} ج.م</span>
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <Clock size={12} />
                  {new Date(order.created_at).toLocaleDateString('ar-EG')}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
