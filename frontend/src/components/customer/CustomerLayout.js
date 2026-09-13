import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { Home, Package, User, LogOut, PhoneCall, Store } from 'lucide-react';
import BannerSlider from '../common/BannerSlider';
import BrandLogo from '../common/BrandLogo';

export default function CustomerLayout() {
  const { logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showSupport, setShowSupport] = useState(false);
  const [completedOrders, setCompletedOrders] = useState(0);

  useEffect(() => {
    api.get('/customers/profile').then(res => {
      if (res.data) setCompletedOrders(parseInt(res.data.completed_orders || 0, 10));
    }).catch(err => console.error('Failed to fetch profile', err));
  }, []);

  const navItems = [
    { path: '/customer', icon: <Home size={22} />, label: 'الرئيسية' },
    { path: '/customer/orders', icon: <Package size={22} />, label: 'طلباتي' },
    { path: '/customer/businesses', icon: <Store size={22} />, label: 'دليل المحلات' },
    { path: '/customer/profile', icon: <User size={22} />, label: 'حسابي' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-100 dark:border-gray-700">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BrandLogo size="md" className="h-11 w-11" />
            <span className="font-bold text-lg text-gray-900 dark:text-white">خدمة التوصيل</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Earnings badge */}
            <div className="px-2 py-1.5 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-orange-600 font-bold text-xs flex items-center gap-1 border border-orange-200 dark:border-orange-800">
              <span>مكسب:</span>
              <span>{completedOrders} ج</span>
            </div>

            {/* Support button */}
            <div className="relative">
              <button
                onClick={() => setShowSupport(s => !s)}
                className="relative flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600"
              >
                <PhoneCall size={16} />
                <span className="text-xs font-semibold">الدعم الفني</span>
                <span className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              </button>
              {showSupport && (
                <div className="absolute top-11 left-0 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl p-4 w-56 text-right">
                  <p className="font-bold text-gray-900 dark:text-white mb-1 text-sm">📞 الدعم الفني</p>
                  <p className="text-xs text-gray-500 mb-3">للمساعدة تواصل مع الإدارة</p>
                  <a
                    href="tel:01019488741"
                    className="flex items-center justify-center gap-2 w-full py-2.5 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl transition-colors text-sm"
                    onClick={() => setShowSupport(false)}
                  >
                    <PhoneCall size={15} /> 01019488741
                  </a>
                </div>
              )}
            </div>
            <button onClick={() => { logout(); navigate('/'); }} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-lg mx-auto px-4 py-4">
        <BannerSlider audience="customer" />
        <Outlet />
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 z-50">
        <div className="max-w-lg mx-auto flex justify-around py-2">
          {navItems.map((item) => (
            <Link key={item.path} to={item.path} className={`flex flex-col items-center gap-1 py-1 px-4 rounded-xl transition-all ${location.pathname === item.path ? 'text-primary-500' : 'text-gray-400 dark:text-gray-500'}`}>
              {item.icon}
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
