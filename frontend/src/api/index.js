import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api' });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  r => r.data,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('admin_token');
      window.location.href = '/login';
    }
    return Promise.reject(err.response?.data?.error || err.message || 'Request failed');
  }
);

export const auth = {
  login: data => api.post('/auth/login', data),
};

export const companies = {
  list: () => api.get('/companies'),
  get: id => api.get(`/companies/${id}`),
  create: data => api.post('/companies', data),
  update: (id, data) => api.put(`/companies/${id}`, data),
  remove: id => api.delete(`/companies/${id}`),
  setLocation: (id, data) => api.patch(`/companies/${id}/location`, data),
  departments: id => api.get(`/companies/${id}/departments`),
  addDepartment: (id, data) => api.post(`/companies/${id}/departments`, data),
  removeDepartment: (companyId, deptId) => api.delete(`/companies/${companyId}/departments/${deptId}`),
};

export const departments = {
  list: params => api.get('/departments', { params }),
  create: data => api.post('/departments', data),
  update: (id, data) => api.put(`/departments/${id}`, data),
  remove: id => api.delete(`/departments/${id}`),
};

export const employees = {
  list: params => api.get('/employees', { params }),
  get: id => api.get(`/employees/${id}`),
  create: data => api.post('/employees', data),
  update: (id, data) => api.put(`/employees/${id}`, data),
  remove: id => api.delete(`/employees/${id}`),
  destroy: id => api.delete(`/employees/${id}/permanent`),
  nextId: company_id => api.get('/employees/next-id', { params: { company_id } }),
};

export const adminAccounts = {
  list: () => api.get('/admin-accounts'),
  create: data => api.post('/admin-accounts', data),
  remove: username => api.delete(`/admin-accounts/${username}`),
};

export const attendance = {
  list: params => api.get('/attendance', { params }),
  today: () => api.get('/attendance/today'),
  forEmployee: (id, params) => api.get(`/attendance/employee/${id}`, { params }),
  addManual: data => api.post('/attendance/manual', data),
  remove: id => api.delete(`/attendance/${id}`),
};

export const dashboard = {
  stats: () => api.get('/dashboard/stats'),
  live: () => api.get('/dashboard/live'),
  notifications: () => api.get('/dashboard/notifications'),
};

export const analytics = {
  get: () => api.get('/analytics'),
};

export const settings = {
  get: () => api.get('/settings'),
  update: data => api.put('/settings', data),
};

export const reports = {
  summary: params => api.get('/reports/summary', { params }),
  daily: params => api.get('/reports/daily', { params }),
  audit: () => api.get('/reports/audit'),
  exportUrl: params => {
    const qs = new URLSearchParams(params).toString();
    return `/api/reports/export?${qs}`;
  },
};

export const kiosk = {
  companies: () => api.get('/kiosk/companies'),
  departments: params => api.get('/kiosk/departments', { params }),
  employees: params => api.get('/kiosk/employees', { params }),
  status: id => api.get(`/kiosk/status/${id}`),
  scan: data => api.post('/kiosk/scan', data),
};
