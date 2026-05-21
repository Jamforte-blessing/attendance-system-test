import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api' });

api.interceptors.response.use(
  r => r.data,
  err => Promise.reject(err.response?.data?.error || err.message || 'Request failed')
);

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
};

export const devices = {
  list: () => api.get('/devices'),
  get: id => api.get(`/devices/${id}`),
  create: data => api.post('/devices', data),
  update: (id, data) => api.put(`/devices/${id}`, data),
  remove: id => api.delete(`/devices/${id}`),
};

export const simulator = {
  status: id => api.get(`/simulator/status/${id}`),
  scan: data => api.post('/simulator/scan', data),
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
