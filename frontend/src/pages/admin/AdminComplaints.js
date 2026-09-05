import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { AlertTriangle, Star, MessageSquare, CheckCircle, XCircle, Eye } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminComplaints() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchComplaints(); }, []);

  const fetchComplaints = () => {
    api.get('/admin/complaints').then(r => { setComplaints(r.data); setLoading(false); }).catch(() => setLoading(false));
  };

  const updateStatus = async (orderId, status) => {
    try { await api.put(`/admin/complaints/${orderId}`, { status }); toast.success('تم التحديث'); fetchComplaints(); }
    catch { toast.error('فشل'); }
  };

  return (
    <div className="animate-fade-in space-y-4">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">التقييمات والشكاوى</h1>

      {loading ? <div className="card text-center py-12"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" /></div> : complaints.length === 0 ? (
        <div className="card text-center py-12">
          <MessageSquare size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">لا توجد تقييمات أو شكاوى</p>
        </div>
      ) : (
        <div className="space-y-4">
          {complaints.map(c => (
            <div key={c.order_id} className="card">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-sm text-gray-500">{c.order_number}</span>
                    {c.rating && (
                      <div className="flex gap-0.5 text-yellow-400">
                        {[1,2,3,4,5].map(s => <span key={s}>{s <= c.rating ? '★' : '☆'}</span>)}
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">العميل: {c.customer_name} | السائق: {c.driver_name}</p>
                </div>
                {c.complaint_status === 'open' ? (
                  <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-full">مفتوحة</span>
                ) : (
                  <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">مغلقة</span>
                )}
              </div>

              {c.review && (
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl mb-2">
                  <p className="text-sm text-gray-700 dark:text-gray-300">{c.review}</p>
                </div>
              )}

              {c.complaint && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl mb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle size={14} className="text-red-500" />
                    <span className="text-sm font-bold text-red-700 dark:text-red-300">شكوى</span>
                  </div>
                  <p className="text-sm text-red-700 dark:text-red-300">{c.complaint}</p>
                </div>
              )}

              {c.complaint && c.complaint_status === 'open' && (
                <div className="flex gap-2">
                  <button onClick={() => updateStatus(c.order_id, 'resolved')} className="px-3 py-1.5 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 flex items-center gap-1">
                    <CheckCircle size={14} /> حل الشكوى
                  </button>
                  <button onClick={() => updateStatus(c.order_id, 'dismissed')} className="px-3 py-1.5 bg-gray-500 text-white text-sm rounded-lg hover:bg-gray-600 flex items-center gap-1">
                    <XCircle size={14} /> رفض
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
