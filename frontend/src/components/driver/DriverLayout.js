import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Home, ClipboardList, Wallet, User, LogOut } from 'lucide-react';
import BannerSlider from '../common/BannerSlider';
import BrandLogo from '../common/BrandLogo';

export default function DriverLayout() {
  const { logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { path: '/driver', icon: <Home size={22} />, label: 'الرئيسية' },
    { path: '/driver/orders', icon: <ClipboardList size={22} />, label: 'الطلبات' },
    { path: '/driver/earnings', icon: <Wallet size={22} />, label: 'الأرباح' },
    { path: '/driver/profile', icon: <User size={22} />, label: 'حسابي' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      <header className="sticky top-0 z-40 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-100 dark:border-gray-700">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BrandLogo size="md" className="h-11 w-11" />
            <span className="font-bold text-lg text-gray-900 dark:text-white">لوحة السائق</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { logout(); navigate('/'); }} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-lg mx-auto px-4 py-4">
        <BannerSlider audience="driver" />
        <Outlet />
      </main>
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
