import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../utils/api";
import { Phone, Lock, User, MapPin, Store, Search } from "lucide-react";
import BrandLogo from "../../components/common/BrandLogo";
import toast from "react-hot-toast";

export default function Register() {
  const [role, setRole] = useState("customer");
  const [loading, setLoading] = useState(false);
  const { setUser } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "", phone: "", password: "", address: "",
    vehicle_id: "", vehicle_plate: "", national_id: "",
    business_name: "", business_location_id: "", business_phone: "", business_description: ""
  });
  const [vehicles, setVehicles] = useState([]);
  const [locations, setLocations] = useState([]);
  const [locSearch, setLocSearch] = useState("");
  const [showLocList, setShowLocList] = useState(false);

  useEffect(() => {
    api.get("/vehicles").then(r => setVehicles(r.data)).catch(() => {});
    api.get("/locations").then(r => setLocations(r.data)).catch(() => {});
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const filteredLocs = locations.filter(l =>
    l.name_ar?.toLowerCase().includes(locSearch.toLowerCase()) ||
    l.name_en?.toLowerCase().includes(locSearch.toLowerCase())
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (role === "customer") {
        const res = await api.post("/auth/register/customer", {
          name: form.name, phone: form.phone, password: form.password, address: form.address
        });
        localStorage.setItem("token", res.data.token);
        localStorage.setItem("user", JSON.stringify(res.data.user));
        setUser(res.data.user);
        toast.success("?????? ??! ?? ????? ????? ????? ??");
        navigate("/customer");
      } else if (role === "driver") {
        await api.post("/auth/register/driver", {
          name: form.name, phone: form.phone, password: form.password,
          vehicle_id: form.vehicle_id, vehicle_plate: form.vehicle_plate, national_id: form.national_id
        });
        toast.success("?? ????? ???? — ???? ????? ????? ??? ?????? ??????");
        navigate("/login");
      } else {
        if (!form.business_location_id) { toast.error("???? ???? ?????? ???????"); setLoading(false); return; }
        await api.post("/auth/register/commercial", {
          name: form.name, phone: form.phone, password: form.password,
          business_name: form.business_name, business_location_id: form.business_location_id,
          business_phone: form.business_phone, business_description: form.business_description
        });
        toast.success("?? ????? ???? — ???? ????? ????? ??????? ??? ?????? ??????");
        navigate("/login");
      }
    } catch (err) {
      const msg = err.response?.data?.message || "";
      if (msg.toLowerCase().includes("phone") || msg.includes("????") || msg.includes("already")) {
        toast.error("??? ?????? ???? ?????? — ???? ????? ??????");
      } else if (err.response?.data?.errors) {
        toast.error(err.response.data.errors[0]?.msg || "???? ?? ???????");
      } else {
        toast.error(msg || "??? ????? ??????");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-green-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <BrandLogo size="md" className="mx-auto mb-3 border-white/20 shadow-[0_10px_28px_rgba(0,0,0,0.28)]" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">????? ???? ????</h1>
        </div>
        <div className="card">
          {/* Role tabs */}
          <div className="flex rounded-xl bg-gray-100 dark:bg-gray-700 p-1 mb-6 gap-1">
            {[
              { key: "customer", label: "????" },
              { key: "driver",   label: "????" },
              { key: "commercial", label: "?? ?????" }
            ].map(t => (
              <button key={t.key} onClick={() => setRole(t.key)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${role === t.key ? "bg-white dark:bg-gray-600 shadow-sm text-primary-600" : "text-gray-500"}`}>
                {t.label}
              </button>
            ))}
          </div>

          {role === "commercial" && (
            <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl text-sm text-amber-700 dark:text-amber-300">
              ?? ?????? ??????? ???? ?? ??????? ???? ????? ??????? ???????? ??? ????? ????? ?? ???? ??????? ??? ?????? ??????.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Common fields */}
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">????? ??????</label>
              <div className="relative"><User size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input name="name" value={form.name} onChange={handleChange} className="input-field pr-10" placeholder="???? ????" required /></div></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">??? ??????</label>
              <div className="relative"><Phone size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input name="phone" value={form.phone} onChange={handleChange} className="input-field pr-10" placeholder="01XXXXXXXXX" required /></div></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">???? ??????</label>
              <div className="relative"><Lock size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input name="password" type="password" value={form.password} onChange={handleChange} className="input-field pr-10" placeholder="••••••••" required minLength={6} /></div></div>

            {role === "customer" && (
              <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">???????</label>
                <div className="relative"><MapPin size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input name="address" value={form.address} onChange={handleChange} className="input-field pr-10" placeholder="????? ???????" /></div></div>
            )}

            {role === "driver" && (
              <>
                <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">??? ???????</label>
                  <select name="vehicle_id" value={form.vehicle_id} onChange={handleChange} className="input-field" required>
                    <option value="">???? ???????</option>
                    {vehicles.map(v => <option key={v.id} value={v.id}>{v.icon} {v.name_ar}</option>)}
                  </select></div>
                <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">??? ??????</label>
                  <input name="vehicle_plate" value={form.vehicle_plate} onChange={handleChange} className="input-field" placeholder="? ? ? 1234" /></div>
                <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">????? ??????</label>
                  <input name="national_id" value={form.national_id} onChange={handleChange} className="input-field" placeholder="12345678901234" /></div>
              </>
            )}

            {role === "commercial" && (
              <>
                <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">??? ?????? ??????? *</label>
                  <div className="relative"><Store size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input name="business_name" value={form.business_name} onChange={handleChange} className="input-field pr-10" placeholder="????: ??? ??? ????" required /></div></div>

                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">???? ?????? ??????? *</label>
                  <div className="relative">
                    <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={locSearch || (locations.find(l => String(l.id) === String(form.business_location_id))?.name_ar || "")}
                      onChange={e => { setLocSearch(e.target.value); setShowLocList(true); setForm(f => ({...f, business_location_id: ""})); }}
                      onFocus={() => setShowLocList(true)}
                      className="input-field pr-10" placeholder="???? ?? ???????..." />
                  </div>
                  {showLocList && (
                    <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                      {filteredLocs.length === 0 && <p className="p-3 text-sm text-gray-400">?? ???? ?????</p>}
                      {filteredLocs.map(l => (
                        <button key={l.id} type="button" className="w-full text-right px-4 py-2.5 text-sm hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                          onClick={() => { setForm(f => ({...f, business_location_id: l.id})); setLocSearch(""); setShowLocList(false); }}>
                          {l.name_ar}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">??? ???? ?????? (???????)</label>
                  <input name="business_phone" value={form.business_phone} onChange={handleChange} className="input-field" placeholder="01XXXXXXXXX" /></div>
                <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">??? ?????? (???????)</label>
                  <textarea name="business_description" value={form.business_description} onChange={handleChange} className="input-field" rows={2} placeholder="??? ????? ?? ????? ???????..." /></div>
              </>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "????? ??????"}
            </button>
          </form>
          <div className="mt-4 text-center">
            <p className="text-gray-500 dark:text-gray-400 text-sm">???? ???? ??????? <Link to="/login" className="text-primary-600 dark:text-primary-400 font-semibold hover:underline">????? ??????</Link></p>
          </div>
        </div>
      </div>
    </div>
  );
}
