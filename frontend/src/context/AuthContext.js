import React, { createContext, useContext, useState, useEffect } from "react";
import api from "../utils/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("user")) || null; } catch { return null; }
  });
  const [loading, setLoading] = useState(true);
  const [customerProfile, setCustomerProfile] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) { fetchUser(); } else { setLoading(false); }
  }, []);

  const fetchUser = async () => {
    const tokenAtRequest = localStorage.getItem("token");
    try {
      const res = await api.get("/auth/me");
      const u = res.data.user;
      setUser(u);
      localStorage.setItem("user", JSON.stringify(u));
      if (u.role === "customer" && res.data.profile) {
        setCustomerProfile(res.data.profile);
      }
    } catch {
      if (tokenAtRequest && localStorage.getItem("token") === tokenAtRequest) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async (phone, password) => {
    const res = await api.post("/auth/login", { phone, password });
    const { token, user: u } = res.data;
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(u));
    setUser(u);
    try {
      const meRes = await api.get("/auth/me");
      if (meRes.data.profile) setCustomerProfile(meRes.data.profile);
    } catch {}
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setCustomerProfile(null);
  };

  const isCommercial = customerProfile?.account_type === "commercial";
  const businessProfile = isCommercial ? customerProfile : null;

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout, loading, customerProfile, isCommercial, businessProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
