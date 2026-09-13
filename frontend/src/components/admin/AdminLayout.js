import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, Users, Users2, ClipboardList, MapPin,
  DollarSign, AlertTriangle, LogOut, Menu, X,
  Store, Settings, Image, Route
} from 'lucide-react';
import BrandLogo from '../common/BrandLogo';

export default function AdminLayout() {
  const { logout } = useAuth();
  const location   = useLocation();
  const navigate   = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = [
    { path: '/admin',              icon: <LayoutDashboard size={18} />, label: 'الرئيسية'       },
    { path: '/admin/drivers',      icon: <Users size={18} />,           label: 'السائقين'       },
    { path: '/admin/customers',    icon: <Users2 size={18} />,          label: 'العملاء'        },
    { path: '/admin/orders',       icon: <ClipboardList size={18} />,   label: 'الطلبات'        },
    { path: '/admin/locations',    icon: <MapPin size={18} />,          label: 'المواقع'        },
    { path: '/admin/pricing',         icon: <DollarSign size={18} />,      label: 'الأسعار'           },
    { path: '/admin/delivery-prices',  icon: <Route size={18} />,           label: 'أسعار التوصيل'    },
    { path: '/admin/place-options',    icon: <Store size={18} />,           label: 'خيارات الأماكن'    },
    { path: '/admin/complaints',         icon: <AlertTriangle size={18} />,   label: 'الشكاوى'        },
    { path: '/admin/commercial',          icon: <Store size={18} />,            label: 'حسابات تجارية'    },
    { path: '/admin/settings',            icon: <Settings size={18} />,         label: 'إعدادات المنصة' },
    { path: '/admin/banners',             icon: <Image size={18} />,            label: 'إعلانات التطبيق' },
  ];

  const isActive = (path) =>
    path === '/admin' ? location.pathname === '/admin' : location.pathname.startsWith(path);

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-base)' }}>

      {/* ── Sidebar ──────────────────────────────────────────── */}
      <aside className={`
        fixed lg:sticky top-0 right-0 h-screen w-64 z-30
        flex flex-col
        border-l transition-transform duration-300 lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'}
      `} style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>

        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b" style={{ borderColor: 'var(--border)' }}>
          <BrandLogo size="md" className="h-11 w-11" />
          <div>
            <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>لوحة التحكم</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>المشرف</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium"
              style={isActive(item.path) ? {
                background: 'var(--accent)',
                color: '#05142B',
                boxShadow: '0 4px 16px var(--accent-glow)',
              } : {
                color: 'var(--text-secondary)',
              }}
              onMouseEnter={e => { if (!isActive(item.path)) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
              onMouseLeave={e => { if (!isActive(item.path)) e.currentTarget.style.background = ''; }}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Bottom logout */}
        <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={() => { logout(); navigate('/'); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{ color: '#ff6b6b' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,77,77,0.1)'}
            onMouseLeave={e => e.currentTarget.style.background = ''}
          >
            <LogOut size={18} />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Overlay (mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Main ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Mobile top bar */}
        <header
          className="lg:hidden sticky top-0 z-40 flex items-center justify-between px-4 h-14 border-b"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-2">
            <BrandLogo size="sm" className="h-8 w-8 rounded-xl" />
            <span className="font-bold" style={{ color: 'var(--text-primary)' }}>لوحة التحكم</span>
          </div>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ color: 'var(--text-secondary)' }}>
            {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-8 max-w-6xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
