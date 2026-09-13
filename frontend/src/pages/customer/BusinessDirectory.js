import React, { useState, useEffect } from "react";
import api from "../../utils/api";
import { MapPin, Phone, Search, Store } from "lucide-react";

export default function BusinessDirectory() {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.get("/businesses").then(r => { setBusinesses(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const filtered = businesses.filter(b =>
    b.business_name?.toLowerCase().includes(search.toLowerCase()) ||
    b.location_name?.toLowerCase().includes(search.toLowerCase()) ||
    b.business_description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="card text-white border-0 bg-gradient-to-br from-amber-500 to-orange-500">
        <div className="flex items-center gap-3 mb-2">
          <Store size={28} className="text-white/90" />
          <h1 className="text-xl font-bold">???? ??????? ????????</h1>
        </div>
        <p className="text-white/80 text-sm">????? ??????? ???????? ???????? ?? ??????</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          className="input-field pr-10" placeholder="???? ?? ??? ?? ?????..." />
      </div>

      {/* Content */}
      {loading ? (
        <div className="card text-center py-12"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12">
          <Store size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">{search ? "?? ???? ?????" : "?? ???? ????? ????? ???"}</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map(b => (
            <div key={b.id} className="card hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0">
                  <Store size={26} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 dark:text-white text-lg">{b.business_name}</h3>
                  {b.location_name && (
                    <div className="flex items-center gap-1 text-sm text-primary-600 dark:text-primary-400 mt-0.5">
                      <MapPin size={13} />
                      <span>{b.location_name}</span>
                    </div>
                  )}
                  {b.business_description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">{b.business_description}</p>
                  )}
                  {b.business_phone && (
                    <a href={`tel:${b.business_phone}`}
                      className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg text-sm font-medium hover:bg-green-100 transition-colors">
                      <Phone size={13} />
                      {b.business_phone}
                    </a>
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
