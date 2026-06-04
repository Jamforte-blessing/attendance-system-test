import axios from 'axios';

const apiBase = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';
const api = axios.create({ baseURL: apiBase });

// Separate client for login (no redirect on 401)
const loginApi = axios.create({ baseURL: apiBase });

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

// Login API: no redirect on 401, just pass through the error
loginApi.interceptors.response.use(
  r => r.data,
  err => Promise.reject(err.response?.data?.error || err.message || 'Request failed')
);

export const auth = {
  login: data => loginApi.post('/auth/login', data),
  forgotPassword: data => loginApi.post('/auth/forgot-password', data),
};

export const employeeAuth = {
  changePassword: (token, data) => axios.post(`${apiBase}/auth/change-password`, data, {
    headers: { Authorization: `Bearer ${token}` },
  }),
};

export const companies = {
  list: () => api.get('/companies'),
  get: id => api.get(`/companies/${id}`),
  create: data => api.post('/companies', data),
  update: (id, data) => api.put(`/companies/${id}`, data),
  remove: id => api.delete(`/companies/${id}`),
  setLocation: (id, data) => api.patch(`/companies/${id}/location`, data),
  uploadLogo: (id, file) => {
    const form = new FormData();
    form.append('logo', file);
    return api.post(`/companies/${id}/logo`, form);
  },
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

export const units = {
  list: params => api.get('/units', { params }),
  create: data => api.post('/units', data),
  update: (id, data) => api.put(`/units/${id}`, data),
  remove: id => api.delete(`/units/${id}`),
};

export const employees = {
  list: params => api.get('/employees', { params }),
  get: id => api.get(`/employees/${id}`),
  create: data => api.post('/employees', data),
  update: (id, data) => api.put(`/employees/${id}`, data),
  remove: id => api.delete(`/employees/${id}`),
  destroy: id => api.delete(`/employees/${id}/permanent`),
  nextId: params => api.get('/employees/next-id', { params }),
  generatePassword: id => api.post(`/employees/${id}/generate-password`),
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
  get: params => api.get('/analytics', { params }),
};

export const settings = {
  get: () => api.get('/settings'),
  update: data => api.put('/settings', data),
  uploadLogo: file => {
    const form = new FormData();
    form.append('logo', file);
    return api.post('/settings/logo', form);
  },
};

export const reports = {
  summary: params => api.get('/reports/summary', { params }),
  daily: params => api.get('/reports/daily', { params }),
  audit: () => api.get('/reports/audit'),
  export: params => api.get('/reports/export', { params, responseType: 'blob' }),
};

export const kiosk = {
  companies: () => api.get('/kiosk/companies'),
  departments: params => api.get('/kiosk/departments', { params }),
  units: params => api.get('/kiosk/units', { params }),
  employees: params => api.get('/kiosk/employees', { params }),
  status: id => api.get(`/kiosk/status/${id}`),
  insights: (id, params) => api.get(`/kiosk/insights/${id}`, { params }),
  scan: data => api.post('/kiosk/scan', data),
};
