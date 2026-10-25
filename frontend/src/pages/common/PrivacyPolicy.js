import React, { useState } from 'react';
import {
  Shield,
  MapPin,
  Bell,
  Users,
  Lock,
  Trash2,
  Mail,
  Globe,
  ChevronDown,
  ChevronUp,
  Package,
  Eye,
  UserX,
  Baby,
  RefreshCw,
  Phone
} from 'lucide-react';

const SECTIONS = [
  {
    id: 'intro',
    icon: Shield,
    color: '#6366f1',
    title: '1. مقدمة',
    content: (
      <p className="pp-text">
        توضح سياسة الخصوصية هذه كيفية تعامل تطبيق <strong>بكليك (Bclick)</strong> مع المعلومات الشخصية
        للمستخدمين عند استخدام خدمات التوصيل وإنشاء الطلبات وتتبعها عبر الموقع الإلكتروني{' '}
        <a href="https://bclick1.com" target="_blank" rel="noopener noreferrer" className="pp-link">
          bclick1.com
        </a>{' '}
        أو التطبيق المحمول. باستخدامك للتطبيق، فإنك توافق على الشروط الموضحة في هذه السياسة.
      </p>
    ),
  },
  {
    id: 'collected',
    icon: Eye,
    color: '#8b5cf6',
    title: '2. المعلومات التي نجمعها',
    content: (
      <div className="pp-list-section">
        <p className="pp-text mb-3">قد يجمع التطبيق ويعالج المعلومات التالية بحسب الخدمات التي تستخدمها:</p>
        <ul className="pp-list">
          <li>
            <span className="pp-bullet" style={{ background: '#6366f1' }} />
            <div>
              <strong>معلومات الحساب:</strong> الاسم الكامل، رقم الهاتف، وأي بيانات أخرى تُدخلها عند التسجيل.
            </div>
          </li>
          <li>
            <span className="pp-bullet" style={{ background: '#8b5cf6' }} />
            <div>
              <strong>معلومات الطلبات:</strong> تفاصيل التوصيل، مواقع الاستلام والتسليم، وسجل الطلبات السابقة.
            </div>
          </li>
          <li>
            <span className="pp-bullet" style={{ background: '#06b6d4' }} />
            <div>
              <strong>بيانات الموقع الجغرافي:</strong> عند منح إذن الوصول، يجمع التطبيق موقعك لتحديد نقاط
              الاستلام والتسليم ودعم تتبع الطلبات في الوقت الفعلي.
            </div>
          </li>
          <li>
            <span className="pp-bullet" style={{ background: '#10b981' }} />
            <div>
              <strong>معلومات تقنية:</strong> رموز تسجيل الجهاز (Device Tokens) اللازمة لإرسال إشعارات
              حالة الطلب عبر خدمة Firebase Cloud Messaging.
            </div>
          </li>
          <li>
            <span className="pp-bullet" style={{ background: '#f59e0b' }} />
            <div>
              <strong>بيانات المحادثات:</strong> الرسائل المتبادلة بين العميل والسائق المتعلقة بتنفيذ الطلب.
            </div>
          </li>
        </ul>
      </div>
    ),
  },
  {
    id: 'usage',
    icon: Package,
    color: '#06b6d4',
    title: '3. كيفية استخدام المعلومات',
    content: (
      <ul className="pp-list">
        <li>
          <span className="pp-bullet" style={{ background: '#06b6d4' }} />
          <span>توفير خدمات التوصيل وإدارة الحسابات والطلبات.</span>
        </li>
        <li>
          <span className="pp-bullet" style={{ background: '#6366f1' }} />
          <span>مساعدة السائقين على الوصول إلى مواقع الاستلام والتسليم بدقة.</span>
        </li>
        <li>
          <span className="pp-bullet" style={{ background: '#8b5cf6' }} />
          <span>إرسال إشعارات فورية بحالة الطلب (قُبل، جارٍ التوصيل، مكتمل...).</span>
        </li>
        <li>
          <span className="pp-bullet" style={{ background: '#10b981' }} />
          <span>تحسين أمان التطبيق وجودة الخدمة.</span>
        </li>
        <li>
          <span className="pp-bullet" style={{ background: '#f59e0b' }} />
          <span>الامتثال للالتزامات القانونية والتشغيلية المعمول بها.</span>
        </li>
      </ul>
    ),
  },
  {
    id: 'sharing',
    icon: Users,
    color: '#10b981',
    title: '4. مشاركة المعلومات',
    content: (
      <div className="pp-text-block">
        <p className="pp-text">
          قد تتم مشاركة المعلومات الضرورية لتنفيذ الطلب بين <strong>العميل والسائق والمسؤولين المخولين</strong>{' '}
          بإدارة الخدمة فقط.
        </p>
        <p className="pp-text mt-3">
          قد تتم معالجة بعض البيانات بواسطة <strong>مزودي الخدمات التقنية</strong> اللازمة لتشغيل التطبيق،
          مثل: الاستضافة السحابية، قواعد البيانات، وخدمة إشعارات Firebase.
        </p>
        <div className="pp-highlight">
          <Lock size={16} className="flex-shrink-0 mt-0.5" style={{ color: '#10b981' }} />
          <p>
            لا نبيع معلوماتك الشخصية لأطراف ثالثة، ولا نستخدمها لأغراض تسويقية خارج نطاق الخدمة.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'location',
    icon: MapPin,
    color: '#f59e0b',
    title: '5. بيانات الموقع الجغرافي',
    content: (
      <div className="pp-text-block">
        <p className="pp-text">
          يستخدم التطبيق بيانات الموقع <strong>أثناء الاستخدام فقط</strong> (Foreground) عند منح الإذن اللازم،
          وذلك لـ:
        </p>
        <ul className="pp-list mt-3">
          <li>
            <span className="pp-bullet" style={{ background: '#f59e0b' }} />
            <span>تحديد نقطة الاستلام أو التسليم عند إنشاء الطلب.</span>
          </li>
          <li>
            <span className="pp-bullet" style={{ background: '#f59e0b' }} />
            <span>تمكين تتبع الطلب في الوقت الفعلي للعميل والسائق معاً.</span>
          </li>
        </ul>
        <div className="pp-highlight mt-3">
          <MapPin size={16} className="flex-shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
          <p>
            يمكنك التحكم في إذن الموقع من إعدادات جهازك في أي وقت. رفض الإذن قد يؤثر على بعض ميزات
            تتبع الطلبات.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'notifications',
    icon: Bell,
    color: '#ec4899',
    title: '6. الإشعارات',
    content: (
      <p className="pp-text">
        يستخدم التطبيق <strong>Firebase Cloud Messaging (FCM)</strong> لإرسال إشعارات فورية تتعلق بحالة
        الطلبات (مثل: قبول الطلب، بدء التوصيل، الوصول، الاكتمال). يُخزَّن رمز تسجيل الجهاز بشكل آمن
        ويُستخدم فقط لإرسال الإشعارات ذات الصلة بحسابك. يمكنك إيقاف الإشعارات من إعدادات جهازك.
      </p>
    ),
  },
  {
    id: 'security',
    icon: Lock,
    color: '#6366f1',
    title: '7. حماية المعلومات والاحتفاظ بها',
    content: (
      <div className="pp-text-block">
        <p className="pp-text">
          نتخذ تدابير تقنية وتنظيمية مناسبة لحماية معلوماتك من الوصول أو الاستخدام غير المصرح به، بما في ذلك:
        </p>
        <ul className="pp-list mt-3">
          <li>
            <span className="pp-bullet" style={{ background: '#6366f1' }} />
            <span>تشفير بيانات الاتصال (HTTPS/TLS).</span>
          </li>
          <li>
            <span className="pp-bullet" style={{ background: '#6366f1' }} />
            <span>تخزين كلمات المرور بصيغة مشفرة (Hashed).</span>
          </li>
          <li>
            <span className="pp-bullet" style={{ background: '#6366f1' }} />
            <span>التحقق من الهوية عبر JSON Web Tokens (JWT).</span>
          </li>
        </ul>
        <p className="pp-text mt-3">
          نحتفظ بالبيانات للمدة اللازمة لتقديم الخدمة والوفاء بالالتزامات القانونية، ثم نحذفها بطريقة آمنة.
        </p>
      </div>
    ),
  },
  {
    id: 'deletion',
    icon: Trash2,
    color: '#ef4444',
    title: '8. حذف الحساب والبيانات',
    content: (
      <div className="pp-text-block">
        <p className="pp-text">
          يحق لك طلب حذف حسابك وجميع البيانات المرتبطة به بشكل نهائي عبر:
        </p>
        <ul className="pp-list mt-3">
          <li>
            <span className="pp-bullet" style={{ background: '#ef4444' }} />
            <div>
              <strong>صفحة حذف الحساب داخل التطبيق:</strong>{' '}
              <a href="/delete-account" className="pp-link">
                bclick1.com/delete-account
              </a>
            </div>
          </li>
          <li>
            <span className="pp-bullet" style={{ background: '#ef4444' }} />
            <span>التواصل معنا عبر البريد الإلكتروني الموضح أدناه.</span>
          </li>
        </ul>
        <div className="pp-highlight mt-3" style={{ borderColor: '#fca5a5', background: 'rgba(239,68,68,0.07)' }}>
          <UserX size={16} className="flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
          <p>
            تُحذف البيانات خلال مدة معقولة وفقاً للالتزامات القانونية. بعض البيانات المطلوبة قانونياً
            قد يُحتفظ بها للمدة المقررة.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'children',
    icon: Baby,
    color: '#06b6d4',
    title: '9. خصوصية الأطفال',
    content: (
      <p className="pp-text">
        تطبيق بكليك <strong>غير موجّه للأطفال دون سن 13 عاماً</strong>، ولا نجمع بياناتهم عمداً. إذا اكتشفنا
        أن طفلاً دون هذا السن قد قدّم بيانات شخصية، سنحذفها فوراً. إذا كنت ولياً للأمر وتعتقد أن طفلك
        قدّم بياناته، يرجى التواصل معنا عبر البريد الإلكتروني أدناه.
      </p>
    ),
  },
  {
    id: 'updates',
    icon: RefreshCw,
    color: '#8b5cf6',
    title: '10. التعديلات على السياسة',
    content: (
      <p className="pp-text">
        قد نحدّث سياسة الخصوصية هذه عند الحاجة. سننشر النسخة المحدثة على هذه الصفحة مع تعديل تاريخ آخر
        تحديث. نوصي بمراجعة هذه الصفحة بصفة دورية للاطلاع على أي تغييرات.
      </p>
    ),
  },
  {
    id: 'contact',
    icon: Mail,
    color: '#10b981',
    title: '11. التواصل معنا',
    content: (
      <div className="pp-contact-grid">
        <a href="mailto:support@bclick1.com" className="pp-contact-card">
          <Mail size={22} style={{ color: '#10b981' }} />
          <div>
            <p className="pp-contact-label">البريد الإلكتروني</p>
            <p className="pp-contact-value">support@bclick1.com</p>
          </div>
        </a>
        <a href="https://bclick1.com" target="_blank" rel="noopener noreferrer" className="pp-contact-card">
          <Globe size={22} style={{ color: '#6366f1' }} />
          <div>
            <p className="pp-contact-label">الموقع الإلكتروني</p>
            <p className="pp-contact-value">bclick1.com</p>
          </div>
        </a>
        <div className="pp-contact-card">
          <Phone size={22} style={{ color: '#f59e0b' }} />
          <div>
            <p className="pp-contact-label">التطبيق</p>
            <p className="pp-contact-value">بكليك (Bclick)</p>
          </div>
        </div>
      </div>
    ),
  },
];

function AccordionSection({ section, isOpen, onToggle }) {
  const Icon = section.icon;
  return (
    <div className="pp-accordion" style={{ '--accent': section.color }}>
      <button className="pp-accordion-header" onClick={onToggle} aria-expanded={isOpen}>
        <div className="pp-accordion-icon" style={{ background: section.color + '22', color: section.color }}>
          <Icon size={20} />
        </div>
        <span className="pp-accordion-title">{section.title}</span>
        <span className="pp-accordion-chevron" style={{ color: section.color }}>
          {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </span>
      </button>
      {isOpen && <div className="pp-accordion-body">{section.content}</div>}
    </div>
  );
}

export default function PrivacyPolicy() {
  const [openSection, setOpenSection] = useState('intro');

  const toggle = (id) => setOpenSection((prev) => (prev === id ? null : id));

  return (
    <>
      <style>{`
        .pp-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%);
          font-family: 'Segoe UI', 'Cairo', sans-serif;
          direction: rtl;
          padding: 0 0 64px;
        }
        .pp-hero {
          position: relative;
          overflow: hidden;
          padding: 56px 24px 48px;
          text-align: center;
        }
        .pp-hero::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 80% 60% at 50% 0%, rgba(99,102,241,0.35) 0%, transparent 70%),
            radial-gradient(ellipse 50% 40% at 80% 80%, rgba(139,92,246,0.2) 0%, transparent 60%);
          pointer-events: none;
        }
        .pp-hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(99,102,241,0.18);
          border: 1px solid rgba(99,102,241,0.4);
          color: #a5b4fc;
          padding: 6px 18px;
          border-radius: 100px;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 20px;
        }
        .pp-hero-title {
          font-size: clamp(28px, 6vw, 44px);
          font-weight: 800;
          color: #fff;
          margin: 0 0 12px;
          line-height: 1.2;
        }
        .pp-hero-title span {
          background: linear-gradient(135deg, #818cf8, #c084fc);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .pp-hero-subtitle {
          color: #94a3b8;
          font-size: 15px;
          max-width: 480px;
          margin: 0 auto;
          line-height: 1.7;
        }
        .pp-hero-date {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          color: #64748b;
          font-size: 12px;
          padding: 5px 14px;
          border-radius: 100px;
          margin-top: 20px;
        }
        .pp-content {
          max-width: 760px;
          margin: 0 auto;
          padding: 0 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .pp-accordion {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          overflow: hidden;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .pp-accordion:hover {
          border-color: rgba(99,102,241,0.3);
          box-shadow: 0 0 0 1px rgba(99,102,241,0.1);
        }
        .pp-accordion-header {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 18px 20px;
          background: none;
          border: none;
          cursor: pointer;
          text-align: right;
          transition: background 0.15s;
        }
        .pp-accordion-header:hover { background: rgba(255,255,255,0.03); }
        .pp-accordion-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .pp-accordion-title {
          flex: 1;
          color: #e2e8f0;
          font-size: 15px;
          font-weight: 700;
        }
        .pp-accordion-chevron { flex-shrink: 0; display: flex; }
        .pp-accordion-body {
          padding: 4px 20px 20px 20px;
          border-top: 1px solid rgba(255,255,255,0.06);
        }
        .pp-text {
          color: #94a3b8;
          font-size: 14px;
          line-height: 1.85;
          margin: 0;
        }
        .pp-text strong { color: #cbd5e1; }
        .pp-text-block { display: flex; flex-direction: column; gap: 0; }
        .pp-text-block .pp-text + .pp-text { margin-top: 12px; }
        .pp-link {
          color: #818cf8;
          text-decoration: none;
          border-bottom: 1px dashed rgba(129,140,248,0.4);
          transition: color 0.15s;
        }
        .pp-link:hover { color: #a5b4fc; }
        .pp-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .pp-list li {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          color: #94a3b8;
          font-size: 14px;
          line-height: 1.8;
        }
        .pp-list li strong { color: #cbd5e1; }
        .pp-bullet {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
          margin-top: 7px;
        }
        .mb-3 { margin-bottom: 12px; }
        .mt-3 { margin-top: 12px; }
        .pp-highlight {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          background: rgba(16,185,129,0.07);
          border: 1px solid rgba(16,185,129,0.25);
          border-radius: 10px;
          padding: 12px 14px;
          margin-top: 12px;
        }
        .pp-highlight p {
          color: #86efac;
          font-size: 13px;
          line-height: 1.7;
          margin: 0;
        }
        .pp-contact-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
          margin-top: 4px;
        }
        .pp-contact-card {
          display: flex;
          align-items: center;
          gap: 12px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          padding: 14px 16px;
          text-decoration: none;
          transition: background 0.15s, border-color 0.15s, transform 0.15s;
          cursor: default;
        }
        a.pp-contact-card { cursor: pointer; }
        a.pp-contact-card:hover {
          background: rgba(255,255,255,0.09);
          border-color: rgba(255,255,255,0.2);
          transform: translateY(-2px);
        }
        .pp-contact-label { color: #64748b; font-size: 11px; margin: 0 0 3px; }
        .pp-contact-value { color: #e2e8f0; font-size: 13px; font-weight: 600; margin: 0; word-break: break-all; }
        .pp-footer { text-align: center; margin-top: 40px; padding: 0 16px; }
        .pp-footer p { color: #475569; font-size: 12px; line-height: 1.8; max-width: 480px; margin: 0 auto; }
        .pp-footer a { color: #6366f1; text-decoration: none; }
        .pp-footer a:hover { text-decoration: underline; }
        .pp-toc {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          padding: 0 16px 24px;
          max-width: 760px;
          margin: 0 auto;
          justify-content: center;
        }
        .pp-toc-chip {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          color: #94a3b8;
          font-size: 12px;
          padding: 5px 14px;
          border-radius: 100px;
          cursor: pointer;
          transition: background 0.15s, color 0.15s, border-color 0.15s;
        }
        .pp-toc-chip:hover, .pp-toc-chip.active {
          background: rgba(99,102,241,0.2);
          border-color: rgba(99,102,241,0.5);
          color: #a5b4fc;
        }
      `}</style>

      <div className="pp-page">
        <div className="pp-hero">
          <div className="pp-hero-badge">
            <Shield size={14} />
            سياسة الخصوصية
          </div>
          <h1 className="pp-hero-title">
            بكليك <span>Bclick</span>
          </h1>
          <p className="pp-hero-subtitle">
            نلتزم بحماية بياناتك الشخصية وخصوصيتك. تعرّف على ما نجمعه وكيف نستخدمه ونحميه.
          </p>
          <div className="pp-hero-date">
            <RefreshCw size={12} />
            آخر تحديث: 26 أكتوبر 2026
          </div>
        </div>

        <div className="pp-toc">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              className={`pp-toc-chip ${openSection === s.id ? 'active' : ''}`}
              onClick={() => {
                setOpenSection(s.id);
                document.getElementById(`pp-section-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
            >
              {s.title.split('. ')[1]}
            </button>
          ))}
        </div>

        <div className="pp-content">
          {SECTIONS.map((section) => (
            <div key={section.id} id={`pp-section-${section.id}`}>
              <AccordionSection
                section={section}
                isOpen={openSection === section.id}
                onToggle={() => toggle(section.id)}
              />
            </div>
          ))}
        </div>

        <div className="pp-footer">
          <p>
            هذه الصفحة متاحة للعموم دون الحاجة لتسجيل الدخول، وفقاً لسياسات{' '}
            <a href="https://play.google.com/intl/ar/about/developer-content-policy/" target="_blank" rel="noopener noreferrer">
              Google Play
            </a>{' '}
            لحماية بيانات المستخدمين.
            <br />
            للتواصل:{' '}
            <a href="mailto:support@bclick1.com">support@bclick1.com</a>
            {' | '}
            <a href="https://bclick1.com" target="_blank" rel="noopener noreferrer">bclick1.com</a>
          </p>
        </div>
      </div>
    </>
  );
}
