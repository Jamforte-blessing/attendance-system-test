import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

function decodeTokenPayload(token) {
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('admin_token'));
  const payload = decodeTokenPayload(token);
  const isSuperAdmin = payload?.isSuperAdmin === true;

  const login = (tok) => {
    localStorage.setItem('admin_token', tok);
    setToken(tok);
  };

  const logout = () => {
    localStorage.removeItem('admin_token');
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ token, login, logout, isAdmin: !!token, isSuperAdmin, companyIds: payload?.companyIds ?? null }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
