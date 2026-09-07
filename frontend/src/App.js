import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useTheme } from './context/ThemeContext';

// Layouts
import CustomerLayout from './components/customer/CustomerLayout';
import DriverLayout from './components/driver/DriverLayout';
import AdminLayout from './components/admin/AdminLayout';

// Common Pages
import Login from './pages/common/Login';
import Register from './pages/common/Register';
import Landing from './pages/common/Landing';
import ChatWindow from './components/common/ChatWindow';

// Customer
import CustomerHome from './pages/customer/CustomerHome';
import CreateOrder from './pages/customer/CreateOrder';
import OrderTracking from './pages/customer/OrderTracking';
import CustomerOrders from './pages/customer/CustomerOrders';
import CustomerProfile from './pages/customer/CustomerProfile';

// Driver
import DriverDashboard from './pages/driver/DriverDashboard';
import DriverOrders from './pages/driver/DriverOrders';
import DriverEarnings from './pages/driver/DriverEarnings';
import DriverProfile from './pages/driver/DriverProfile';

// Admin
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminDrivers from './pages/admin/AdminDrivers';
import AdminOrders from './pages/admin/AdminOrders';
import AdminLocations from './pages/admin/AdminLocations';
import AdminPricing from './pages/admin/AdminPricing';
import AdminComplaints from './pages/admin/AdminComplaints';
import AdminPlaceOptions from './pages/admin/AdminPlaceOptions';
import AdminCustomers from './pages/admin/AdminCustomers';
import AdminSettings from './pages/admin/AdminSettings';
import AdminDriverBalance from './pages/admin/AdminDriverBalance';
import AdminBanners from './pages/admin/AdminBanners';
import AdminDeliveryPrices from './pages/admin/AdminDeliveryPrices';

function App() {
  const { user, loading } = useAuth();
  const { isDark } = useTheme();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className={isDark ? 'dark' : ''}>
      <Routes>
        <Route path="/" element={!user ? <Landing /> : <Navigate to={`/${user.role}`} />} />
        <Route path="/login" element={!user ? <Login /> : <Navigate to={`/${user.role}`} />} />
        <Route path="/register" element={!user ? <Register /> : <Navigate to={`/${user.role}`} />} />

        {/* Chat - accessible to customer and driver */}
        <Route path="/chat/:orderId" element={user?.role === 'customer' || user?.role === 'driver' ? <ChatWindow /> : <Navigate to="/login" />} />

        <Route path="/customer/*" element={user?.role === 'customer' ? <CustomerLayout /> : <Navigate to="/login" />}>
          <Route index element={<CustomerHome />} />
          <Route path="order/new" element={<CreateOrder />} />
          <Route path="orders" element={<CustomerOrders />} />
          <Route path="orders/:id" element={<OrderTracking />} />
          <Route path="chat/:orderId" element={<ChatWindow />} />
          <Route path="profile" element={<CustomerProfile />} />
        </Route>

        <Route path="/driver/*" element={user?.role === 'driver' ? <DriverLayout /> : <Navigate to="/login" />}>
          <Route index element={<DriverDashboard />} />
          <Route path="orders" element={<DriverOrders />} />
          <Route path="chat/:orderId" element={<ChatWindow />} />
          <Route path="earnings" element={<DriverEarnings />} />
          <Route path="profile" element={<DriverProfile />} />
        </Route>

        <Route path="/admin/*" element={user?.role === 'admin' ? <AdminLayout /> : <Navigate to="/login" />}>
          <Route index element={<AdminDashboard />} />
          <Route path="drivers" element={<AdminDrivers />} />
          <Route path="drivers/:id/balance" element={<AdminDriverBalance />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="locations" element={<AdminLocations />} />
          <Route path="pricing" element={<AdminPricing />} />
          <Route path="place-options" element={<AdminPlaceOptions />} />
          <Route path="complaints" element={<AdminComplaints />} />
          <Route path="customers" element={<AdminCustomers />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="banners" element={<AdminBanners />} />
          <Route path="delivery-prices" element={<AdminDeliveryPrices />} />
        </Route>
      </Routes>
    </div>
  );
}

export default App;
