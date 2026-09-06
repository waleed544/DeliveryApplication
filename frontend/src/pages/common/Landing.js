import React from 'react';
import { Link } from 'react-router-dom';
import { Package, MapPin, Shield, ArrowLeft, Brain } from 'lucide-react';
import BrandLogo from '../../components/common/BrandLogo';

export default function Landing() {
  const features = [
    { icon: <Package size={28} />, title: 'طول اليوم متاحون الا أوقات الصلاه', desc: '' },
    { icon: <MapPin size={28} />, title: 'صلى على النبى محمد', desc: '  مشاء الله' },
    { icon: <Brain size={28} />, title: ' متفكريش كتير', desc: '' },
    { icon: <Shield size={28} />, title: 'آمن وموثوق', desc: 'الموقع غير مسئول عن التعامل خارج الموقع' },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <div className="relative overflow-hidden bg-gradient-to-br from-primary-500 to-green-600 text-white">
        <div className="absolute inset-0 opacity-10"><div className="absolute top-10 right-10 w-40 h-40 bg-white rounded-full blur-3xl" /><div className="absolute bottom-10 left-10 w-60 h-60 bg-yellow-300 rounded-full blur-3xl" /></div>
        <div className="relative max-w-6xl mx-auto px-4 py-20 text-center">
          <BrandLogo size="lg" className="mx-auto mb-6 border-white/25 shadow-[0_12px_36px_rgba(0,0,0,0.35)]" />
          <h1 className="text-4xl md:text-6xl font-bold mb-4">بكليك</h1>
          <p className="text-xl md:text-2xl text-white/90 mb-8 max-w-2xl mx-auto">اسهل شحن سريع واسرع طريقه التوصيل مشتريات وطلبات الى منزلك</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register" className="bg-white text-primary-600 font-bold py-3 px-8 rounded-xl hover:bg-gray-100 transition-all shadow-lg">إنشاء حساب</Link>
            <Link to="/login" className="bg-white/20 backdrop-blur text-white font-bold py-3 px-8 rounded-xl hover:bg-white/30 transition-all">تسجيل الدخول</Link>
          </div>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-12">لماذا تختارنا؟</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f, i) => (
            <div key={i} className="card text-center hover:shadow-lg transition-shadow">
              <div className="w-14 h-14 bg-primary-100 dark:bg-primary-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4 text-primary-600 dark:text-primary-400">{f.icon}</div>
              <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">{f.title}</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-gray-50 dark:bg-gray-800 py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">ابدأ الآن</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8">سجل كعميل لطلب التوصيل، أو كسائق للانضمام لفريقنا</p>
          <Link to="/register" className="btn-primary inline-flex items-center gap-2">ابدأ الآن <ArrowLeft size={18} /></Link>
        </div>
      </div>
      <footer className="bg-gray-900 text-gray-400 py-8 text-center text-sm"><p>© 2025 خدمة التوصيل. جميع الحقوق محفوظة.</p></footer>
    </div>
  );
}
