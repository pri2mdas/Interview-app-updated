import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { login as apiLogin, register as apiRegister, me as apiMe } from "@/lib/api";

const TOKEN_KEY = "tmi_token";
const USER_KEY = "tmi_user";

const AuthContext = createContext({
  user: null,
  token: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  logout: () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(TOKEN_KEY) || null;
  });
  const [loading, setLoading] = useState(true);

  // Persist token/user whenever they change
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }, [token]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  }, [user]);

  // On first mount: if we have a token, verify it with /me; otherwise resolve loading=false
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const fresh = await apiMe();
        if (!cancelled) setUser(fresh);
      } catch {
        if (!cancelled) {
          setUser(null);
          setToken(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []); // intentionally only on mount

  const login = useCallback(async (identifier, password) => {
    const res = await apiLogin({ identifier, password });
    setToken(res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const register = useCallback(async (payload) => {
    const res = await apiRegister(payload);
    setToken(res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    if (!token) return null;
    try {
      const fresh = await apiMe();
      setUser(fresh);
      return fresh;
    } catch {
      setToken(null);
      setUser(null);
      return null;
    }
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
