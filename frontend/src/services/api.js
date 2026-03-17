import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh token on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refresh = localStorage.getItem('refresh_token');
        const res = await axios.post(
          `${process.env.REACT_APP_API_URL || 'http://localhost:8000/api'}/auth/refresh/`,
          { refresh }
        );
        localStorage.setItem('access_token', res.data.access);
        original.headers.Authorization = `Bearer ${res.data.access}`;
        return api(original);
      } catch {
        localStorage.clear();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ── Auth ──────────────────────────────────────────────
export const authAPI = {
  login:   (email, password) => api.post('/auth/login/', { username: email, password }),
  me:      ()                => api.get('/auth/me/'),
  refresh: (refresh)         => api.post('/auth/refresh/', { refresh }),
};

// ── Clients ───────────────────────────────────────────
export const clientsAPI = {
  list:        ()           => api.get('/clients/'),
  get:         (id)         => api.get(`/clients/${id}/`),
  create:      (data)       => api.post('/clients/', data),
  update:      (id, data)   => api.patch(`/clients/${id}/`, data),
  delete:      (id)         => api.delete(`/clients/${id}/`),
  summary:     (id, params) => api.get(`/clients/${id}/summary/`, { params }),
  timeseries:  (id, params) => api.get(`/clients/${id}/timeseries/`, { params }),
  posts:       (id, params) => api.get(`/clients/${id}/posts/`, { params }),
  triggerSync: (id, platforms) => api.post(`/clients/${id}/trigger_sync/`, { platforms }),
  syncStatus:  (id)         => api.get(`/clients/${id}/sync_status/`),
};

// ── OAuth ─────────────────────────────────────────────
export const oauthAPI = {
  status:     (clientId)           => api.get(`/oauth/status/${clientId}/`),
  disconnect: (clientId, platform) => api.delete(`/oauth/disconnect/${clientId}/${platform}/`),
  // Connect URLs (redirect browser directly)
  facebookUrl: (clientId) => `${process.env.REACT_APP_API_URL || 'http://localhost:8000/api'}/oauth/facebook/start/${clientId}/`,
  googleUrl:   (clientId) => `${process.env.REACT_APP_API_URL || 'http://localhost:8000/api'}/oauth/google/start/${clientId}/`,
  linkedinUrl: (clientId) => `${process.env.REACT_APP_API_URL || 'http://localhost:8000/api'}/oauth/linkedin/start/${clientId}/`,
};

// ── Overview ──────────────────────────────────────────
export const overviewAPI = {
  get: (params) => api.get('/overview/', { params }),
};

// ── Admin ─────────────────────────────────────────────
export const adminAPI = {
  createClient: (data) => api.post('/admin/create-client/', data),
};

// ── Sync Logs ─────────────────────────────────────────
export const syncLogsAPI = {
  list: (params) => api.get('/synclogs/', { params }),
};

// ── Goals ─────────────────────────────────────────────
export const goalsAPI = {
  list:     (params)   => api.get('/goals/', { params }),
  create:   (data)     => api.post('/goals/', data),
  update:   (id, data) => api.put(`/goals/${id}/`, data),
  delete:   (id)       => api.delete(`/goals/${id}/`),
  progress: (params)   => api.get('/goals/progress/', { params }),
};

// ── AI Insights ───────────────────────────────────────
export const insightsAPI = {
  list:     (params) => api.get('/insights/', { params }),
  generate: (data)   => api.post('/insights/generate/', data),
};

// ── Weekly Top Posts ──────────────────────────────────
export const topPostsAPI = {
  list:    (params) => api.get('/top-posts/', { params }),
  allTime: (params) => api.get('/top-posts/all-time/', { params }),
  run:     ()       => api.post('/top-posts/run/'),
};

// ── Alerts ────────────────────────────────────────────
export const alertsAPI = {
  list:        (params) => api.get('/alerts/', { params }),
  markRead:    (id)     => api.post(`/alerts/${id}/mark_read/`),
  markAllRead: (params) => api.post('/alerts/mark_all_read/', null, { params }),
  runCheck:    ()       => api.post('/alerts/run_check/'),
};

// ── ROI Calculator ─────────────────────────────────────
export const roiAPI = {
  getSettings:  (clientId)        => api.get(`/roi/settings/${clientId}/`),
  saveSettings: (clientId, data)  => api.put(`/roi/settings/${clientId}/`, data),
  calculate:    (data)            => api.post('/roi/calculate/', data),
  getLive:      (params)          => api.get('/roi/live/', { params }),
  getReports:   (params)          => api.get('/roi/reports/', { params }),
};

// ── Content Calendar ──────────────────────────────────
export const calendarAPI = {
  getPosts:     (params)   => api.get('/calendar/posts/',               { params }),
  getPost:      (id)       => api.get(`/calendar/posts/${id}/`),
  createPost:   (data)     => api.post('/calendar/posts/', data),
  updatePost:   (id, data) => api.put(`/calendar/posts/${id}/`, data),
  deletePost:   (id)       => api.delete(`/calendar/posts/${id}/`),
  reschedule:   (id, data) => api.post(`/calendar/posts/${id}/reschedule/`, data),
  getUpcoming:  (params)   => api.get('/calendar/posts/upcoming/',      { params }),
  getStats:     (params)   => api.get('/calendar/posts/stats/',         { params }),
  getNotes:     (params)   => api.get('/calendar/notes/',               { params }),
  createNote:   (data)     => api.post('/calendar/notes/', data),
  updateNote:   (id, data) => api.put(`/calendar/notes/${id}/`, data),
  deleteNote:   (id)       => api.delete(`/calendar/notes/${id}/`),
  getSchedule:  (params)   => api.get('/calendar/schedule/',            { params }),
  saveSchedule: (data)     => api.post('/calendar/schedule/', data),
  suggestTimes: (params)   => api.get('/calendar/suggest-times/',       { params }),
};

// ── Onboarding ────────────────────────────────────────
export const onboardingAPI = {
  list:   (params) => api.get('/onboarding/', { params }),
  update: (id, data) => api.patch(`/onboarding/${id}/`, data),
};

// ── Shared Reports (authenticated) ────────────────────
export const sharedReportsAPI = {
  list:   (params) => api.get('/shared-reports/', { params }),
  create: (data)   => api.post('/shared-reports/', data),
  delete: (id)     => api.delete(`/shared-reports/${id}/`),
  update: (id, data) => api.patch(`/shared-reports/${id}/`, data),
};

// ── Public Report (no auth — separate axios instance) ─
const publicApi = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000/api',
  headers: { 'Content-Type': 'application/json' },
});

export const publicReportAPI = {
  get:    (token)          => publicApi.get(`/public/report/${token}/`),
  verify: (token, password) => publicApi.post(`/public/report/${token}/verify/`, { password }),
};

// ── Management (superadmin only) ──────────────────────
export const managementAPI = {
  // Staff
  listStaff:           ()           => api.get('/management/staff/'),
  createStaff:         (data)       => api.post('/management/staff/', data),
  getStaff:            (id)         => api.get(`/management/staff/${id}/`),
  updateStaff:         (id, data)   => api.patch(`/management/staff/${id}/`, data),
  deleteStaff:         (id)         => api.delete(`/management/staff/${id}/`),
  getStaffPermissions: (id)         => api.get(`/management/staff/${id}/permissions/`),
  setStaffPermissions: (id, data)   => api.post(`/management/staff/${id}/permissions/`, data),
  getStaffClients:     (id)         => api.get(`/management/staff/${id}/clients/`),
  setStaffClients:     (id, data)   => api.post(`/management/staff/${id}/clients/`, data),
  // Clients
  listClients:               ()           => api.get('/management/clients/'),
  getClient:                 (id)         => api.get(`/management/clients/${id}/`),
  updateClient:              (id, data)   => api.patch(`/management/clients/${id}/`, data),
  getClientPermissions:      (id)         => api.get(`/management/clients/${id}/permissions/`),
  setClientPermissions:      (id, data)   => api.post(`/management/clients/${id}/permissions/`, data),
  getClientPortalConfig:     (id)         => api.get(`/management/clients/${id}/portal-config/`),
  saveClientPortalConfig:    (id, data)   => api.put(`/management/clients/${id}/portal-config/`, data),
  // Permissions & Roles
  listPermissions:     ()           => api.get('/management/permissions/'),
  getRoleDefaults:     (role)       => api.get(`/management/role-defaults/${role}/`),
  setRoleDefaults:     (role, data) => api.put(`/management/role-defaults/${role}/`, data),
};

// ── AI Caption Writer ──────────────────────────────
export const captionAPI = {
  generate:   (data)     => api.post('/ai/caption/', data),
  getHistory: (clientId) => api.get('/ai/caption/', { params: { client_id: clientId } }),
};

// ── AI Post Ideas Generator ────────────────────────
export const postIdeasAPI = {
  generate:      (data)              => api.post('/ai/post-ideas/', data),
  getHistory:    (params)            => api.get('/ai/post-ideas/', { params }),
  approveAll:    (id)                => api.post(`/ai/post-ideas/${id}/approve-all/`),
  addToCalendar: (id, data)          => api.post(`/ai/post-ideas/${id}/add-to-calendar/`, data),
  updateIdea:    (id, ideaId, data)  => api.patch(`/ai/post-ideas/${id}/ideas/${ideaId}/`, data),
};

// ── AI Hashtag Research Tool ───────────────────────
export const hashtagAPI = {
  generate:    (data)   => api.post('/ai/hashtags/', data),
  getHistory:  (params) => api.get('/ai/hashtags/', { params }),
  saveSet:     (id, data) => api.post(`/ai/hashtags/${id}/save-set/`, data),
  getSavedSets:(params) => api.get('/ai/hashtags/saved-sets/', { params }),
};

export default api;
