import { createContext, useContext, useState, useEffect } from 'react';
import { companies as companiesApi, settings as settingsApi } from '../api';
import { useAuth } from './AuthContext';

const SettingsContext = createContext({ logoUrl: null, adminCompanies: [], refreshSettings: () => {} });

export function SettingsProvider({ children }) {
  const { isAdmin } = useAuth();
  const [logoUrl, setLogoUrl] = useState(null);
  const [adminCompanies, setAdminCompanies] = useState([]);

  const fetchSettings = async () => {
    try {
      const [list, sett] = await Promise.all([companiesApi.list(), settingsApi.get()]);
      setAdminCompanies(list);
      const preferredId = sett?.superadmin_logo_company_id
        ? parseInt(sett.superadmin_logo_company_id)
        : null;
      const preferred = preferredId ? list.find(c => c.id === preferredId) : null;
      setLogoUrl((preferred || list[0])?.logo_url || null);
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
