import React, { useState, useEffect } from "react";
import api from "../../utils/api";
import { CheckCircle, XCircle, Eye, EyeOff, Trash2, Store, MapPin, Phone } from "lucide-react";
import toast from "react-hot-toast";

export default function AdminCommercialAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all | pending | approved

  const fetch = () => {
    setLoading(true);
    api.get("/admin/commercial-accounts").then(r => { setAccounts(r.data); setLoading(false); }).catch(() => setLoading(false));
  };

  useEffect(() => { fetch(); }, []);

  const approve = async (id, val) => {
    try {
      await api.put(`/admin/commercial-accounts/${id}/approve`, { approve: val });
      toast.success(val ? "تم الموافقة" : "تم الرفض");
      fetch();
    } catch { toast.error("فشل العملية"); }
  };

  const toggleDir = async (id) => {
    try {
      const r = await api.put(`/admin/commercial-accounts/${id}/toggle-directory`);
      toast.success(r.data.show_in_directory ? "يظهر في الدليل الآن" : "تم الإخفاء من الدليل");
      fetch();
    } catch { toast.error("فشل العملية"); }
  };

  const remove = async (id) => {
    if (!window.confirm("هل أنت متأكد من تعطيل هذا الحساب؟")) return;
    try {
      await api.delete(`/admin/commercial-accounts/${id}`);
      toast.success("تم التعطيل");
      fetch();
    } catch { toast.error("فشل الحذف"); }
  };

  const filtered = accounts.filter(a => {
    if (filter === "pending") return !a.is_approved_commercial;
    if (filter === "approved") return a.is_approved_commercial;
    return true;
  });

  const pendingCount = accounts.filter(a => !a.is_approved_commercial).length;

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Store size={24} className="text-amber-500" /> الحسابات التجارية
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{accounts.length} حساب إجمالي · {pendingCount} في انتظار الموافقة</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {[{ k: "all", l: "الكل" }, { k: "pending", l: `بانتظار الموافقة (${pendingCount})` }, { k: "approved", l: "موافق عليها" }].map(t => (
          <button key={t.k} type="button" onClick={() => setFilter(t.k)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${filter === t.k ? "bg-amber-500 text-white shadow" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"}`}>
            {t.l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card text-center py-12"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12">
          <Store size={40} className="mx-auto text-gray-300 mb-2" />
          <p className="text-gray-500">لا توجد حسابات تجارية</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(a => (
            <div key={a.id} className={`card ${!a.is_approved_commercial ? "border-amber-200 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/10" : ""}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-bold text-gray-900 dark:text-white">{a.business_name || "—"}</h3>
                    {!a.is_approved_commercial ? (
                      <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 rounded-full font-medium">بانتظار الموافقة</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 rounded-full font-medium">✓ موافق عليه</span>
                    )}
                    {a.is_approved_commercial && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.show_in_directory ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" : "bg-gray-100 text-gray-500"}`}>
                        {a.show_in_directory ? "👁 ظاهر في الدليل" : "مخفي"}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">صاحب الحساب: <span className="font-medium">{a.owner_name}</span></p>
                  <div className="flex items-center gap-4 mt-1 text-xs text-gray-500 flex-wrap">
                    {a.location_name && <span className="flex items-center gap-1"><MapPin size={11} /> {a.location_name}</span>}
                    {a.owner_phone && <span className="flex items-center gap-1"><Phone size={11} /> {a.owner_phone}</span>}
                    {a.business_phone && a.business_phone !== a.owner_phone && <span className="flex items-center gap-1"><Phone size={11} /> {a.business_phone}</span>}
                  </div>
                  {a.business_description && <p className="text-xs text-gray-400 mt-1 truncate">{a.business_description}</p>}
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  {!a.is_approved_commercial ? (
                    <>
                      <button onClick={() => approve(a.id, true)} className="flex items-center gap-1 px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-medium hover:bg-green-600 transition-colors">
                        <CheckCircle size={13} /> موافقة
                      </button>
                      <button onClick={() => remove(a.id)} className="flex items-center gap-1 px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 transition-colors">
                        <XCircle size={13} /> رفض
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => toggleDir(a.id)} className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${a.show_in_directory ? "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200" : "bg-blue-100 text-blue-700 hover:bg-blue-200"}`}>
                        {a.show_in_directory ? <><EyeOff size={13} /> إخفاء</> : <><Eye size={13} /> إظهار</>}
                      </button>
                      <button onClick={() => remove(a.id)} className="flex items-center gap-1 px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-xs font-medium hover:bg-red-200 transition-colors">
                        <Trash2 size={13} /> تعطيل
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
