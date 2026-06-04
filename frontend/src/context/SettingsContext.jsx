import { createContext, useContext, useState, useEffect } from 'react';
import { companies as companiesApi } from '../api';
import { useAuth } from './AuthContext';

const SettingsContext = createContext({ logoUrl: null, adminCompanies: [], refreshSettings: () => {} });

export function SettingsProvider({ children }) {
  const { isAdmin } = useAuth();
  const [logoUrl, setLogoUrl] = useState(null);
  const [adminCompanies, setAdminCompanies] = useState([]);

  const fetchSettings = async () => {
    try {
      const list = await companiesApi.list();
      setAdminCompanies(list);
      setLogoUrl(list[0]?.logo_url || null);
    } catch {
      setAdminCompanies([]);
      setLogoUrl(null);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchSettings();
    } else {
      setAdminCompanies([]);
      setLogoUrl(null);
    }
  }, [isAdmin]);

  return (
    <SettingsContext.Provider value={{ logoUrl, adminCompanies, refreshSettings: fetchSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
