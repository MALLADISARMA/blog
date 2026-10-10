import { createContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/authApi.js';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const sessionExpired = () => {
      if (mounted) setAdmin(null);
    };
    window.addEventListener('blog:session-expired', sessionExpired);
    authApi.me()
      .then((data) => {
        if (mounted) setAdmin(data.admin);
      })
      .catch(() => {
        if (mounted) setAdmin(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
      window.removeEventListener('blog:session-expired', sessionExpired);
    };
  }, []);

  const value = useMemo(() => ({
    admin,
    loading,
    async login(email, password) {
      const data = await authApi.login(email, password);
      setAdmin(data.admin);
    },
    async logout() {
      await authApi.logout();
      setAdmin(null);
    },
  }), [admin, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
