import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      authAPI.me()
        .then(res => setUser(res.data))
        .catch(() => { localStorage.clear(); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password, termsAccepted) => {
    const res = await authAPI.login(email, password, termsAccepted);
    localStorage.setItem('access_token',  res.data.access);
    localStorage.setItem('refresh_token', res.data.refresh);
    const me = await authAPI.me();
    setUser(me.data);
    return me.data;
  };

  const logout = () => {
    localStorage.clear();
    setUser(null);
  };

  const refreshUser = useCallback(async () => {
    const me = await authAPI.me();
    setUser(me.data);
    return me.data;
  }, []);

  // Check if the current user has a given permission code.
  // Superadmin always returns true. Others check the permissions dict from /me.
  const can = useCallback((code) => {
    if (!user) return false;
    if (user.role === 'superadmin') return true;
    return user.permissions?.[code] === true;
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, can, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
